import * as THREE from "three";
import { SCENE } from "../config";
import { box, labelTexture, material, mesh, seeded } from "./utils";

export interface LooseProp {
  object: THREE.Group;
  halfSize: [number, number, number];
  mass: number;
}

function woodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  const random = seeded(928);
  ctx.fillStyle = "#ccaa75";
  ctx.fillRect(0, 0, 1024, 512);
  for (let y = 0; y < 512; y += 86) {
    ctx.fillStyle = y % 172 ? "#d1b17e" : "#cba672";
    ctx.fillRect(0, y, 1024, 86);
    ctx.strokeStyle = "#92724436";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(1024, y);
    ctx.stroke();
  }
  for (let i = 0; i < 240; i++) {
    const y = random() * 512;
    ctx.strokeStyle = i % 3 ? "#f6dfae24" : "#95704024";
    ctx.lineWidth = random() * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      250,
      y + random() * 18,
      700,
      y - random() * 14,
      1024,
      y + random() * 8,
    );
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function createDesk() {
  const root = new THREE.Group();
  const d = SCENE.desk;
  root.position.y = d.height;
  const top = mesh(
    new THREE.BoxGeometry(d.width, d.thickness, d.depth),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.68 }),
    [0, -d.thickness / 2, 0],
  );
  root.add(top);
  root.add(
    box([d.width - 0.1, 0.09, d.depth - 0.1], "#a48252", [
      0,
      -d.thickness - 0.04,
      0,
    ]),
  );
  for (const x of [-2.95, 2.95])
    for (const z of [-1.35, 1.35]) {
      root.add(
        box([0.19, d.height - d.thickness, 0.19], "#9b784e", [
          x,
          -(d.height + d.thickness) / 2,
          z,
        ]),
      );
    }
  root.add(box([5.9, 0.18, 0.12], "#a38459", [0, -1.65, -1.35]));
  return root;
}

export function createProps(desk: THREE.Group): LooseProp[] {
  const props: LooseProp[] = [];
  const add = (
    object: THREE.Group,
    position: [number, number, number],
    halfSize: [number, number, number],
    mass = 0.2,
  ) => {
    object.position.set(...position);
    desk.add(object);
    props.push({ object, halfSize, mass });
    return object;
  };
  const book = new THREE.Group();
  book.add(box([1.05, 0.15, 1.42], "#eee9d2", [0, 0, 0]));
  book.add(box([1.1, 0.03, 1.46], "#6c7c50", [0, 0.09, 0]));
  book.add(box([1.1, 0.03, 1.46], "#6c7c50", [0, -0.09, 0]));
  const cover = mesh(
    new THREE.PlaneGeometry(0.8, 0.5),
    new THREE.MeshStandardMaterial({
      map: labelTexture("NOT TODAY.", "#e4e8c8", "#6c7c50"),
    }),
    [0, 0.108, 0],
  );
  cover.rotation.x = -Math.PI / 2;
  book.add(cover);
  book.scale.setScalar(0.6);
  add(book, [-3.05, 0.09, 0.65], [0.33, 0.066, 0.44], 0.4).rotation.y = 0.08;

  const eraser = new THREE.Group();
  eraser.add(box([0.45, 0.14, 0.24], "#d8b5a3", [0, 0, 0]));
  eraser.add(box([0.25, 0.145, 0.245], "#f4eed8", [0, 0, 0]));
  add(eraser, [-3.05, 0.1, 1.4], [0.23, 0.08, 0.13]).rotation.y = -0.2;
  for (let i = 0; i < 2; i++) {
    const pencil = new THREE.Group();
    const shaft = mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6),
      material(i ? "#b58b52" : "#67764d"),
    );
    shaft.rotation.x = Math.PI / 2;
    pencil.add(shaft);
    const tip = mesh(
      new THREE.ConeGeometry(0.035, 0.16, 6),
      material("#d8c8a5"),
      [0, 0, -0.63],
    );
    tip.rotation.x = -Math.PI / 2;
    pencil.add(tip);
    add(
      pencil,
      [-3.15 + i * 0.23, 0.05, -0.1],
      [0.045, 0.045, 0.65],
      0.08,
    ).rotation.y = -0.3 + i * 0.22;
  }
  const lamp = new THREE.Group();
  lamp.add(
    mesh(
      new THREE.CylinderGeometry(0.43, 0.47, 0.08, 24),
      material("#7d8e57"),
      [0, 0.05, 0],
    ),
  );
  const stem = mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.25, 10),
    material("#77864f"),
    [-0.08, 0.67, 0],
  );
  stem.rotation.z = 0.14;
  lamp.add(stem);
  const hood = mesh(
    new THREE.ConeGeometry(0.5, 0.43, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: "#83935e",
      side: THREE.DoubleSide,
    }),
    [0.13, 1.44, 0],
  );
  lamp.add(hood);
  lamp.add(
    mesh(
      new THREE.CircleGeometry(0.47, 24),
      new THREE.MeshStandardMaterial({
        color: "#fff3b6",
        emissive: "#e5c66d",
        emissiveIntensity: 0.35,
        side: THREE.DoubleSide,
      }),
      [0.13, 1.225, 0],
    ),
  );
  lamp.children[lamp.children.length - 1].rotation.x = -Math.PI / 2;
  add(lamp, [-3.1, 0.01, -1.15], [0.48, 0.8, 0.48], 1.2);

  const note = new THREE.Group();
  const noteMesh = mesh(
    new THREE.PlaneGeometry(0.9, 0.87),
    new THREE.MeshStandardMaterial({
      color: "#d4e67e",
      side: THREE.DoubleSide,
    }),
  );
  noteMesh.rotation.x = -Math.PI / 2;
  note.add(noteMesh);
  note.scale.setScalar(0.5);
  add(note, [3.15, 0.025, -1.4], [0.225, 0.012, 0.22], 0.02).rotation.y = -0.13;
  return props;
}
