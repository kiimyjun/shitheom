import { canFlip, chargeProgress } from "../domain/rules.mjs";
import { PointerGestures } from "./PointerGestures.mjs";
import { PaperTaps } from "./PaperTaps.mjs";

interface Callbacks {
  enabled(): boolean;
  pick(x: number, y: number): number | null;
  select(id: number): void;
  crumple(id: number): void;
  dragStart(id: number, x: number, y: number): void;
  dragMove(x: number, y: number): void;
  dragEnd(x: number, y: number): void;
  dragCancel(): void;
  hover(x: number, y: number): void;
  charge(progress: number, holding: boolean): void;
  release(ready: boolean): void;
}

/** Paper gestures, touch holds and Space coexist with background camera gestures. */
export class InteractionController {
  private holding: { started: number; pointer: number | null } | null = null;
  private gestures = new PointerGestures();
  private taps = new PaperTaps();
  private candidate: { pointer: number; paper: number; x: number; y: number } | null = null;
  private dragging = false;
  private animation = 0;
  private abort = new AbortController();
  private stage: HTMLElement;
  private callbacks: Callbacks;

  constructor(stage: HTMLElement, callbacks: Callbacks) {
    this.stage = stage;
    this.callbacks = callbacks;
    const options = { signal: this.abort.signal };
    stage.addEventListener("pointerdown", this.pointerDown, options);
    stage.addEventListener("pointermove", this.pointerMove, options);
    stage.addEventListener("pointerup", this.pointerUp, options);
    stage.addEventListener("pointercancel", () => this.cancel(), options);
    stage.addEventListener("lostpointercapture", (event) => {
      if (this.candidate?.pointer === event.pointerId || this.holding?.pointer === event.pointerId)
        this.cancel();
    }, options);
    stage.addEventListener("contextmenu", (event) => event.preventDefault(), options);
    stage.addEventListener("wheel", () => this.cancelPointer(), { ...options, passive: true });
    window.addEventListener("pointerdown", (event) => {
      if (!this.stage.contains(event.target as Node)) this.cancelTouchCharge();
    }, options);
    window.addEventListener("keydown", this.keyDown, options);
    window.addEventListener("keyup", this.keyUp, options);
    window.addEventListener("blur", () => this.cancel(), options);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.cancel();
    }, options);
  }

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !this.callbacks.enabled()) {
      this.cancelPointer();
      return;
    }
    this.stage.focus({ preventScroll: true });
    this.gestures.begin(event.pointerId, event.clientX, event.clientY);
    this.stage.setPointerCapture(event.pointerId);
    if (this.gestures.count > 1) {
      this.cancelTouchCharge();
      this.cancelCandidate();
      this.taps.reset();
      return;
    }
    const paper = this.callbacks.pick(event.clientX, event.clientY);
    if (paper === null) {
      this.taps.reset();
      if (event.pointerType === "touch" && !this.holding) this.startCharge(event.pointerId);
      return;
    }
    this.candidate = { pointer: event.pointerId, paper, x: event.clientX, y: event.clientY };
    this.callbacks.select(paper);
  };

  private pointerMove = (event: PointerEvent) => {
    const gesture = this.gestures.move(event.pointerId, event.clientX, event.clientY);
    if (gesture?.dragged) this.taps.reset();
    if (this.holding?.pointer === event.pointerId &&
      (gesture?.dragged || gesture?.multiple || !this.inside(event.clientX, event.clientY)))
      this.cancelTouchCharge();
    if (gesture?.multiple) { this.cancelCandidate(); return; }
    const candidate = this.candidate;
    if (candidate?.pointer === event.pointerId && gesture?.dragged) {
      if (!this.dragging) {
        this.dragging = true;
        this.callbacks.dragStart(candidate.paper, candidate.x, candidate.y);
      }
      this.callbacks.dragMove(event.clientX, event.clientY);
    } else if (!gesture) this.callbacks.hover(event.clientX, event.clientY);
  };

  private pointerUp = (event: PointerEvent) => {
    const gesture = this.gestures.end(event.pointerId, event.clientX, event.clientY);
    const inside = this.inside(event.clientX, event.clientY);
    if (this.holding?.pointer === event.pointerId) {
      // Account for a release at the threshold before the next animation frame.
      const ready = gesture && !gesture.dragged && !gesture.multiple && inside &&
        this.callbacks.enabled() && canFlip(this.holding.started, performance.now());
      this.cancelCharge();
      if (ready) {
        this.cancelPointer();
        this.callbacks.release(true);
      }
      return;
    }
    const candidate = this.candidate;
    if (!gesture || !candidate || candidate.pointer !== event.pointerId) return;
    this.candidate = null;
    if (!inside || gesture.multiple || !this.callbacks.enabled()) {
      this.callbacks.dragCancel();
      this.taps.reset();
    } else if (gesture.dragged) {
      if (!this.dragging) this.callbacks.dragStart(candidate.paper, candidate.x, candidate.y);
      this.callbacks.dragEnd(event.clientX, event.clientY);
      this.taps.reset();
    } else if (this.callbacks.pick(event.clientX, event.clientY) === candidate.paper &&
      this.taps.tap(candidate.paper, event.clientX, event.clientY, performance.now())) {
      this.callbacks.crumple(candidate.paper);
    }
    this.dragging = false;
    this.callbacks.hover(event.clientX, event.clientY);
  };

  private keyDown = (event: KeyboardEvent) => {
    const target = event.target;
    const editing = target instanceof HTMLElement &&
      (target.matches("input, textarea, select, button") || target.isContentEditable);
    if (event.code !== "Space" || editing || !this.callbacks.enabled()) return;
    event.preventDefault();
    if (!event.repeat && !this.holding) {
      this.cancelPointer();
      this.startCharge(null);
    }
  };

  private keyUp = (event: KeyboardEvent) => {
    if (event.code !== "Space" || !this.holding || this.holding.pointer !== null) return;
    event.preventDefault();
    const ready = canFlip(this.holding.started, performance.now());
    this.cancelCharge();
    this.callbacks.release(ready);
  };

  private inside(x: number, y: number) {
    const rect = this.stage.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  private startCharge(pointer: number | null) {
    const holding = { started: performance.now(), pointer };
    this.holding = holding;
    const frame = () => {
      if (this.holding !== holding) return;
      if (!this.callbacks.enabled()) { this.cancelCharge(); return; }
      const progress = chargeProgress(holding.started, performance.now());
      this.callbacks.charge(progress, true);
      if (pointer !== null && progress >= 1) {
        this.cancelPointer();
        this.callbacks.release(true);
        return;
      }
      this.animation = requestAnimationFrame(frame);
    };
    frame();
  }

  private cancelCandidate() {
    if (this.dragging) this.callbacks.dragCancel();
    this.candidate = null;
    this.dragging = false;
  }
  private cancelPointer() {
    this.cancelTouchCharge();
    this.cancelCandidate();
    this.gestures.reset();
    this.taps.reset();
  }
  private cancelTouchCharge() {
    if (this.holding && this.holding.pointer !== null) this.cancelCharge();
  }
  private cancelCharge() {
    if (!this.holding) return;
    this.holding = null;
    cancelAnimationFrame(this.animation);
    this.animation = 0;
    this.callbacks.charge(0, false);
  }
  cancel() { this.cancelPointer(); this.cancelCharge(); }
  dispose() { this.cancel(); this.abort.abort(); }
}
