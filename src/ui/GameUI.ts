import type { GameSnapshot, Mode } from "../domain/types";
import { CRUMPLE_STEPS, HOLD_MS, SHRED_STEPS } from "../domain/rules.mjs";
import { svg } from "./icons";
import { template } from "./template";

export interface UIActions {
  addSubject(name: string): string | null;
  removeSubject(index: number): void;
  start(): void;
  edit(): void;
  reset(): void;
  select(index: number): void;
  mode(mode: Mode): void;
  sound(): void;
  camera(): void;
  navigateCamera(): void;
  resetCamera(): void;
}

/** HTML controls and text. This view has no dependency on Three.js or Rapier. */
export class GameUI {
  readonly stage: HTMLElement;
  private ready = false;
  private cameraNavigation = false;
  private toastTimer = 0;
  private lastState?: GameSnapshot;

  constructor(
    private root: HTMLElement,
    private actions: UIActions,
  ) {
    root.innerHTML = template;
    this.stage = this.get("#game-stage");
    this.bindActions();
  }

  private get<T extends HTMLElement = HTMLElement>(selector: string): T {
    return this.root.querySelector<T>(selector)!;
  }

  private bindActions() {
    const input = this.get<HTMLInputElement>("#subject-input");
    const add = (raw: string) => {
      const error = this.actions.addSubject(raw);
      this.get("#form-feedback").textContent =
        error ?? `${raw.trim()}, 준비 완료.`;
      if (!error) input.value = "";
      input.focus();
    };
    this.get("#subject-form").addEventListener("submit", (event) => {
      event.preventDefault();
      add(input.value);
    });
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-add]")
      .forEach((button) => (button.onclick = () => add(button.dataset.add!)));
    this.get("#start-button").onclick = () => {
      this.actions.start();
      this.focusStage();
    };
    this.get("#edit-subjects").onclick = () => this.actions.edit();
    this.get("#reset-button").onclick = () => {
      this.actions.reset();
      this.focusStage();
    };
    this.get("#sound-toggle").onclick = () => this.actions.sound();
    this.get("#camera-navigation").onclick = () => {
      this.actions.navigateCamera();
      this.focusStage();
    };
    this.get("#camera-reset").onclick = () => {
      this.actions.resetCamera();
      this.focusStage();
    };
    this.get("#camera-button").onclick = () => {
      this.actions.camera();
      this.focusStage();
    };
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-mode]")
      .forEach((button) => {
        button.onclick = () => {
          this.actions.mode(button.dataset.mode as Mode);
          if (this.lastState?.phase !== "setup") this.focusStage();
        };
      });
  }

  private focusStage() {
    this.stage.focus({ preventScroll: true });
  }

  setReady() {
    this.ready = true;
    this.get("#loading-screen").hidden = true;
    if (this.lastState) this.render(this.lastState);
  }

  showFailure() {
    const loading = this.get("#loading-screen");
    loading.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = "3D 화면을 시작하지 못했어.";
    const detail = document.createElement("p");
    detail.textContent = "최신 브라우저에서 다시 열어 봐.";
    const retry = document.createElement("button");
    retry.textContent = "다시 시도";
    retry.type = "button";
    retry.onclick = () => location.reload();
    loading.append(title, detail, retry);
  }

  render(state: GameSnapshot) {
    this.lastState = state;
    const setup = state.phase === "setup";
    this.get("#setup-panel").hidden = !setup;
    this.get("#play-panel").hidden = setup;
    this.get<HTMLButtonElement>("#start-button").disabled =
      !this.ready || !state.subjects.length;
    this.get<HTMLButtonElement>("#reset-button").disabled =
      setup || !this.ready;
    this.get("#stage-label").textContent = setup
      ? "시험지 준비 중"
      : state.phase === "flipped"
        ? "오늘은 여기까지."
        : "마음껏 해도 괜찮아";
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-mode]")
      .forEach((button) => {
        const selected = button.dataset.mode === state.mode;
        button.classList.toggle("active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    if (setup) this.renderSubjects(state);
    else this.renderPapers(state);
    this.renderHint(state);
  }

  private renderSubjects(state: GameSnapshot) {
    const list = this.get("#subject-chips");
    list.replaceChildren();
    state.subjects.forEach((name, index) => {
      const chip = document.createElement("span");
      chip.className = "subject-chip";
      const label = document.createElement("span");
      label.textContent = name;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "×";
      button.setAttribute("aria-label", `${name} 삭제`);
      button.onclick = () => this.actions.removeSubject(index);
      chip.append(label, button);
      list.append(chip);
    });
    if (!state.subjects.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "아직 올려놓은 시험지가 없어.";
      list.append(empty);
    }
  }

  private renderPapers(state: GameSnapshot) {
    const list = this.get("#paper-selector");
    list.replaceChildren();
    state.papers.forEach((paper, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `paper-option${index === state.selected ? " selected" : ""}${paper.done ? " done" : ""}`;
      button.setAttribute("aria-pressed", String(index === state.selected));
      const number = document.createElement("span");
      number.className = "paper-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.textContent = paper.name;
      const status = document.createElement("span");
      status.className = "paper-check";
      status.textContent = paper.done ? "✓" : "↗";
      button.append(number, name, status);
      button.onclick = () => {
        this.actions.select(index);
        this.focusStage();
      };
      list.append(button);
    });
    this.get("#done-count").textContent =
      `${state.papers.filter((p) => p.done).length} / ${state.papers.length}`;
  }

  private renderHint(state: GameSnapshot) {
    const title = this.get("#hint-title");
    const detail = this.get("#hint-detail");
    const step = this.get("#step-count");
    this.get("#hint-icon").innerHTML = svg(
      state.phase === "setup" ? "paper" : state.mode,
    );
    if (this.cameraNavigation) {
      title.textContent = "원하는 각도로 책상을 둘러봐.";
      detail.textContent =
        "드래그로 회전 · 휠로 확대/축소 · ‘게임 조작’으로 돌아가기";
      step.textContent = "VIEW";
      return;
    }
    if (state.phase === "setup") {
      title.textContent = "오늘 본 시험, 여기에 올려놓자.";
      detail.textContent = "과목을 추가하고 3D 책상에 앉아 봐.";
      step.textContent = "READY?";
      return;
    }
    if (state.phase === "flipped") {
      title.textContent = "그래. 오늘은 이 정도면 됐어.";
      detail.textContent = "다시 하고 싶으면 책상을 새로 세팅해.";
      step.textContent = "후련!";
      return;
    }
    const paper = state.papers[state.selected];
    if (state.mode === "flip") {
      title.textContent = "스페이스바를 꾹. 준비되면 놓아.";
      detail.textContent = `${HOLD_MS / 1000}초 이상 누른 뒤 놓으면 책상이 뒤집혀.`;
      step.textContent = "HOLD SPACE";
    } else if (paper.done) {
      title.textContent = `${paper.name}, 처리 끝.`;
      detail.textContent = "다른 시험지를 고르거나 책상을 엎어 봐.";
      step.textContent = "CLEAR";
    } else {
      title.textContent =
        state.mode === "crumple"
          ? "화면을 클릭해서 구겨 버려."
          : "화면을 클릭해서 갈아 버려.";
      detail.textContent = `선택한 과목: ${paper.name} · 클릭할 때마다 진행돼.`;
      step.textContent = `${paper.mode === state.mode ? paper.progress : 0} / ${state.mode === "crumple" ? CRUMPLE_STEPS : SHRED_STEPS}`;
    }
  }

  setCharge(progress: number, holding: boolean) {
    this.get("#charge-overlay").hidden = !holding;
    this.get("#charge-fill").style.width = `${progress * 100}%`;
    this.get("#charge-label").textContent =
      progress >= 1
        ? "준비됐어. 손을 떼!"
        : `꾹… ${((progress * HOLD_MS) / 1000).toFixed(1)} / ${HOLD_MS / 1000}초`;
    this.get("#charge-overlay").classList.toggle("charged", progress >= 1);
  }

  setMuted(muted: boolean) {
    const button = this.get("#sound-toggle");
    button.innerHTML = `${svg(muted ? "mute" : "sound")}<span>소리 ${muted ? "OFF" : "ON"}</span>`;
    button.setAttribute("aria-pressed", String(!muted));
  }

  setCameraState(manual: boolean, navigating: boolean) {
    this.cameraNavigation = navigating;
    if (this.lastState) this.renderHint(this.lastState);
    const button = this.get("#camera-navigation");
    button.setAttribute("aria-pressed", String(navigating));
    button.textContent = navigating ? "✓ 게임 조작" : "↔ 시점 이동";
    this.stage.classList.toggle("camera-navigation", navigating);
    this.get("#camera-help").hidden = !navigating;
    this.get(".scene-tag").textContent = manual
      ? "자유 시점 · 우클릭 드래그 / 휠 확대·축소"
      : "우클릭 드래그로 둘러보기 · 휠로 확대·축소";
  }

  setCamera(wide: boolean) {
    this.get("#camera-button").textContent = wide
      ? "↙ 책상 앞으로"
      : "↗ 전체 보기";
  }

  toast(message: string) {
    const toast = this.get("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(
      () => toast.classList.remove("visible"),
      2400,
    );
  }

  dispose() {
    clearTimeout(this.toastTimer);
  }
}
