import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PaperDrag } from "../src/three/PaperDrag.ts";

function fixture() {
  const camera = new THREE.PerspectiveCamera(60, 0.6, 0.1, 80);
  camera.position.set(5, 7, 8);
  camera.lookAt(0, 2, 0);
  camera.updateMatrixWorld();
  const group = new THREE.Group();
  group.position.set(0, 2.6, 0);
  const paper = {
    group, targetPosition: group.position.clone(), targetRotation: group.quaternion.clone(),
    state: { id: 2 }, setSelected() {},
  };
  const rayAt = (point) => {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(point, camera);
    return raycaster.ray;
  };
  return { camera, paper, rayAt };
}

test("a paper follows its grabbed point on a camera-facing plane in a tall rotated view", () => {
  const { camera, paper, rayAt } = fixture();
  const drag = new PaperDrag();
  const startPoint = paper.group.position.clone().project(camera);
  const nextPoint = new THREE.Vector2(startPoint.x + 0.4, startPoint.y - 0.25);
  drag.start(paper, rayAt(startPoint), camera);
  drag.move(rayAt(nextPoint));
  const projected = paper.group.position.clone().project(camera);
  assert.ok(Math.abs(projected.x - nextPoint.x) < 1e-8);
  assert.ok(Math.abs(projected.y - nextPoint.y) < 1e-8);
  assert.equal(drag.end(true), 2);
  const accepted = paper.targetPosition.clone();
  drag.move(rayAt(new THREE.Vector2(0, 0)));
  assert.ok(paper.targetPosition.equals(accepted));
});

test("an invalid drop or interrupted drag returns to the original desk location", () => {
  const { camera, paper, rayAt } = fixture();
  const drag = new PaperDrag();
  const home = paper.targetPosition.clone();
  for (const cancel of [false, true]) {
    paper.group.position.copy(home);
    drag.start(paper, rayAt(home.clone().project(camera)), camera);
    drag.move(rayAt(new THREE.Vector2(0.7, -0.2)));
    assert.ok(!paper.targetPosition.equals(home));
    if (cancel) drag.cancel();
    else assert.equal(drag.end(false), 2);
    assert.ok(paper.targetPosition.equals(home));
    assert.equal(drag.end(true), null);
  }
});
