/** Visual tuning is centralized here; gameplay counts live in domain/rules.mjs. */
export const SCENE = {
  desk: { width: 7.2, depth: 3.7, height: 2.55, thickness: 0.2 },
  camera: {
    seated: { position: [3.8, 6.6, 7.7], target: [0, 1.8, -0.1] },
    shred: { position: [6.0, 5.8, 8.4], target: [1.5, 1.6, 0] },
    wide: { position: [7.9, 7.8, 10.6], target: [0, 1.35, -0.6] },
    flipped: { position: [5.6, 5.8, 8.9], target: [0, 1.35, -0.8] },
    fov: 42,
    controls: {
      minDistance: 4.5,
      maxDistance: 18,
      minPolarAngle: 0.28,
      maxPolarAngle: Math.PI / 2 - 0.22,
      maxAzimuthAngle: Math.PI * 0.48,
      maxPanDistance: 2.4,
      rotateSpeed: 0.65,
      zoomSpeed: 0.8,
    },
  },
  paper: { width: 1.45, height: 1.98, segments: 18 },
  maxDebris: 80,
  pixelRatioLimit: 1.75,
  shadows: 2048,
} as const;
