import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SCENE } from "../config";

type CameraView = {
  readonly position: readonly number[];
  readonly target: readonly number[];
};

/** Owns presets and user camera movement without changing any game state. */
export class CameraRig {
  private controls: OrbitControls;
  private manual = false;
  private navigating = false;
  onInteraction?: () => void;
  onChange?: (manual: boolean, navigating: boolean) => void;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private stage: HTMLElement,
    private motionReduced: boolean,
  ) {
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
      LEFT: undefined,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };
    // One-finger play remains available. Touch navigation is explicitly enabled by the view button.
    controls.touches = { ONE: undefined, TWO: undefined };
    controls.addEventListener("start", this.startInteraction);
    controls.update();
  }

  get navigationMode() {
    return this.navigating;
  }

  private startInteraction = () => {
    this.manual = true;
    this.stage.focus({ preventScroll: true });
    this.onInteraction?.();
    this.onChange?.(this.manual, this.navigating);
  };

  toggleNavigation() {
    this.navigating = !this.navigating;
    this.controls.mouseButtons.LEFT = this.navigating
      ? THREE.MOUSE.ROTATE
      : undefined;
    this.controls.touches.ONE = this.navigating
      ? THREE.TOUCH.ROTATE
      : undefined;
    this.controls.touches.TWO = this.navigating
      ? THREE.TOUCH.DOLLY_PAN
      : undefined;
    this.onInteraction?.();
    this.onChange?.(this.manual, this.navigating);
  }

  usePreset() {
    // Flush inertia before returning to a preset, so reset never keeps drifting.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = !this.motionReduced;
    this.manual = false;
    this.navigating = false;
    this.controls.mouseButtons.LEFT = undefined;
    this.controls.touches.ONE = undefined;
    this.controls.touches.TWO = undefined;
    this.onChange?.(false, false);
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
    this.controls.removeEventListener("start", this.startInteraction);
    this.controls.dispose();
  }
}
