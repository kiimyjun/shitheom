import * as THREE from "three";
import { SCENE } from "../config";
import { CameraRig } from "./CameraRig";
import type { GameSnapshot, Mode, PaperState } from "../domain/types";
import { PhysicsSystem } from "../physics/PhysicsSystem";
import { createDesk, createProps, type LooseProp } from "./Desk";
import { PaperModel } from "./PaperModel";
import { createRoom } from "./Room";
import { Shredder } from "./Shredder";
import { disposeObject, material, mesh } from "./utils";

/** Scene composition and frame loop. Individual objects own their own visuals. */
export class World3D {
  private scene = new THREE.Scene();
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(SCENE.camera.fov, 1, 0.1, 80);
  private cameraRig: CameraRig;
  onCameraInteraction?: () => void;
  onCameraChange?: (manual: boolean, navigating: boolean) => void;
  private desk: THREE.Group;
  private props: LooseProp[] = [];
  private papers: PaperModel[] = [];
  private shredder: Shredder;
  private observer: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private frameId = 0;
  private previousTime = performance.now();
  private disposed = false;
  private charge = 0;
  private flipTime: number | null = null;
  private deskReleased = false;
  private cameraShake = 0;
  private wide = false;
  private currentMode: Mode = "crumple";
  private motionReduced = matchMedia("(prefers-reduced-motion: reduce)")
    .matches;

  static async create(stage: HTMLElement) {
    const physics = await PhysicsSystem.create();
    try {
      return new World3D(stage, physics);
    } catch (error) {
      physics.dispose();
      throw error;
    }
  }

  private constructor(
    private stage: HTMLElement,
    private physics: PhysicsSystem,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(
      Math.min(devicePixelRatio, SCENE.pixelRatioLimit),
    );
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute("aria-label", "입체 책상과 시험지");
    stage.prepend(this.renderer.domElement);
    this.camera.position.set(...SCENE.camera.seated.position);
    this.cameraRig = new CameraRig(this.camera, stage, this.motionReduced);
    this.cameraRig.onInteraction = () => this.onCameraInteraction?.();
    this.cameraRig.onChange = (manual, navigating) =>
      this.onCameraChange?.(manual, navigating);
    createRoom(this.scene);
    this.desk = createDesk();
    this.scene.add(this.desk);
    this.shredder = new Shredder(this.scene);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(stage);
    this.resize();
    void document.fonts.ready.then(() => {
      if (!this.disposed) this.papers.forEach((paper) => paper.refreshFont());
    });
    this.frameId = requestAnimationFrame(this.frame);
  }

