import { advancePaper, CRUMPLE_STEPS, MAX_SUBJECTS, normalizeSubject } from "./rules.mjs";
import type { GameEvent, GameSnapshot, PaperState, Phase, StateListener } from "./types";

/** Direct actions and state only; no DOM, timers, or 3D engine. */
export class GameStore {
  private subjects: string[];
  private papers: PaperState[] = [];
  private selected = 0;
  private phase: Phase = "setup";
  private listeners = new Set<StateListener>();

  constructor(subjects: string[]) {
    this.subjects = [...subjects];
    this.resetPapers();
  }

  get snapshot(): GameSnapshot {
    return {
      subjects: [...this.subjects],
      papers: this.papers.map((paper) => ({ ...paper })),
      selected: this.selected,
      phase: this.phase,
    };
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GameEvent) {
    const state = this.snapshot;
    this.listeners.forEach((listener) => listener(state, event));
  }

  addSubject(raw: string): string | null {
    const name = normalizeSubject(raw);
    if (!name) return "과목 이름을 먼저 적어줘.";
    if (this.subjects.includes(name)) return "이미 책상에 올려놓은 과목이야.";
    if (this.subjects.length >= MAX_SUBJECTS)
      return `한 번에 ${MAX_SUBJECTS}과목까지 올릴 수 있어.`;
    this.subjects.push(name);
    this.resetPapers();
    this.emit({ type: "subjects" });
    return null;
  }

  removeSubject(index: number) {
    if (!this.subjects[index]) return;
    this.subjects.splice(index, 1);
    this.resetPapers();
    this.emit({ type: "subjects" });
  }

  reset() {
    this.resetPapers();
    this.emit({ type: "reset" });
  }

  private resetPapers() {
    this.selected = 0;
    this.phase = this.subjects.length ? "playing" : "setup";
    this.papers = this.subjects.map((name, id) => ({
      id, name, mode: "", progress: 0, done: false,
    }));
  }

  select(index: number) {
    if (this.phase !== "playing" || !this.papers[index] || this.selected === index) return;
    this.selected = index;
    this.emit({ type: "select" });
  }

  crumple(index: number): boolean {
    const paper = this.available(index);
    if (!paper) return false;
    for (let step = 0; step < CRUMPLE_STEPS; step++) advancePaper(paper, "crumple");
    this.emit({ type: "process", paperId: index });
    return true;
  }

  beginShred(index: number): boolean {
    const paper = this.available(index);
    if (!paper || this.papers.some((p) => p.mode === "shred" && !p.done)) return false;
    paper.mode = "shred";
    this.emit({ type: "process", paperId: index });
    return true;
  }

  shredStep(index: number): boolean {
    const paper = this.papers[index];
    if (this.phase !== "playing" || !paper || paper.mode !== "shred" || paper.done) return false;
    advancePaper(paper, "shred");
    this.emit({ type: "process", paperId: index });
    return true;
  }

  private available(index: number) {
    const paper = this.papers[index];
    return this.phase === "playing" && paper && !paper.done && paper.mode === "" ? paper : null;
  }

  flip(): boolean {
    if (this.phase !== "playing") return false;
    this.phase = "flipped";
    this.papers.forEach((paper) => { paper.done = true; });
    this.emit({ type: "flip" });
    return true;
  }
}
