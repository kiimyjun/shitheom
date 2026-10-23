import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { SCENE } from "../config";
import { disposeObject } from "../three/utils";

type DynamicObject = {
  object: THREE.Object3D;
  body: RAPIER.RigidBody;
  debris: boolean;
  age: number;
};

/** Rapier is isolated here. Renderers and UI do not manipulate physics bodies directly. */
export class PhysicsSystem {
  private world: RAPIER.World;
  private objects: DynamicObject[] = [];
  private deskBody?: RAPIER.RigidBody;
  private accumulator = 0;

  static async create() {
    await RAPIER.init();
    return new PhysicsSystem();
  }

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(25, 0.05, 25)
        .setTranslation(0, -0.05, 0)
        .setFriction(0.8),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.82, 0.95, 0.64).setTranslation(4.4, 0.95, 0),
    );
  }

  createDesk(object: THREE.Group) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        ...(object.position.toArray() as [number, number, number]),
      ),
    );
    const d = SCENE.desk;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(d.width / 2, d.thickness / 2, d.depth / 2)
        .setTranslation(0, -d.thickness / 2, 0)
        .setMass(9)
        .setFriction(0.65),
      body,
    );
    for (const x of [-2.95, 2.95])
      for (const z of [-1.35, 1.35]) {
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.095, (d.height - d.thickness) / 2, 0.095)
            .setTranslation(x, -(d.height + d.thickness) / 2, z)
            .setMass(0.4),
          body,
        );
      }
    this.deskBody = body;
    this.objects.push({ object, body, debris: false, age: 0 });
  }

  moveDesk(position: THREE.Vector3, quaternion: THREE.Quaternion) {
    this.deskBody?.setNextKinematicTranslation(position);
    this.deskBody?.setNextKinematicRotation(quaternion);
  }

  releaseDesk() {
    const body = this.deskBody;
    if (!body) return;
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.setLinvel({ x: 0, y: 0.5, z: -1.8 }, true);
    body.setAngvel({ x: -0.7, y: 0.05, z: 0.04 }, true);
    body.setLinearDamping(0.35);
    body.setAngularDamping(0.75);
  }

  addBox(
    object: THREE.Object3D,
    halfSize: [number, number, number],
    mass = 0.1,
    debris = false,
  ) {
    const body = this.createBody(object, debris);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(...halfSize)
        .setMass(mass)
        .setFriction(0.7)
        .setRestitution(0.18),
      body,
    );
    return body;
  }

  addPaperBall(object: THREE.Object3D) {
    const body = this.createBody(object, false);
    this.world.createCollider(
      RAPIER.ColliderDesc.ball(0.25)
        .setTranslation(0, 0, 0.26)
        .setMass(0.06)
        .setRestitution(0.32),
      body,
    );
    return body;
  }

  private createBody(object: THREE.Object3D, debris: boolean) {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(object.position.x, object.position.y, object.position.z)
        .setRotation(object.quaternion)
        .setLinearDamping(debris ? 0.8 : 0.4)
        .setAngularDamping(0.6)
        .setCcdEnabled(true),
    );
    this.objects.push({ object, body, debris, age: 0 });
    const pieces = this.objects.filter((item) => item.debris);
    if (pieces.length > SCENE.maxDebris) this.remove(pieces[0], true);
    return body;
  }

  has(object: THREE.Object3D) {
    return this.objects.some((item) => item.object === object);
  }

  throwObject(
    object: THREE.Object3D,
    halfSize: [number, number, number],
    mass = 0.1,
  ) {
    let entry = this.objects.find((item) => item.object === object);
    const body = entry?.body ?? this.addBox(object, halfSize, mass);
    body.setLinvel(
      {
        x: (Math.random() - 0.5) * 3.5,
        y: 3.1 + Math.random() * 2.1,
        z: -1.4 - Math.random() * 2.5,
      },
      true,
    );
    body.setAngvel(
      {
        x: (Math.random() - 0.5) * 5,
        y: (Math.random() - 0.5) * 5,
        z: (Math.random() - 0.5) * 5,
      },
      true,
    );
  }

  update(dt: number) {
    this.accumulator = Math.min(this.accumulator + dt, 0.1);
    while (this.accumulator >= 1 / 60) {
      this.world.step();
      this.accumulator -= 1 / 60;
    }
    for (const item of [...this.objects]) {
      item.age += dt;
      const position = item.body.translation();
      const rotation = item.body.rotation();
      item.object.position.set(position.x, position.y, position.z);
      item.object.quaternion.set(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w,
      );
      if (item.debris && (item.age > 9 || position.y < -8))
        this.remove(item, true);
    }
  }

  private remove(item: DynamicObject, dispose: boolean) {
    this.world.removeRigidBody(item.body);
    this.objects = this.objects.filter((entry) => entry !== item);
    if (dispose) disposeObject(item.object);
  }

  reset() {
    for (const item of [...this.objects]) this.remove(item, item.debris);
    this.deskBody = undefined;
    this.accumulator = 0;
  }

  dispose() {
    this.reset();
    this.world.free();
  }
}
