import * as THREE from "three";
import type { PaperModel } from "./PaperModel";

/** A camera-facing plane keeps the grab point under the cursor at every angle. */
export class PaperDrag {
  private held: {
    paper: PaperModel;
    plane: THREE.Plane;
    offset: THREE.Vector3;
    home: THREE.Vector3;
    rotation: THREE.Quaternion;
  } | null = null;

  start(paper: PaperModel, ray: THREE.Ray, camera: THREE.Camera) {
    this.cancel();
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, paper.group.position);
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return;
    this.held = {
      paper, plane, offset: paper.group.position.clone().sub(hit),
      home: paper.targetPosition.clone(), rotation: paper.targetRotation.clone(),
    };
    paper.setSelected(true);
  }

  move(ray: THREE.Ray) {
    const held = this.held;
    if (!held) return;
    const point = ray.intersectPlane(held.plane, new THREE.Vector3());
    if (!point) return;
    held.paper.targetPosition.copy(point.add(held.offset));
    held.paper.group.position.copy(held.paper.targetPosition);
  }

  end(accepted: boolean): number | null {
    const held = this.held;
    if (!held) return null;
    this.held = null;
    if (!accepted) {
      held.paper.targetPosition.copy(held.home);
      held.paper.targetRotation.copy(held.rotation);
    }
    return held.paper.state.id;
  }

  cancel() { this.end(false); }
}
