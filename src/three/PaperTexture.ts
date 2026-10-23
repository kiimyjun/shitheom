import * as THREE from "three";

/** Generates each subject's print locally, including long and Korean names. */
export function createPaperTexture(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 704;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fffdf0";
  ctx.fillRect(0, 0, 512, 704);
  ctx.strokeStyle = "#dedfce";
  ctx.strokeRect(18, 18, 476, 668);
  ctx.fillStyle = "#69715b";
  ctx.font = '500 20px "Noto Sans KR", sans-serif';
  ctx.fillText("2026학년도 · 중간고사", 47, 63);
  ctx.fillStyle = "#303c2a";
  ctx.font = '900 47px "Noto Sans KR", sans-serif';
  if (name.length > 12) {
    ctx.font = '900 34px "Noto Sans KR", sans-serif';
    ctx.fillText(name.slice(0, 12), 46, 121, 420);
    ctx.fillText(name.slice(12), 46, 164, 420);
  } else ctx.fillText(name, 46, 136, 420);
  ctx.fillStyle = "#969e87";
  ctx.font = '17px "Noto Sans KR", sans-serif';
  ctx.fillText("학번 ______________    이름 __________", 46, 200);
  ctx.strokeStyle = "#9aa58b";
  ctx.beginPath();
  ctx.moveTo(46, 220);
  ctx.lineTo(466, 220);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const y = 265 + i * 90;
    ctx.fillStyle = "#68745b";
    ctx.font = "700 19px sans-serif";
    ctx.fillText(`${i + 1}.`, 48, y);
    ctx.fillStyle = "#b1baa2";
    ctx.fillRect(82, y - 10, 330 - i * 13, 4);
    ctx.fillRect(82, y + 4, 253 + i * 19, 3);
    for (let j = 0; j < 4; j++) {
      ctx.strokeStyle = "#9da98e";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(90 + j * 94, y + 40, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#b7bfa8";
      ctx.fillRect(106 + j * 94, y + 38, 48, 3);
    }
  }
  ctx.fillStyle = "#a7af99";
  ctx.font = "15px monospace";
  ctx.fillText("YOU DID YOUR BEST.", 46, 661);
  ctx.fillText("1 / 1", 419, 661);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
