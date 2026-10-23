import * as THREE from "three";
import { SCENE } from "../config";
import { CRUMPLE_STEPS, SHRED_STEPS } from "../domain/rules.mjs";
import type { PaperState } from "../domain/types";
import { createPaperTexture } from "./PaperTexture";
import { disposeObject } from "./utils";

/** Owns paper geometry only: animation targets are supplied by the game controller. */
export class PaperModel {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly targetPosition = new THREE.Vector3();
  readonly targetRotation = new THREE.Quaternion();
  private ring: THREE.LineSegments;
  private original: Float32Array;
  private originalUv: Float32Array;
  private amount = 0;
  private targetAmount = 0;
  private mode: "" | "crumple" | "shred" = "";
  private kick = 0;
  private lastAmount = -1;
  private name: string;
  state: PaperState;
  released = false;

  constructor(state: PaperState) {
    this.name = state.name;
    this.state = { ...state };
    const p = SCENE.paper;
    const geometry = new THREE.PlaneGeometry(
      p.width,
      p.height,
      p.segments,
      p.segments + 6,
    ).toNonIndexed();
    this.original = new Float32Array(geometry.getAttribute("position").array);
    this.originalUv = new Float32Array(geometry.getAttribute("uv").array);
    const material = new THREE.MeshStandardMaterial({
      map: createPaperTexture(state.name),
      side: THREE.DoubleSide,
      roughness: 0.94,
      flatShading: true,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.paperIndex = state.id;
    const border = new THREE.EdgesGeometry(
      new THREE.PlaneGeometry(p.width + 0.09, p.height + 0.09),
    );
    this.ring = new THREE.LineSegments(
      border,
      new THREE.LineBasicMaterial({
        color: "#9ab543",
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.ring.position.z = 0.006;
    this.ring.visible = false;
    this.group.add(this.mesh, this.ring);
  }

  setSelected(selected: boolean) {
    this.ring.visible = selected && !this.state.done;
  }

  applyState(state: PaperState) {
    if (this.mode !== state.mode) {
      this.amount = 0;
      this.lastAmount = -1;
      this.mode = state.mode;
    }
    this.state = { ...state };
    this.targetAmount =
      state.progress / (state.mode === "shred" ? SHRED_STEPS : CRUMPLE_STEPS);
    this.kick = 1;
    if (state.done || state.mode === "shred") this.ring.visible = false;
  }

  get isCrumpledReady() {
    return this.state.done && this.mode === "crumple" && this.amount > 0.997;
  }

  update(dt: number) {
    this.amount = THREE.MathUtils.damp(this.amount, this.targetAmount, 14, dt);
    this.kick = Math.max(0, this.kick - dt * 5);
    if (!this.released) {
      this.group.position.lerp(this.targetPosition, 1 - Math.exp(-9 * dt));
      this.group.quaternion.slerp(this.targetRotation, 1 - Math.exp(-9 * dt));
    }
    this.mesh.scale.setScalar(
      1 + Math.sin(this.kick * Math.PI * 3) * this.kick * 0.025,
    );
    if (Math.abs(this.amount - this.lastAmount) < 0.00001) return;
    this.lastAmount = this.amount;
    const position = this.mesh.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const uv = this.mesh.geometry.getAttribute("uv") as THREE.BufferAttribute;
    const p = SCENE.paper;
    for (let i = 0; i < position.count; i++) {
      const x = this.original[i * 3];
      const y = this.original[i * 3 + 1];
      const u = x / p.width + 0.5;
      const v = y / p.height + 0.5;
      if (this.mode === "crumple") {
        const t = this.amount;
        const theta = (u - 0.5) * Math.PI * 2;
        const phi = (v - 0.5) * Math.PI;
        const wrinkle =
          0.87 +
          Math.sin(u * 32 + v * 19) * 0.11 +
          Math.cos(v * 44 - u * 13) * 0.07;
        const radius = 0.29 * wrinkle;
        const targetX = radius * Math.sin(theta) * Math.cos(phi);
        const targetY = radius * Math.sin(phi);
        const targetZ = radius * Math.cos(theta) * Math.cos(phi) + 0.29;
        const crease =
          Math.sin(u * 28) * Math.sin(v * 24) * 0.065 * Math.sin(t * Math.PI);
        position.setXYZ(
          i,
          THREE.MathUtils.lerp(x, targetX, t),
          THREE.MathUtils.lerp(y, targetY, t),
          targetZ * t + crease,
        );
        uv.setXY(i, this.originalUv[i * 2], this.originalUv[i * 2 + 1]);
      } else if (this.mode === "shred") {
        position.setXYZ(
          i,
          x,
          y * Math.max(0.001, 1 - this.amount),
          Math.sin(u * 13) * 0.01,
        );
        uv.setXY(
          i,
          this.originalUv[i * 2],
          this.amount + this.originalUv[i * 2 + 1] * (1 - this.amount),
        );
      } else position.setXYZ(i, x, y, 0);
    }
    if (this.mode === "shred")
      this.mesh.position.y = (-this.amount * p.height) / 2;
    else this.mesh.position.y = 0;
    this.mesh.visible = !(this.mode === "shred" && this.amount > 0.995);
    position.needsUpdate = true;
    uv.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.ring.scale.setScalar(1 - this.amount * 0.55);
  }

  refreshFont() {
    this.mesh.material.map?.dispose();
    this.mesh.material.map = createPaperTexture(this.name);
    this.mesh.material.needsUpdate = true;
  }

  dispose() {
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    disposeObject(this.group);
  }
}
