import Phaser from 'phaser';
import './style.css';
import { DeskScene } from './scene';
import { MAX_SUBJECTS, normalizeSubject } from './rules.mjs';

export type Mode = 'crumple' | 'shred' | 'flip';
const icons = {
  paper: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6m-6 4h6"/>',
  crumple: '<path d="m8 3 9 2 4 8-5 8-10-2-3-9z"/><path d="m8 3 3 7-8 0m8 0 6-5m-6 5 5 11m-5-11 10 3M6 19l5-9"/>',
  shred: '<path d="M7 3h10v8H7zM4 10h16v8H4zM7 14h10M7 18v4m5-4v4m5-4v4"/>',
  flip: '<path d="m3 10 16-4 2 6-16 4zM6 16l2 5m10-8 2 6M4 6V2m-2 2h4m9-2v2"/>',
  sound: '<path d="m11 4-5 4H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-5 4H3v8h3l5 4zM16 9l5 6m0-6-5 6"/>',
  reset: '<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
export const svg = (name: keyof typeof icons, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;

let subjects: string[] = [];
try { subjects = JSON.parse(localStorage.getItem('sihyeomji-subjects') || '[]'); } catch { /* New session. */ }
if (!Array.isArray(subjects)) subjects = [];
subjects = [...new Set(subjects.filter(s => typeof s === 'string').map(normalizeSubject).filter(Boolean))].slice(0, MAX_SUBJECTS);
let playing = false;
let mode: Mode = 'crumple';
let selected = 0;
let muted = false;
try { muted = localStorage.getItem('sihyeomji-muted') === 'true'; } catch { /* Storage is optional. */ }

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header class="site-header">
  <a href="#" class="brand" aria-label="시혐지 홈">${svg('paper')}<span>시혐지<span class="brand-dot">.</span></span></a>
  <span class="header-tag">시험 후유증 처리실 <span>EST. 2026</span></span>
  <button class="sound-button" id="sound-toggle" type="button"></button>
</header>
<main>
  <section class="intro" aria-labelledby="page-title">
    <div><div class="eyebrow"><span></span> A LITTLE POST-EXAM THERAPY</div><h1 id="page-title">시험은 끝. <span>이제 네 차례.</span></h1></div>
    <p>머릿속에 남은 그 과목,<br>여기 두고 가도 돼.</p>
  </section>
  <section class="playground" aria-label="시혐지 게임">
    <div class="game-column">
      <div class="stage-top"><span><i></i> YOUR DESK, YOUR RULES.</span><span id="stage-label">시험지 준비 중</span></div>
      <div id="game-stage" role="application" aria-label="시험지가 놓인 책상. 시험지 선택 후 화면을 클릭하거나 스페이스바를 길게 눌러 플레이하세요." tabindex="0"></div>
      <div class="stage-bottom"><div class="hint-icon" id="hint-icon">${svg('paper')}</div><div><strong id="hint-title">오늘 본 시험, 여기에 올려놓자.</strong><p id="hint-detail">오른쪽에서 과목을 추가하고 시작해 봐.</p></div><span class="step-count" id="step-count">READY?</span></div>
    </div>
    <aside class="control-panel">
      <div id="setup-panel">
        <div class="section-number">01 / PREPARE</div><h2>어떤 시험을 봤어?</h2><p class="panel-description">과목 이름만 적어. 나머지는 네 마음대로.</p>
        <form id="subject-form"><label class="sr-only" for="subject-input">시험 과목 이름</label><div class="input-wrap"><input id="subject-input" placeholder="예: 미적분학" maxlength="24" autocomplete="off"/><button type="submit" aria-label="과목 추가">+</button></div></form>
        <p id="form-feedback" class="form-feedback" role="status" aria-live="polite">최대 8과목까지 올릴 수 있어.</p>
        <div id="subject-chips" class="subject-chips"></div>
        <div class="quick-add"><span>빠르게 추가</span><div><button type="button" data-add="미적분학">+ 미적분학</button><button type="button" data-add="전공필수">+ 전공필수</button><button type="button" data-add="영어">+ 영어</button></div></div>
        <button id="start-button" class="start-button" type="button">책상에 앉기 ${svg('arrow')}</button>
        <p class="start-note">점수도, 제한 시간도 없어.</p>
      </div>
      <div id="play-panel" hidden>
        <div class="section-number">01 / YOUR PAPERS</div><div class="panel-heading"><h2>오늘의 시험지</h2><button type="button" id="edit-subjects">과목 수정</button></div>
        <p class="panel-description">처리하고 싶은 시험지를 골라.</p><div id="paper-selector" class="paper-selector"></div>
        <div class="completion"><span>처리한 시험지</span><strong id="done-count">0 / 0</strong></div>
      </div>
      <div class="tools-section"><div class="section-number">02 / LET IT OUT</div><h2>어떻게 풀래?</h2>
        <div class="tools" role="group" aria-label="처리 방법 선택">
          <button type="button" class="tool active" data-mode="crumple" aria-pressed="true"><span class="tool-icon">${svg('crumple')}</span><span><strong>구기기</strong><small>클릭할 때마다 바스락.</small></span><span class="tool-key">01</span></button>
          <button type="button" class="tool" data-mode="shred" aria-pressed="false"><span class="tool-icon">${svg('shred')}</span><span><strong>파쇄기</strong><small>클릭할 때마다 드르륵.</small></span><span class="tool-key">02</span></button>
          <button type="button" class="tool" data-mode="flip" aria-pressed="false"><span class="tool-icon">${svg('flip')}</span><span><strong>책상 엎기</strong><small>꾹 누르고, 시원하게.</small></span><span class="tool-key">03</span></button>
        </div>
      </div>
      <button type="button" id="reset-button" class="reset-button" disabled>${svg('reset')} 책상 다시 세팅하기</button>
    </aside>
  </section>
  <div class="under-game"><span><kbd>CLICK</kbd> 구기기 · 파쇄기 <span class="divider">/</span> <kbd>SPACE</kbd> 1.5초 이상 누른 뒤 놓아 책상 엎기</span><span>시험지 + 혐오 = 시혐지 <span class="tiny-star">✳</span></span></div>
  <footer><span>오늘도 시험 보느라 수고했어.</span><span>LEAVE THE EXAM. KEEP YOUR PEACE.</span></footer>
</main>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
let toastTimer: number;
export function toast(message: string) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = window.setTimeout(() => $('#toast').classList.remove('visible'), 2400); }
function saveSubjects() { try { localStorage.setItem('sihyeomji-subjects', JSON.stringify(subjects)); } catch { /* Play works without persistence. */ } }
const scene = new DeskScene({
  onSelect(index) { selected = index; renderPaperSelector(); updateHint(); },
  onProgress() { renderPaperSelector(); updateHint(); },
  onMessage: toast,
});
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game-stage', width: 1100, height: 790,
  backgroundColor: '#dfc49c', antialias: true, scene: [scene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { keyboard: true },
  render: { transparent: false },
});

