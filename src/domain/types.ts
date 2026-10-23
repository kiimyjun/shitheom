export type Phase = "setup" | "playing" | "flipped";
export interface PaperState {
  id: number;
  name: string;
  mode: "" | "crumple" | "shred";
  progress: number;
  done: boolean;
}
export interface GameSnapshot {
  subjects: readonly string[];
  papers: readonly PaperState[];
  selected: number;
  phase: Phase;
}
export type GameEvent =
  | { type: "subjects" | "reset" | "select" | "flip" }
  | { type: "process"; paperId: number };
export type StateListener = (snapshot: GameSnapshot, event: GameEvent) => void;
