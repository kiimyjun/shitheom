import { advancePaper, MAX_SUBJECTS, normalizeSubject } from "./rules.mjs";
import type {
  GameEvent,
  GameSnapshot,
  Mode,
  PaperState,
  Phase,
  StateListener,
} from "./types";

/** Game rules live here. This class never imports the DOM or the 3D engine. */
export class GameStore {
  private subjects: string[];
  private papers: PaperState[] = [];
  private selected = 0;
  private mode: Mode = "crumple";
  private phase: Phase = "setup";
  private listeners = new Set<StateListener>();

  constructor(subjects: string[]) {
    this.subjects = [...subjects];
  }

  get snapshot(): GameSnapshot {
    return {
      subjects: [...this.subjects],
      papers: this.papers.map((p) => ({ ...p })),
      selected: this.selected,
      mode: this.mode,
      phase: this.phase,
    };
  }

  subscribe(listener: StateListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GameEvent) {
    const snapshot = this.snapshot;
    this.listeners.forEach((listener) => listener(snapshot, event));
  }

  addSubject(raw: string): string | null {
    if (this.phase !== "setup") return "과목 수정 화면에서 추가해 줘.";
    const name = normalizeSubject(raw);
    if (!name) return "과목 이름을 먼저 적어줘.";
    if (this.subjects.includes(name)) return "이미 책상에 올려놓은 과목이야.";
    if (this.subjects.length >= MAX_SUBJECTS)
      return `한 번에 ${MAX_SUBJECTS}과목까지 올릴 수 있어.`;
    this.subjects.push(name);
    this.emit("subjects");
    return null;
  }

  removeSubject(index: number) {
    if (this.phase !== "setup") return;
    this.subjects.splice(index, 1);
    this.emit("subjects");
  }

  start() {
    if (!this.subjects.length) return;
    this.resetPapers();
    this.phase = "playing";
    this.emit("start");
  }

  edit() {
    this.phase = "setup";
    this.emit("edit");
  }

  reset() {
    if (this.phase === "setup") return;
    this.resetPapers();
    this.phase = "playing";
    this.emit("reset");
  }

  private resetPapers() {
    this.selected = 0;
    this.papers = this.subjects.map((name, id) => ({
      id,
      name,
      mode: "",
      progress: 0,
      done: false,
    }));
  }

  select(index: number) {
    if (this.phase !== "playing" || !this.papers[index]) return;
    this.selected = index;
    this.emit("select");
  }

  setMode(mode: Mode) {
    this.mode = mode;
    this.emit("mode");
  }

  process(): boolean {
    if (this.phase !== "playing" || this.mode === "flip") return false;
    const paper = this.papers[this.selected];
    if (!paper || !advancePaper(paper, this.mode)) return false;
    this.emit("process");
    return true;
  }

  flip(): boolean {
    if (this.phase !== "playing" || this.mode !== "flip") return false;
    this.phase = "flipped";
    this.papers.forEach((paper) => {
      paper.done = true;
    });
    this.emit("flip");
    return true;
  }
}
