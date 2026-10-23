import * as THREE from "three";
import { box, labelTexture, material, mesh } from "./utils";

export class Shredder {
  readonly group = new THREE.Group();
  readonly slot = new THREE.Vector3(4.4, 1.99, 0);
  private motor = 0;

  constructor(scene: THREE.Scene) {
    this.group.position.set(4.4, 0, 0);
    this.group.add(box([1.55, 1.69, 1.2], "#46533c", [0, 0.88, 0]));
    this.group.add(box([1.69, 0.26, 1.3], "#63734a", [0, 1.84, 0]));
    this.group.add(box([1.35, 0.025, 0.105], "#1e2a1f", [0, 1.982, 0]));
    this.group.add(box([1.13, 1.1, 0.025], "#263427", [0, 0.84, 0.61]));
    this.group.add(box([0.1, 0.025, 0.1], "#d7ef7e", [0.63, 1.984, 0.4]));
    for (let i = 0; i < 6; i++)
      this.group.add(
        box([0.028, 0.55, 0.02], "#7c8864", [-0.4 + i * 0.16, 0.87, 0.634]),
      );
    const label = mesh(
      new THREE.PlaneGeometry(1.1, 0.15),
      new THREE.MeshStandardMaterial({
        map: labelTexture("GOODBYE, EXAM.", "#bac6a0", "#46533c", 512, 64),
      }),
      [0, 0.2, 0.62],
    );
    this.group.add(label);
    for (const x of [-0.56, 0.56])
      for (const z of [-0.42, 0.42])
        this.group.add(
          mesh(
            new THREE.CylinderGeometry(0.11, 0.11, 0.1, 8),
            material("#2e3828"),
            [x, 0.045, z],
          ),
        );
    scene.add(this.group);
  }

  pulse() {
    this.motor = 1;
  }
  reset() {
    this.motor = 0;
    this.group.rotation.set(0, 0, 0);
  }
  update(dt: number) {
    this.motor = Math.max(0, this.motor - dt * 4);
    this.group.rotation.z = Math.sin(this.motor * 65) * this.motor * 0.012;
  }
}
