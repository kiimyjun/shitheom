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

/** Paper gestures and Space coexist with background camera gestures. */
export class InteractionController {
  private started: number | null = null;
  private gestures = new PointerGestures();
  private taps = new PaperTaps();
  private candidate: { pointer: number; paper: number; x: number; y: number } | null = null;
  private dragging = false;
  private animation = 0;
  private abort = new AbortController();

  constructor(private stage: HTMLElement, private callbacks: Callbacks) {
    const options = { signal: this.abort.signal };
    stage.addEventListener("pointerdown", this.pointerDown, options);
    stage.addEventListener("pointermove", this.pointerMove, options);
    stage.addEventListener("pointerup", this.pointerUp, options);
    stage.addEventListener("pointercancel", () => this.cancel(), options);
    stage.addEventListener("lostpointercapture", (event) => {
      if (this.candidate?.pointer === event.pointerId) this.cancel();
    }, options);
    stage.addEventListener("wheel", () => this.cancelPointer(), { ...options, passive: true });
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
      this.cancelCandidate();
      this.taps.reset();
      return;
    }
    const paper = this.callbacks.pick(event.clientX, event.clientY);
    if (paper === null) { this.taps.reset(); return; }
    this.candidate = { pointer: event.pointerId, paper, x: event.clientX, y: event.clientY };
    this.callbacks.select(paper);
  };

  private pointerMove = (event: PointerEvent) => {
    const gesture = this.gestures.move(event.pointerId, event.clientX, event.clientY);
    if (gesture?.dragged) this.taps.reset();
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
    const candidate = this.candidate;
    if (!gesture || !candidate || candidate.pointer !== event.pointerId) return;
    this.candidate = null;
    const rect = this.stage.getBoundingClientRect();
    const inside = event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
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
    if (!event.repeat && this.started === null) {
      this.cancelPointer();
      this.started = performance.now();
      const frame = () => {
        if (this.started === null) return;
        this.callbacks.charge(chargeProgress(this.started, performance.now()), true);
        this.animation = requestAnimationFrame(frame);
      };
      frame();
    }
  };

  private keyUp = (event: KeyboardEvent) => {
    if (event.code !== "Space" || this.started === null) return;
    event.preventDefault();
    const ready = canFlip(this.started, performance.now());
    this.cancelCharge();
    this.callbacks.release(ready);
  };

  private cancelCandidate() {
    if (this.dragging) this.callbacks.dragCancel();
    this.candidate = null;
    this.dragging = false;
  }
  private cancelPointer() {
    this.cancelCandidate();
    this.gestures.reset();
    this.taps.reset();
  }
  private cancelCharge() {
    this.started = null;
    cancelAnimationFrame(this.animation);
    this.callbacks.charge(0, false);
  }
  cancel() { this.cancelPointer(); this.cancelCharge(); }
  dispose() { this.cancel(); this.abort.abort(); }
}
