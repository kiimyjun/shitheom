import { HOLD_MS } from "../domain/rules.mjs";
import { GameStore } from "../domain/GameStore";
import type { GameEvent, GameSnapshot } from "../domain/types";
import { InteractionController } from "../input/InteractionController";
import { GameAudio } from "../services/audio";
import { loadMuted, loadSubjects, saveMuted, saveSubjects } from "../services/storage";
import { World3D } from "../three/World3D";
import { GameUI } from "../ui/GameUI";

const SHRED_ALIGN_MS = 450;
const SHRED_STEP_MS = 170;

/** Connects direct actions, state, view, sound, and the 3D scene. */
export class GameController {
  private store = new GameStore(loadSubjects());
  private ui: GameUI;
  private audio = new GameAudio();
  private world?: World3D;
  private input?: InteractionController;
  private unsubscribe: () => void;
  private charged = false;
  private disposed = false;
  private shredTimer = 0;

  constructor(root: HTMLElement) {
    this.audio.muted = loadMuted();
    this.ui = new GameUI(root, {
      addSubject: (name) => this.store.addSubject(name),
      removeSubject: (index) => this.store.removeSubject(index),
      reset: () => {
        this.store.reset();
        this.ui.toast("새 시험지 준비완료");
      },
      sound: () => this.toggleSound(),
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
      if (this.disposed) { this.world.dispose(); return; }
      this.world.rebuild(this.store.snapshot.subjects);
      this.world.layout(this.store.snapshot);
      this.input = new InteractionController(this.ui.stage, {
        enabled: () => this.store.snapshot.phase === "playing",
        pick: (x, y) => this.world?.pick(x, y) ?? null,
        select: (id) => this.store.select(id),
        crumple: (id) => this.store.crumple(id),
        dragStart: (id, x, y) => {
          this.world?.beginDrag(id, x, y);
          this.ui.setDrag(true);
        },
        dragMove: (x, y) => {
          const over = this.world?.moveDrag(x, y) ?? false;
          this.ui.setDrag(true, over, over && this.shredderBusy());
        },
        dragEnd: (x, y) => {
          const id = this.world?.endDrag(x, y, !this.shredderBusy());
          this.ui.setDrag(false);
          if (id !== undefined && id !== null) this.shred(id);
        },
        dragCancel: () => { this.world?.cancelDrag(); this.ui.setDrag(false); },
        hover: (x, y) => this.world?.hover(x, y),
        charge: (progress, holding) => this.onCharge(progress, holding),
        release: (ready) => {
          if (ready) this.store.flip();
          else this.ui.toast(`조금만 더 꾹! ${HOLD_MS / 1000}초를 채운 뒤 놓아 봐.`);
        },
      });
      this.world.onCameraChange = (manual) => this.ui.setCameraState(manual);
      this.ui.setReady();
    } catch (error) {
      console.error("3D initialization failed:", error);
      this.ui.showFailure();
    }
  }

  private onStateChange = (state: GameSnapshot, event: GameEvent) => {
    if (["subjects", "reset", "flip"].includes(event.type)) {
      this.input?.cancel();
      clearTimeout(this.shredTimer);
    }
    if (event.type === "subjects" || event.type === "reset") {
      if (event.type === "subjects") saveSubjects(state.subjects);
      this.world?.rebuild(state.subjects);
      this.world?.layout(state);
    }
    if (event.type === "select") this.world?.layout(state);
    if (event.type === "process") {
      const paper = state.papers[event.paperId];
      this.world?.processPaper(paper);
      if (paper.progress > 0) this.audio.play(paper.mode === "crumple" ? "crumple" : "shred");
      if (paper.done) {
        this.audio.play("done");
        this.ui.toast(`${paper.name}, 처리 완료. 수고했어!`);
      }
    }
    if (event.type === "flip") {
      this.world?.flip();
      this.audio.play("flip");
      this.ui.toast("시험보느라 수고했어");
    }
    this.ui.render(state);
  };

  private shredderBusy() {
    return this.store.snapshot.papers.some((paper) => paper.mode === "shred" && !paper.done);
  }

  private shred(id: number) {
    if (!this.store.beginShred(id)) return;
    const step = () => {
      if (!this.store.shredStep(id)) return;
      if (!this.store.snapshot.papers[id].done)
        this.shredTimer = window.setTimeout(step, SHRED_STEP_MS);
    };
    this.shredTimer = window.setTimeout(step, SHRED_ALIGN_MS);
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
    clearTimeout(this.shredTimer);
    this.input?.dispose();
    this.unsubscribe();
    this.ui.dispose();
    this.world?.dispose();
    this.audio.dispose();
  }
}