  rebuild(names: readonly string[], preview = false) {
    this.physics.reset();
    this.props.forEach((prop) => disposeObject(prop.object));
    this.props = [];
    this.papers.forEach((paper) => paper.dispose());
    this.papers = [];
    this.currentMode = "crumple";
    this.flipTime = null;
    this.deskReleased = false;
    this.charge = 0;
    this.cameraShake = 0;
    this.desk.position.set(0, SCENE.desk.height, 0);
    this.desk.quaternion.identity();
    this.props = createProps(this.desk);
    this.physics.createDesk(this.desk);
    this.shredder.reset();
    const subjects = names.length ? names : ["미적분학", "전공필수", "영어"];
    subjects.forEach((name, id) => {
      const paper = new PaperModel({
        id,
        name,
        progress: 0,
        mode: "",
        done: false,
      });
      const x =
        (id - (subjects.length - 1) / 2) * (subjects.length > 4 ? 0.36 : 0.58);
      paper.targetPosition.set(
        x,
        SCENE.desk.height + 0.035 + id * 0.011,
        0.08 + Math.abs(x) * 0.15,
      );
      paper.targetRotation.setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, (id - 1) * 0.16),
      );
      paper.group.position.copy(paper.targetPosition);
      paper.group.quaternion.copy(paper.targetRotation);
      this.scene.add(paper.group);
      this.papers.push(paper);
    });
    if (!preview)
      this.layout({
        subjects,
        selected: 0,
        mode: "crumple",
        phase: "playing",
        papers: [],
      });
  }

  layout(state: GameSnapshot) {
    if (state.phase !== "playing") return;
    this.currentMode = state.mode;
    this.papers.forEach((paper, index) => {
      const selected = index === state.selected;
      paper.setSelected(selected);
      if (paper.released || paper.state.done) return;
      if (selected && state.mode === "shred") {
        paper.targetPosition
          .copy(this.shredder.slot)
          .add(new THREE.Vector3(0, SCENE.paper.height / 2, 0));
        paper.targetRotation.setFromEuler(new THREE.Euler(0, -0.13, 0));
      } else {
        const count = this.papers.length;
        const base = (index - (count - 1) / 2) * (count > 4 ? 0.4 : 0.68);
        paper.targetPosition.set(
          selected ? -0.05 : base + (index < state.selected ? -0.65 : 0.65),
          SCENE.desk.height + (selected ? 0.11 : 0.025 + index * 0.012),
          selected ? 0.42 : -0.05,
        );
        paper.targetRotation.setFromEuler(
          new THREE.Euler(
            -Math.PI / 2,
            0,
            selected ? -0.035 : (index - 1) * 0.16,
          ),
        );
      }
    });
  }

  pick(clientX: number, clientY: number): number | null {
    const rect = this.stage.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      (-(clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(pointer, this.camera);
    const hit = this.raycaster.intersectObjects(
      this.papers.filter((p) => p.mesh.visible).map((p) => p.mesh),
      false,
    )[0];
    return hit ? (hit.object.userData.paperIndex as number) : null;
  }

  processPaper(state: PaperState) {
    this.papers[state.id]?.applyState(state);
    if (state.mode === "shred") {
      this.shredder.pulse();
      this.emitStrips();
    }
    this.cameraShake = this.motionReduced ? 0 : 0.025;
  }

  setCharge(amount: number) {
    this.charge = this.motionReduced ? 0 : amount;
  }
  toggleCamera() {
    this.cameraRig.usePreset();
    this.wide = !this.wide;
    return this.wide;
  }

  get cameraNavigationMode() {
    return this.cameraRig.navigationMode;
  }

  toggleCameraNavigation() {
    this.cameraRig.toggleNavigation();
  }

  resetCamera() {
    this.wide = false;
    this.cameraRig.usePreset();
  }

  flip() {
    if (this.flipTime !== null) return;
    this.charge = 0;
    this.flipTime = 0;
    this.cameraShake = this.motionReduced ? 0 : 0.18;
    for (const prop of this.props) {
      this.scene.attach(prop.object);
      this.physics.throwObject(prop.object, prop.halfSize, prop.mass);
    }
    for (const paper of this.papers) {
      paper.released = true;
      paper.setSelected(false);
      if (!paper.mesh.visible) continue;
      this.physics.throwObject(
        paper.group,
        [SCENE.paper.width / 2, SCENE.paper.height / 2, 0.015],
        0.04,
      );
    }
  }

  private emitStrips() {
    for (let i = 0; i < 8; i++) {
      const strip = mesh(
        new THREE.BoxGeometry(
          0.035 + Math.random() * 0.025,
          0.24 + Math.random() * 0.2,
          0.008,
        ),
        material(i % 2 ? "#f5efd9" : "#e5dfc5"),
      );
      strip.position.set(
        4.4 + (Math.random() - 0.5) * 1.05,
        1.1 + Math.random() * 0.2,
        0.72,
      );
      strip.rotation.set(Math.random(), Math.random(), Math.random());
      this.scene.add(strip);
      const body = this.physics.addBox(
        strip,
        [0.025, 0.16, 0.008],
        0.008,
        true,
      );
      body.setLinvel(
        {
          x: (Math.random() - 0.5) * 0.9,
          y: -0.6,
          z: 0.25 + Math.random() * 0.5,
        },
        true,
      );
      body.setAngvel(
        { x: Math.random() * 4, y: Math.random() * 3, z: Math.random() * 3 },
        true,
      );
    }
  }

  private resize() {
    const width = this.stage.clientWidth;
    const height = this.stage.clientHeight;
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private frame = (time: number) => {
    if (this.disposed) return;
    const dt = Math.min((time - this.previousTime) / 1000, 0.05);
    this.previousTime = time;
    this.updateDesk(dt);
    this.papers.forEach((paper) => {
      paper.update(dt);
      if (paper.isCrumpledReady && !paper.released) {
        paper.released = true;
        const body = this.physics.addPaperBall(paper.group);
        body.setAngvel({ x: 0.4, y: 0.2, z: 0.3 }, true);
      }
    });
    this.shredder.update(dt);
    this.physics.update(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.frame);
  };

  private updateDesk(dt: number) {
    if (this.deskReleased) return;
    if (this.flipTime === null) {
      const shake = this.charge * 0.022;
      this.physics.moveDesk(
        new THREE.Vector3((Math.random() - 0.5) * shake, SCENE.desk.height, 0),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            0,
            0,
            Math.sin(performance.now() * 0.045) * shake * 0.25,
          ),
        ),
      );
      return;
    }
    this.flipTime += dt;
    const t = Math.min(this.flipTime / 0.9, 1);
    const angle = -Math.PI * 0.9 * (1 - Math.pow(1 - t, 3));
    const rotation = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      angle,
    );
    const position = new THREE.Vector3(0, 0, SCENE.desk.depth / 2)
      .applyQuaternion(rotation)
      .add(new THREE.Vector3(0, SCENE.desk.height, -SCENE.desk.depth / 2));
    this.physics.moveDesk(position, rotation);
    if (t >= 1) {
      this.physics.releaseDesk();
      this.deskReleased = true;
    }
  }

  private updateCamera(dt: number) {
    const view = this.wide
      ? SCENE.camera.wide
      : this.flipTime !== null
        ? SCENE.camera.flipped
        : this.currentMode === "shred"
          ? SCENE.camera.shred
          : SCENE.camera.seated;
    this.cameraShake *= Math.exp(-7 * dt);
    this.cameraRig.update(dt, view, this.cameraShake);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    this.cameraRig.dispose();
    this.physics.dispose();
    this.papers.forEach((paper) => paper.dispose());
    disposeObject(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