function renderSubjects() {
  const root = $('#subject-chips'); root.replaceChildren();
  subjects.forEach((name, index) => {
    const chip = document.createElement('span'); chip.className = 'subject-chip';
    const label = document.createElement('span'); label.textContent = name;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '×'; button.setAttribute('aria-label', `${name} 삭제`);
    button.onclick = () => { subjects.splice(index, 1); saveSubjects(); renderSubjects(); scene.previewSubjects(subjects); };
    chip.append(label, button); root.append(chip);
  });
  $('#start-button').toggleAttribute('disabled', !subjects.length);
  if (!subjects.length) { const empty = document.createElement('p'); empty.className = 'empty-note'; empty.textContent = '아직 올려놓은 시험지가 없어.'; root.append(empty); }
}
function addSubject(raw: string) {
  const subject = normalizeSubject(raw);
  if (!subject) { $('#form-feedback').textContent = '과목 이름을 먼저 적어줘.'; return; }
  if (subjects.includes(subject)) { $('#form-feedback').textContent = '이미 책상에 올려놓은 과목이야.'; return; }
  if (subjects.length >= MAX_SUBJECTS) { $('#form-feedback').textContent = '한 번에 8과목까지 올릴 수 있어.'; return; }
  subjects.push(subject); saveSubjects(); renderSubjects(); scene.previewSubjects(subjects);
  $('#form-feedback').textContent = `${subject}, 준비 완료.`;
  $('#subject-input').focus();
}
$('#subject-form').addEventListener('submit', event => { event.preventDefault(); addSubject($<HTMLInputElement>('#subject-input').value); $<HTMLInputElement>('#subject-input').value = ''; });
document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach(button => button.onclick = () => addSubject(button.dataset.add!));
function startGame() {
  if (!subjects.length) return;
  playing = true; selected = 0;
  $('#setup-panel').hidden = true; $('#play-panel').hidden = false;
  $('#reset-button').removeAttribute('disabled'); $('#stage-label').textContent = '마음껏 해도 괜찮아';
  scene.begin(subjects, mode); renderPaperSelector(); updateHint(); $('#game-stage').focus({ preventScroll: true });
}
$('#start-button').onclick = startGame;
$('#edit-subjects').onclick = () => { playing = false; scene.stopPlay(); $('#setup-panel').hidden = false; $('#play-panel').hidden = true; $('#reset-button').setAttribute('disabled', ''); $('#stage-label').textContent = '시험지 준비 중'; scene.previewSubjects(subjects); updateHint(); };
function renderPaperSelector() {
  const root = $('#paper-selector'); root.replaceChildren();
  subjects.forEach((name, index) => {
    const paper = scene.papers[index]; const button = document.createElement('button'); button.type = 'button';
    button.className = `paper-option${selected === index ? ' selected' : ''}${paper?.done ? ' done' : ''}`;
    button.setAttribute('aria-pressed', String(selected === index));
    const number = document.createElement('span'); number.className = 'paper-number'; number.textContent = String(index + 1).padStart(2, '0');
    const label = document.createElement('span'); label.textContent = name;
    const check = document.createElement('span'); check.className = 'paper-check'; check.textContent = paper?.done ? '✓' : '↗';
    button.append(number, label, check); button.onclick = () => { selected = index; scene.selectPaper(index); renderPaperSelector(); updateHint(); $('#game-stage').focus({ preventScroll: true }); };
    root.append(button);
  });
  $('#done-count').textContent = `${scene.papers.filter(p => p.done).length} / ${subjects.length}`;
}
function updateHint() {
  if (!playing) { $('#hint-title').textContent = '오늘 본 시험, 여기에 올려놓자.'; $('#hint-detail').textContent = '오른쪽에서 과목을 추가하고 시작해 봐.'; $('#step-count').textContent = 'READY?'; return; }
  const paper = scene.papers[selected];
  $('#hint-icon').innerHTML = svg(mode);
  if (scene.flipped) { $('#hint-title').textContent = '그래. 오늘은 이 정도면 됐어.'; $('#hint-detail').textContent = '다시 하고 싶으면 책상을 새로 세팅해.'; $('#step-count').textContent = '후련!'; return; }
  if (mode === 'flip') { $('#hint-title').textContent = '스페이스바를 꾹. 준비되면 놓아.'; $('#hint-detail').textContent = '1.5초 이상 누른 뒤 놓으면 책상이 뒤집혀.'; $('#step-count').textContent = 'HOLD SPACE'; }
  else if (paper?.done) { $('#hint-title').textContent = `${paper.name}, 처리 끝.`; $('#hint-detail').textContent = '다른 시험지를 고르거나 책상을 엎어 봐.'; $('#step-count').textContent = 'CLEAR'; }
  else { $('#hint-title').textContent = mode === 'crumple' ? '화면을 클릭해서 구겨 버려.' : '화면을 클릭해서 갈아 버려.'; $('#hint-detail').textContent = `선택한 과목: ${paper?.name ?? ''} · 클릭할 때마다 진행돼.`; $('#step-count').textContent = `${paper?.mode === mode ? paper.progress : 0} / ${mode === 'crumple' ? 6 : 8}`; }
}
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button => button.onclick = () => {
  mode = button.dataset.mode as Mode; scene.setMode(mode);
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  updateHint(); if (playing) $('#game-stage').focus({ preventScroll: true });
});
$('#reset-button').onclick = () => { if (!playing) return; scene.begin(subjects, mode); selected = 0; renderPaperSelector(); updateHint(); toast('새 시험지 준비 완료. 한 번 더?'); $('#game-stage').focus({ preventScroll: true }); };
function renderSound() { $('#sound-toggle').innerHTML = `${svg(muted ? 'mute' : 'sound')}<span>소리 ${muted ? 'OFF' : 'ON'}</span>`; $('#sound-toggle').setAttribute('aria-pressed', String(!muted)); scene.setMuted(muted); }
$('#sound-toggle').onclick = () => { muted = !muted; try { localStorage.setItem('sihyeomji-muted', String(muted)); } catch { /* Optional. */ } renderSound(); };
renderSubjects(); renderSound();
scene.previewSubjects(subjects);
window.addEventListener('beforeunload', () => game.destroy(true));
