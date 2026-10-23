import { HOLD_MS } from "../domain/rules.mjs";
import { GameStore } from "../domain/GameStore";
import type { GameEvent, GameSnapshot } from "../domain/types";
import { InteractionController } from "../input/InteractionController";
import { GameAudio } from "../services/audio";
import {
  loadMuted,
  loadSubjects,
  saveMuted,
  saveSubjects,
} from "../services/storage";
import { World3D } from "../three/World3D";
import { GameUI } from "../ui/GameUI";

/** Connects state, view, input, sound, and 3D. No geometry is authored in this file. */
export class GameController {
  private store = new GameStore(loadSubjects());
  private ui: GameUI;
  private audio = new GameAudio();
  private world?: World3D;
  private input?: InteractionController;
  private unsubscribe: () => void;
  private charged = false;
  private disposed = false;

  constructor(root: HTMLElement) {
    this.audio.muted = loadMuted();
    this.ui = new GameUI(root, {
      addSubject: (name) => this.store.addSubject(name),
      removeSubject: (index) => this.store.removeSubject(index),
      start: () => {
        if (this.world) this.store.start();
      },
      edit: () => this.store.edit(),
      reset: () => {
        this.store.reset();
        this.ui.toast("새 시험지 준비 완료. 한 번 더?");
      },
      select: (index) => this.store.select(index),
      mode: (mode) => this.store.setMode(mode),
      sound: () => this.toggleSound(),
      navigateCamera: () => this.world?.toggleCameraNavigation(),
      resetCamera: () => {
        this.world?.resetCamera();
        this.ui.setCamera(false);
      },
      camera: () => {
        if (this.world) this.ui.setCamera(this.world.toggleCamera());
      },
    });
    this.ui.setMuted(this.audio.muted);
    this.ui.render(this.store.snapshot);
    this.unsubscribe = this.store.subscribe(this.onStateChange);
  }

  async initialize() {
    try {
      this.world = await World3D.create(this.ui.stage);
      if (this.disposed) {
        this.world.dispose();
        return;
      }
      this.world.rebuild(this.store.snapshot.subjects, true);
      this.input = new InteractionController(this.ui.stage, {
        enabled: () =>
          this.store.snapshot.phase === "playing" &&
          !this.world?.cameraNavigationMode,
        flipMode: () => this.store.snapshot.mode === "flip",
        tap: (x, y) => this.tap(x, y),
        charge: (progress, holding) => this.onCharge(progress, holding),
        release: (ready) => {
          if (ready) this.store.flip();
          else
            this.ui.toast(
              `조금만 더 꾹! ${HOLD_MS / 1000}초를 채운 뒤 놓아 봐.`,
            );
        },
      });
      this.world.onCameraInteraction = () => this.input?.cancel();
      this.world.onCameraChange = (manual, navigating) =>
        this.ui.setCameraState(manual, navigating);
      this.ui.setReady();
    } catch (error) {
      console.error("3D initialization failed:", error);
      this.ui.showFailure();
    }
  }

  private onStateChange = (state: GameSnapshot, event: GameEvent) => {
    if (event !== "process") this.input?.cancel();
    if (["subjects", "start", "edit", "reset"].includes(event)) {
      if (event === "subjects") saveSubjects(state.subjects);
      this.world?.rebuild(state.subjects, state.phase === "setup");
    }
    if (["start", "reset", "select", "mode"].includes(event))
      this.world?.layout(state);
    if (event === "process") {
      const paper = state.papers[state.selected];
      this.world?.processPaper(paper);
      this.audio.play(state.mode === "crumple" ? "crumple" : "shred");
      if (paper.done) {
        this.audio.play("done");
        this.ui.toast(`${paper.name}, 처리 완료. 수고했어!`);
      }
    }
    if (event === "flip") {
      this.world?.flip();
      this.audio.play("flip");
      this.ui.toast("시원하다. 오늘도 시험 보느라 수고했어.");
    }
    this.ui.render(state);
  };

  private tap(x: number, y: number) {
    const state = this.store.snapshot;
    const hit = this.world?.pick(x, y);
    if (hit !== null && hit !== undefined && hit !== state.selected) {
      this.store.select(hit);
      return;
    }
    if (!this.store.process())
      this.ui.toast("이 과목은 처리 끝! 다른 시험지를 골라 봐.");
  }

  private onCharge(progress: number, holding: boolean) {
    this.ui.setCharge(progress, holding);
    this.world?.setCharge(progress);
    if (holding && progress >= 1 && !this.charged) {
      this.charged = true;
      this.audio.play("done");
    }
    if (!holding) this.charged = false;
  }

  private toggleSound() {
    this.audio.muted = !this.audio.muted;
    saveMuted(this.audio.muted);
    this.ui.setMuted(this.audio.muted);
  }

  dispose() {
    this.disposed = true;
    this.input?.dispose();
    this.unsubscribe();
    this.ui.dispose();
    this.world?.dispose();
    this.audio.dispose();
  }
}
