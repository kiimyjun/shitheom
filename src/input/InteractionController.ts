import { canFlip, chargeProgress } from "../domain/rules.mjs";
import { PointerGestures } from "./PointerGestures.mjs";

interface Callbacks {
  enabled(): boolean;
  flipMode(): boolean;
  tap(x: number, y: number): void;
  charge(progress: number, holding: boolean): void;
  release(ready: boolean): void;
}

/** Clicks are committed on release; dragging and multi-touch never process paper. */
export class InteractionController {
  private started: number | null = null;
  private source: "keyboard" | number | null = null;
  private gestures = new PointerGestures();
  private animation = 0;
  private abort = new AbortController();

  constructor(
    private stage: HTMLElement,
    private callbacks: Callbacks,
  ) {
    const options = { signal: this.abort.signal };
    stage.addEventListener("pointerdown", this.pointerDown, options);
    stage.addEventListener("pointermove", this.pointerMove, options);
    stage.addEventListener("pointerup", this.pointerUp, options);
    stage.addEventListener(
      "pointercancel",
      (event) => {
        this.gestures.remove(event.pointerId);
        this.cancelPointerCharge();
      },
      options,
    );
    stage.addEventListener(
      "wheel",
      () => {
        this.gestures.reset();
        this.cancelPointerCharge();
      },
      { ...options, passive: true },
    );
    window.addEventListener("keydown", this.keyDown, options);
    window.addEventListener("keyup", this.keyUp, options);
    window.addEventListener("blur", () => this.cancel(), options);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.cancel();
      },
      options,
    );
  }

  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0) {
      this.gestures.reset();
      this.cancelPointerCharge();
      return;
    }
    if (!this.callbacks.enabled()) return;
    this.stage.focus({ preventScroll: true });
    this.gestures.begin(event.pointerId, event.clientX, event.clientY);
    this.stage.setPointerCapture(event.pointerId);
    if (this.gestures.count > 1) {
      this.cancelPointerCharge();
      return;
    }
    if (this.callbacks.flipMode()) this.begin(event.pointerId);
  };

  private pointerMove = (event: PointerEvent) => {
    const gesture = this.gestures.move(
      event.pointerId,
      event.clientX,
      event.clientY,
    );
    if (gesture?.dragged || gesture?.multiple) this.cancelPointerCharge();
  };

  private pointerUp = (event: PointerEvent) => {
    const gesture = this.gestures.end(
      event.pointerId,
      event.clientX,
      event.clientY,
    );
    if (!gesture) return;
    const rect = this.stage.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    const tap =
      inside &&
      !gesture.dragged &&
      !gesture.multiple &&
      this.callbacks.enabled();
    if (this.source === event.pointerId) {
      if (tap && this.callbacks.flipMode()) this.release();
      else this.cancelPointerCharge();
    } else if (tap && !this.callbacks.flipMode()) {
      this.callbacks.tap(event.clientX, event.clientY);
    }
  };

  private keyDown = (event: KeyboardEvent) => {
    const target = event.target;
    const editing =
      target instanceof HTMLElement &&
      (target.matches("input, textarea, select, button") ||
        target.isContentEditable);
    if (
      event.code !== "Space" ||
      editing ||
      !this.callbacks.enabled() ||
      !this.callbacks.flipMode()
    )
      return;
    event.preventDefault();
    if (!event.repeat) this.begin("keyboard");
  };

  private keyUp = (event: KeyboardEvent) => {
    if (event.code === "Space" && this.source === "keyboard") {
      event.preventDefault();
      this.release();
    }
  };

  private begin(source: "keyboard" | number) {
    if (this.started !== null) return;
    this.started = performance.now();
    this.source = source;
    const frame = () => {
      if (this.started === null) return;
      this.callbacks.charge(
        chargeProgress(this.started, performance.now()),
        true,
      );
      this.animation = requestAnimationFrame(frame);
    };
    frame();
  }

  private release() {
    if (this.started === null) return;
    const ready = canFlip(this.started, performance.now());
    this.cancelCharge();
    this.callbacks.release(ready);
  }

  private cancelPointerCharge() {
    if (this.source !== "keyboard") this.cancelCharge();
  }

  private cancelCharge() {
    this.started = null;
    this.source = null;
    cancelAnimationFrame(this.animation);
    this.callbacks.charge(0, false);
  }

  cancel() {
    this.gestures.reset();
    this.cancelCharge();
  }

  dispose() {
    this.cancel();
    this.abort.abort();
  }
}
