import * as THREE from "three";
import { SCENE } from "../config";
import { box, labelTexture, material, mesh } from "./utils";

/** Static room and lighting, independent of gameplay. */
export function createRoom(scene: THREE.Scene) {
  scene.background = new THREE.Color("#e7e6d9");
  scene.fog = new THREE.Fog("#e7e6d9", 19, 42);
  scene.add(new THREE.HemisphereLight("#fffae8", "#a8ad8b", 1.7));
  const sun = new THREE.DirectionalLight("#fff0cb", 2.0);
  sun.position.set(-4.5, 10, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SCENE.shadows, SCENE.shadows);
  Object.assign(sun.shadow.camera, {
    left: -10,
    right: 10,
    top: 10,
    bottom: -10,
    near: 0.5,
    far: 30,
  });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#edf6ff", 0.8);
  fill.position.set(5, 5, -3);
  scene.add(fill);

  const room = new THREE.Group();
  room.add(box([40, 0.12, 40], "#d7c5a5", [0, -0.06, 0]));
  for (let x = -16; x <= 16; x += 1.1) {
    room.add(box([0.013, 0.004, 32], "#c4b594", [x, 0.004, 0]));
  }
  room.add(box([30, 8, 0.18], "#d5ddc6", [0, 4, -6]));
  room.add(box([30, 0.15, 0.15], "#a6b18d", [0, 0.1, -5.88]));
  const rug = mesh(
    new THREE.CylinderGeometry(4.75, 4.75, 0.018, 64),
    material("#b6bd92"),
    [0, 0.015, 0],
  );
  rug.scale.z = 0.78;
  room.add(rug);
  const rugRing = mesh(
    new THREE.TorusGeometry(4.4, 0.025, 4, 80),
    material("#d6d9b9"),
    [0, 0.031, 0],
  );
  rugRing.rotation.x = -Math.PI / 2;
  rugRing.scale.y = 0.78;
  room.add(rugRing);

  // Window, sill, and a folded curtain give the scene a readable sense of depth.
  room.add(box([3.1, 2.8, 0.16], "#f6f0cf", [-3.1, 4.6, -5.78]));
  room.add(box([3.35, 0.14, 0.32], "#a8966e", [-3.1, 3.17, -5.58]));
  for (const x of [-4.66, -3.1, -1.54])
    room.add(box([0.09, 2.93, 0.22], "#fbf8e7", [x, 4.6, -5.64]));
  for (const y of [3.18, 4.6, 6.02])
    room.add(box([3.2, 0.09, 0.22], "#fbf8e7", [-3.1, y, -5.64]));
  for (let i = 0; i < 8; i++) {
    const curtain = box([0.13, 3.3, 0.15], i % 2 ? "#dfdfbf" : "#f1efd4", [
      -5 + i * 0.13,
      4.55,
      -5.35 + Math.sin(i) * 0.1,
    ]);
    room.add(curtain);
  }
  const poster = mesh(
    new THREE.PlaneGeometry(1.35, 1.85),
    new THREE.MeshStandardMaterial({
      map: labelTexture(
        "시험은 끝.\n나는 계속.",
        "#687343",
        "#edf0da",
        512,
        700,
      ),
    }),
    [3.8, 4.2, -5.86],
  );
  poster.rotation.z = -0.035;
  room.add(poster);
  room.add(box([0.34, 0.06, 0.02], "#e0cfaa", [3.8, 5.12, -5.83]));

  const pot = mesh(
    new THREE.CylinderGeometry(0.45, 0.3, 0.7, 10),
    material("#c7a27b"),
    [-5.4, 0.36, -3],
  );
  room.add(pot);
  for (let i = 0; i < 9; i++) {
    const leaf = mesh(
      new THREE.SphereGeometry(0.35, 6, 4),
      material(i % 2 ? "#7b925b" : "#98a66c"),
      [
        -5.4 + Math.sin(i * 2) * 0.35,
        0.8 + i * 0.08,
        -3 + Math.cos(i * 2) * 0.3,
      ],
    );
    leaf.scale.set(0.5, 1.6, 0.7);
    leaf.rotation.z = Math.sin(i) * 0.65;
    room.add(leaf);
  }
  scene.add(room);
}
