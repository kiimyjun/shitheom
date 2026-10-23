import * as THREE from "three";

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number] = [0, 0, 0],
) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}
export function material(color: THREE.ColorRepresentation, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}
export function box(
  size: [number, number, number],
  color: THREE.ColorRepresentation,
  position: [number, number, number],
) {
  return mesh(new THREE.BoxGeometry(...size), material(color), position);
}
export function seeded(seed: number) {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
export function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Sprite))
      return;
    if ("geometry" in object) geometries.add(object.geometry);
    const list = Array.isArray(object.material)
      ? object.material
      : [object.material];
    list.forEach((mat) => {
      materials.add(mat);
      Object.values(mat).forEach((value) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });
  geometries.forEach((value) => value.dispose());
  materials.forEach((value) => value.dispose());
  textures.forEach((value) => value.dispose());
  root.removeFromParent();
}
export function labelTexture(
  text: string,
  color = "#53623c",
  background = "#edf1cf",
  width = 512,
  height = 256,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${height * 0.28}px "Noto Sans KR", sans-serif`;
  const lines = text.split("\n");
  lines.forEach((line, index) =>
    ctx.fillText(
      line,
      width / 2,
      height / 2 + (index - (lines.length - 1) / 2) * height * 0.35,
      width * 0.86,
    ),
  );
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
