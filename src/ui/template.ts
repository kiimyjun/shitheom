import { svg } from "./icons";
import { HOLD_MS, MAX_SUBJECTS } from "../domain/rules.mjs";

export const template = `
<main class="game-shell" aria-label="시혐지 3D 게임">
  <div id="game-stage" role="application" aria-label="시험지를 더블클릭할 때마다 조금씩 구겨집니다. 시험지를 파쇄기로 끌어놓으면 파쇄됩니다. 빈 공간 드래그로 시점을 움직이고, 스페이스바를 길게 누른 뒤 놓으면 책상이 뒤집힙니다." tabindex="0">
    <div class="loading-screen" id="loading-screen"><span class="loading-spinner"></span><strong>네 책상을 준비하는 중…</strong></div>
  </div>
  <section class="desk-panel" id="desk-panel" aria-label="시험지와 책상 설정">
    <button id="panel-toggle" class="panel-toggle" type="button" aria-expanded="true" aria-controls="panel-body" aria-label="시험지 설정 접기">
      <span class="brand">${svg("paper")}<span>시혐지<span class="brand-dot">.</span></span></span>
      <span class="panel-summary" id="panel-summary">책상 준비</span><span class="fold-icon" aria-hidden="true">⌃</span>
    </button>
    <div id="panel-body" class="panel-body">
      <div class="panel-heading"><span class="eyebrow">YOUR DESK, YOUR RULES</span><span id="done-count">0 / 0</span></div>
      <h1>어떤 시험을 봤어?</h1><p class="panel-description">오늘 본 과목, 여기에 두고 가.</p>
      <form id="subject-form"><label class="sr-only" for="subject-input">시험 과목 이름</label><div class="input-wrap"><input id="subject-input" placeholder="예: 미적분학" maxlength="24" autocomplete="off"/><button type="submit" aria-label="과목 추가">+</button></div></form>
      <p id="form-feedback" class="form-feedback" role="status" aria-live="polite">최대 ${MAX_SUBJECTS}과목 · 추가하면 책상에 바로 올라가.</p>
      <div id="subject-chips" class="subject-chips"></div>
      <div class="quick-add"><button type="button" data-add="미적분학">+ 미적분학</button><button type="button" data-add="전공필수">+ 전공필수</button><button type="button" data-add="영어">+ 영어</button></div>
      <button type="button" id="reset-button" class="reset-button" disabled>${svg("reset")} 책상 다시 세팅하기</button>
    </div>
  </section>
  <div class="view-tools" role="group" aria-label="화면과 소리 설정">
    <button id="camera-reset" type="button" aria-label="시점 초기화" title="시점 초기화">${svg("reset")}<span>원위치</span></button>
    <button id="camera-button" type="button" aria-label="전체 보기" title="전체 보기">↗<span>전체 보기</span></button>
    <button id="sound-toggle" type="button"></button>
  </div>
  <div class="scene-caption"><span class="live-dot"></span><span id="stage-label">오늘도 시험 보느라 수고했어.</span></div>
  <div class="drag-hint" id="drag-hint" role="status" hidden>파쇄기 위로 끌어다 놓아 봐.</div>
  <div class="charge-overlay" id="charge-overlay" hidden><strong id="charge-label">스페이스바를 꾹 눌러 봐.</strong><div class="charge-track"><div id="charge-fill"></div></div><small>${HOLD_MS / 1000}초 이상 누른 뒤 손을 떼!</small></div>
  <div class="bottom-hud">
    <div class="desk-status"><strong id="hint-title">오늘 본 시험, 여기에 올려놓자.</strong><span id="hint-detail">왼쪽 위에서 과목을 추가해 봐.</span></div>
    <div class="control-guide" aria-label="게임 조작 안내">
      <div>${svg("crumple")}<span><strong>더블클릭</strong><small>조금씩 구기기</small></span></div>
      <div>${svg("shred")}<span><strong>끌어놓기</strong><small>시험지 → 파쇄기</small></span></div>
      <div>${svg("flip")}<span><strong><kbd>SPACE</kbd> 꾹, 떼기</strong><small>${HOLD_MS / 1000}초 충전 후 책상 엎기</small></span></div>
    </div>
    <p class="camera-hint">빈 공간 드래그로 둘러보기 <span>·</span> 휠로 확대·축소</p>
  </div>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
