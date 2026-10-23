import { canFlip, chargeProgress } from "../domain/rules.mjs";

interface Callbacks {
  enabled(): boolean;
  flipMode(): boolean;
  tap(x: number, y: number): void;
  charge(progress: number, holding: boolean): void;
  release(ready: boolean): void;
}

/** Owns physical input and hold timing. UI buttons never enter the game click path. */
export class InteractionController {
  private started: number | null = null;
  private source: "keyboard" | number | null = null;
  private animation = 0;
  private abort = new AbortController();

  constructor(
    private stage: HTMLElement,
    private callbacks: Callbacks,
  ) {
    const options = { signal: this.abort.signal };
    stage.addEventListener("pointerdown", this.pointerDown, options);
    stage.addEventListener("pointerup", this.pointerUp, options);
    stage.addEventListener("pointercancel", () => this.cancel(), options);
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
    if (event.button !== 0 || !this.callbacks.enabled()) return;
    this.stage.focus({ preventScroll: true });
    if (this.callbacks.flipMode()) {
      this.stage.setPointerCapture(event.pointerId);
      this.begin(event.pointerId);
    } else this.callbacks.tap(event.clientX, event.clientY);
  };

  private pointerUp = (event: PointerEvent) => {
    if (this.source !== event.pointerId) return;
    const rect = this.stage.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (inside) this.release();
    else this.cancel();
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
    this.cancel();
    this.callbacks.release(ready);
  }

  cancel() {
    this.started = null;
    this.source = null;
    cancelAnimationFrame(this.animation);
    this.callbacks.charge(0, false);
  }

  dispose() {
    this.cancel();
    this.abort.abort();
  }
}
