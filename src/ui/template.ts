import { svg } from "./icons";
import { HOLD_MS, MAX_SUBJECTS } from "../domain/rules.mjs";

export const template = `
<header class="site-header">
  <a href="#" class="brand" aria-label="시혐지 홈">${svg("paper")}<span>시혐지<span class="brand-dot">.</span></span></a>
  <span class="header-tag">시험 후유증 처리실 <span>3D EDITION</span></span>
  <button class="sound-button" id="sound-toggle" type="button"></button>
</header>
<main>
  <section class="intro" aria-labelledby="page-title">
    <div><div class="eyebrow"><span></span> A LITTLE POST-EXAM THERAPY / IN 3D</div><h1 id="page-title">시험은 끝. <span>이제 네 차례.</span></h1></div>
    <p>머릿속에 남은 그 과목,<br>여기 두고 가도 돼.</p>
  </section>
  <section class="playground" aria-label="시혐지 게임">
    <div class="game-column">
      <div class="stage-top"><span><i></i> YOUR DESK, YOUR RULES.</span><div class="stage-options"><span id="stage-label">시험지 준비 중</span><button id="camera-button" type="button" aria-label="3D 카메라 시점 바꾸기">↗ 전체 보기</button></div></div>
      <div id="game-stage" role="application" aria-label="시험지가 놓인 책상. 시험지 선택 후 화면을 클릭하거나 스페이스바를 길게 눌러 플레이하세요." tabindex="0"><div class="scene-tag">REAL 3D · YOUR LITTLE ESCAPE</div><div class="loading-screen" id="loading-screen"><span class="loading-spinner"></span><strong>네 책상을 준비하는 중…</strong></div><div class="charge-overlay" id="charge-overlay" hidden><strong id="charge-label">스페이스바를 꾹 눌러 봐.</strong><div class="charge-track"><div id="charge-fill"></div></div><small>${HOLD_MS / 1000}초 이상 누른 뒤 손을 떼!</small></div></div>
      <div class="stage-bottom"><div class="hint-icon" id="hint-icon">${svg("paper")}</div><div><strong id="hint-title">오늘 본 시험, 여기에 올려놓자.</strong><p id="hint-detail">오른쪽에서 과목을 추가하고 시작해 봐.</p></div><span class="step-count" id="step-count">READY?</span></div>
    </div>
    <aside class="control-panel">
      <div id="setup-panel">
        <div class="section-number">01 / PREPARE</div><h2>어떤 시험을 봤어?</h2><p class="panel-description">과목 이름만 적어. 나머지는 네 마음대로.</p>
        <form id="subject-form"><label class="sr-only" for="subject-input">시험 과목 이름</label><div class="input-wrap"><input id="subject-input" placeholder="예: 미적분학" maxlength="24" autocomplete="off"/><button type="submit" aria-label="과목 추가">+</button></div></form>
        <p id="form-feedback" class="form-feedback" role="status" aria-live="polite">최대 ${MAX_SUBJECTS}과목까지 올릴 수 있어.</p>
        <div id="subject-chips" class="subject-chips"></div>
        <div class="quick-add"><span>빠르게 추가</span><div><button type="button" data-add="미적분학">+ 미적분학</button><button type="button" data-add="전공필수">+ 전공필수</button><button type="button" data-add="영어">+ 영어</button></div></div>
        <button id="start-button" class="start-button" type="button">책상에 앉기 ${svg("arrow")}</button>
        <p class="start-note">점수도, 제한 시간도 없어.</p>
      </div>
      <div id="play-panel" hidden>
        <div class="section-number">01 / YOUR PAPERS</div><div class="panel-heading"><h2>오늘의 시험지</h2><button type="button" id="edit-subjects">과목 수정</button></div>
        <p class="panel-description">처리하고 싶은 시험지를 골라.</p><div id="paper-selector" class="paper-selector"></div>
        <div class="completion"><span>처리한 시험지</span><strong id="done-count">0 / 0</strong></div>
      </div>
      <div class="tools-section"><div class="section-number">02 / LET IT OUT</div><h2>어떻게 풀래?</h2>
        <div class="tools" role="group" aria-label="처리 방법 선택">
          <button type="button" class="tool active" data-mode="crumple" aria-pressed="true"><span class="tool-icon">${svg("crumple")}</span><span><strong>구기기</strong><small>클릭할 때마다 바스락.</small></span><span class="tool-key">01</span></button>
          <button type="button" class="tool" data-mode="shred" aria-pressed="false"><span class="tool-icon">${svg("shred")}</span><span><strong>파쇄기</strong><small>클릭할 때마다 드르륵.</small></span><span class="tool-key">02</span></button>
          <button type="button" class="tool" data-mode="flip" aria-pressed="false"><span class="tool-icon">${svg("flip")}</span><span><strong>책상 엎기</strong><small>꾹 누르고, 시원하게.</small></span><span class="tool-key">03</span></button>
        </div>
      </div>
      <button type="button" id="reset-button" class="reset-button" disabled>${svg("reset")} 책상 다시 세팅하기</button>
    </aside>
  </section>
  <div class="under-game"><span><kbd>CLICK</kbd> 구기기 · 파쇄기 <span class="divider">/</span> <kbd>SPACE</kbd> ${HOLD_MS / 1000}초 이상 누른 뒤 놓아 책상 엎기</span><span>시험지 + 혐오 = 시혐지 <span class="tiny-star">✳</span></span></div>
  <footer><span>오늘도 시험 보느라 수고했어.</span><span>LEAVE THE EXAM. KEEP YOUR PEACE.</span></footer>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
