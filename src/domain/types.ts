export type Mode = "crumple" | "shred" | "flip";
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
  mode: Mode;
  phase: Phase;
}
export type GameEvent =
  | "subjects"
  | "start"
  | "edit"
  | "reset"
  | "select"
  | "mode"
  | "process"
  | "flip";
export type StateListener = (snapshot: GameSnapshot, event: GameEvent) => void;
