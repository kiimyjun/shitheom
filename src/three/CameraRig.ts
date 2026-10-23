import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SCENE } from "../config";
import { PointerGestures } from "../input/PointerGestures.mjs";

type CameraView = {
  readonly position: readonly number[];
  readonly target: readonly number[];
};

/** Owns presets and user camera movement without changing any game state. */
export class CameraRig {
  private controls: OrbitControls;
  private manual = false;
  private gestures = new PointerGestures();
  private abort = new AbortController();
  onChange?: (manual: boolean) => void;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private stage: HTMLElement,
    private motionReduced: boolean,
  ) {
    const options = { capture: true, signal: this.abort.signal };
    stage.addEventListener(
      "pointerdown",
      (event) => {
        this.gestures.begin(event.pointerId, event.clientX, event.clientY);
        if (event.button === 1 || event.button === 2 || this.gestures.count > 1)
          this.takeControl();
      },
      options,
    );
    stage.addEventListener(
      "pointermove",
      (event) => {
        const gesture = this.gestures.move(
          event.pointerId,
          event.clientX,
          event.clientY,
        );
        if (gesture?.dragged || gesture?.multiple) {
          this.takeControl();
          stage.classList.add("camera-dragging");
        }
      },
      options,
    );
    stage.addEventListener(
      "pointerup",
      (event) => {
        this.gestures.end(event.pointerId, event.clientX, event.clientY);
        if (!this.gestures.count) stage.classList.remove("camera-dragging");
      },
      options,
    );
    stage.addEventListener(
      "pointercancel",
      (event) => {
        this.gestures.remove(event.pointerId);
        if (!this.gestures.count) stage.classList.remove("camera-dragging");
      },
      options,
    );
    stage.addEventListener("wheel", () => this.takeControl(), {
      ...options,
      passive: true,
    });
    window.addEventListener(
      "blur",
      () => {
        this.gestures.reset();
        stage.classList.remove("camera-dragging");
      },
      { signal: this.abort.signal },
    );
    const controls = (this.controls = new OrbitControls(camera, stage));
    const config = SCENE.camera.controls;
    controls.target.set(...SCENE.camera.seated.target);
    controls.enableDamping = !motionReduced;
    controls.dampingFactor = 0.12;
    controls.rotateSpeed = config.rotateSpeed;
    controls.zoomSpeed = config.zoomSpeed;
    controls.panSpeed = 0.65;
    controls.minDistance = config.minDistance;
    controls.maxDistance = config.maxDistance;
    controls.minPolarAngle = config.minPolarAngle;
    controls.maxPolarAngle = config.maxPolarAngle;
    controls.minAzimuthAngle = -config.maxAzimuthAngle;
    controls.maxAzimuthAngle = config.maxAzimuthAngle;
    controls.screenSpacePanning = false;
    controls.cursor.copy(controls.target);
    controls.maxTargetRadius = config.maxPanDistance;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    controls.update();
  }

  private takeControl() {
    if (this.manual) return;
    this.manual = true;
    this.stage.focus({ preventScroll: true });
    this.onChange?.(true);
  }

  usePreset() {
    // Flush inertia before returning to a preset, so reset never keeps drifting.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = !this.motionReduced;
    this.manual = false;
    this.onChange?.(false);
  }

  update(dt: number, view: CameraView, shake: number) {
    if (this.manual) {
      this.controls.update(dt);
      return;
    }
    const target = new THREE.Vector3(
      view.target[0],
      view.target[1],
      view.target[2],
    );
    const position = new THREE.Vector3(
      view.position[0],
      view.position[1],
      view.position[2],
    );
    if (shake > 0.001)
      position.add(
        new THREE.Vector3(
          (Math.random() - 0.5) * shake,
          (Math.random() - 0.5) * shake,
          0,
        ),
      );
    const smoothing = this.motionReduced ? 1 : 1 - Math.exp(-3.5 * dt);
    this.camera.position.lerp(position, smoothing);
    this.controls.target.lerp(target, smoothing);
    this.controls.cursor.copy(this.controls.target);
    this.controls.update(dt);
  }

  dispose() {
    this.abort.abort();
    this.gestures.reset();
    this.stage.classList.remove("camera-dragging");
    this.controls.dispose();
  }
}
