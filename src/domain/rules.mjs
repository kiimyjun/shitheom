export const HOLD_MS = 1500;
export const CRUMPLE_STEPS = 6;
export const SHRED_STEPS = 8;
export const MAX_SUBJECTS = 8;
export function normalizeSubject(value) {
  return String(value).trim().replace(/\s+/g, " ").slice(0, 24);
}
export function chargeProgress(start, now) {
  return start === null ? 0 : Math.min(1, Math.max(0, (now - start) / HOLD_MS));
}
export function canFlip(start, now) {
  return start !== null && now - start >= HOLD_MS;
}
export function advancePaper(paper, mode) {
  if (paper.done || !["crumple", "shred"].includes(mode)) return false;
  if (paper.mode !== mode) {
    paper.mode = mode;
    paper.progress = 0;
  }
  const steps = mode === "crumple" ? CRUMPLE_STEPS : SHRED_STEPS;
  paper.progress = Math.min(steps, paper.progress + 1);
  paper.done = paper.progress === steps;
  return true;
}
