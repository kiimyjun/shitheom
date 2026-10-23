import type { GameSnapshot } from "../domain/types";
import { CRUMPLE_STEPS, HOLD_MS } from "../domain/rules.mjs";
import { svg } from "./icons";
import { template } from "./template";

export interface UIActions {
  addSubject(name: string): string | null;
  removeSubject(index: number): void;
  reset(): void;
  sound(): void;
  camera(): void;
  resetCamera(): void;
}

/** Floating HTML controls; no dependency on the 3D engine. */
export class GameUI {
  readonly stage: HTMLElement;
  private ready = false;
  private toastTimer = 0;
  private lastState?: GameSnapshot;
  private subjectsKey = "";

  constructor(private root: HTMLElement, private actions: UIActions) {
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
      this.get("#form-feedback").textContent = error ?? `${raw.trim()}, 책상에 올려놨어.`;
      if (!error) input.value = "";
      input.focus();
    };
    this.get("#subject-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.ready) add(input.value);
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-add]")
      .forEach((button) => (button.onclick = () => add(button.dataset.add!)));
    this.get("#panel-toggle").onclick = () => {
      const button = this.get("#panel-toggle");
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      button.setAttribute("aria-label", `시험지 설정 ${open ? "접기" : "펼치기"}`);
      this.get("#panel-body").hidden = !open;
      this.get("#desk-panel").classList.toggle("collapsed", !open);
      if (open) input.focus();
      else this.focusStage();
    };
    this.get("#reset-button").onclick = () => {
      this.actions.reset();
      this.focusStage();
    };
    this.get("#sound-toggle").onclick = () => { this.actions.sound(); this.focusStage(); };
    this.get("#camera-reset").onclick = () => {
      this.actions.resetCamera();
      this.focusStage();
    };
    this.get("#camera-button").onclick = () => {
      this.actions.camera();
      this.focusStage();
    };
  }

  private focusStage() { this.stage.focus({ preventScroll: true }); }

  setReady() {
    this.ready = true;
    this.get("#loading-screen").hidden = true;
    if (this.lastState) this.render(this.lastState);
    if (matchMedia("(max-width: 600px)").matches && this.lastState?.subjects.length) {
      this.get("#panel-toggle").setAttribute("aria-expanded", "false");
      this.get("#panel-toggle").setAttribute("aria-label", "시험지 설정 펼치기");
      this.get("#panel-body").hidden = true;
      this.get("#desk-panel").classList.add("collapsed");
    }
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
    this.get<HTMLButtonElement>("#reset-button").disabled = !this.ready || !state.subjects.length;
    this.get<HTMLInputElement>("#subject-input").disabled = !this.ready;
    this.root.querySelectorAll<HTMLButtonElement>("[data-add], [type=submit]")
      .forEach((button) => { button.disabled = !this.ready; });
    const done = state.papers.filter((paper) => paper.done).length;
    this.get("#panel-summary").textContent = state.subjects.length ? `시험지 ${state.subjects.length}장` : "책상 준비";
    this.get("#done-count").textContent = `${done} / ${state.subjects.length} 처리`;
    this.get("#stage-label").textContent = state.phase === "flipped"
      ? "시원하다. 이제 좀 살겠네." : "오늘도 시험 보느라 수고했어.";
    // Keep delete buttons stable while a pointer is interacting with the panel.
    const key = JSON.stringify([state.subjects, state.papers.map((paper) => paper.done)]);
    if (this.subjectsKey !== key) { this.subjectsKey = key; this.renderSubjects(state); }
    this.renderHint(state);
  }

  private renderSubjects(state: GameSnapshot) {
    const list = this.get("#subject-chips");
    list.replaceChildren();
    state.subjects.forEach((name, index) => {
      const chip = document.createElement("span");
      chip.className = `subject-chip${state.papers[index]?.done ? " done" : ""}`;
      const label = document.createElement("span");
      label.textContent = `${state.papers[index]?.done ? "✓ " : ""}${name}`;
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
      empty.textContent = "시험지는 여기 두고, 마음만 가볍게.";
      list.append(empty);
    }
  }

  private renderHint(state: GameSnapshot) {
    const title = this.get("#hint-title");
    const detail = this.get("#hint-detail");
    if (state.phase === "setup") {
      title.textContent = "시험은 끝. 이제 네 차례.";
      detail.textContent = "왼쪽 위에서 과목을 추가해 봐.";
    } else if (state.phase === "flipped") {
      title.textContent = "그래. 오늘은 이 정도면 됐어.";
      detail.textContent = "왼쪽 위에서 책상을 다시 세팅할 수 있어.";
    } else {
      const done = state.papers.filter((paper) => paper.done).length;
      const feeding = state.papers.find((paper) => paper.mode === "shred" && !paper.done);
      const selected = state.papers[state.selected];
      const crumpling = selected?.mode === "crumple" && !selected.done;
      title.textContent = feeding ? `${feeding.name}, 미련까지 갈아 버리는 중…`
        : done === state.papers.length ? "남은 건 책상뿐. 시원하게 엎어 볼까?"
        : crumpling ? `${selected.name}, 조금 더 구겨 버려.`
        : "시험지를 직접 집어 봐.";
      detail.textContent = feeding ? "자동으로 파쇄돼. 잠깐만 기다려 줘."
        : crumpling ? `구기기 ${selected.progress} / ${CRUMPLE_STEPS} · 더블클릭할 때마다 한 단계씩.`
        : `${done} / ${state.papers.length}장 처리 · 점수도, 제한 시간도 없어.`;
    }
  }

  setDrag(active: boolean, over = false, busy = false) {
    const hint = this.get("#drag-hint");
    hint.hidden = !active;
    hint.classList.toggle("over", over && !busy);
    hint.textContent = busy ? "파쇄기 사용 중. 잠깐만 기다려 줘."
      : over ? "여기서 놓으면 드르륵!" : "파쇄기 위로 끌어다 놓아 봐.";
  }

  setCharge(progress: number, holding: boolean) {
    this.get("#charge-overlay").hidden = !holding;
    this.get("#charge-fill").style.width = `${progress * 100}%`;
    this.get("#charge-label").textContent = progress >= 1 ? "준비됐어. 손을 떼!"
      : `꾹… ${((progress * HOLD_MS) / 1000).toFixed(1)} / ${HOLD_MS / 1000}초`;
    this.get("#charge-overlay").classList.toggle("charged", progress >= 1);
  }

  setMuted(muted: boolean) {
    const button = this.get("#sound-toggle");
    button.innerHTML = `${svg(muted ? "mute" : "sound")}<span>소리 ${muted ? "OFF" : "ON"}</span>`;
    button.setAttribute("aria-pressed", String(!muted));
    button.setAttribute("aria-label", muted ? "소리 켜기" : "소리 끄기");
    button.title = muted ? "소리 켜기" : "소리 끄기";
  }
  setCameraState(manual: boolean) {
    this.get("#camera-reset").classList.toggle("manual", manual);
  }
  setCamera(wide: boolean) {
    const button = this.get("#camera-button");
    button.innerHTML = wide ? "↙<span>책상 앞으로</span>" : "↗<span>전체 보기</span>";
    button.setAttribute("aria-label", wide ? "책상 앞으로" : "전체 보기");
  }
  toast(message: string) {
    const toast = this.get("#toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
  }
  dispose() { clearTimeout(this.toastTimer); }
}
