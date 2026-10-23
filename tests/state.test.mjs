import test from "node:test";
import assert from "node:assert/strict";
import { GameStore } from "../src/domain/GameStore.ts";

test("subjects appear immediately, reject duplicates/capacity, and expose snapshots safely", () => {
  const store = new GameStore([]);
  assert.equal(store.snapshot.phase, "setup");
  assert.equal(store.addSubject("  확률과   통계 "), null);
  assert.equal(store.snapshot.phase, "playing");
  assert.equal(store.snapshot.papers[0].name, "확률과 통계");
  assert.ok(store.addSubject("확률과 통계"));
  for (let i = 0; i < 7; i++) assert.equal(store.addSubject(`과목 ${i}`), null);
  assert.ok(store.addSubject("아홉 번째"));
  const copy = store.snapshot;
  copy.subjects.length = 0;
  copy.papers[0].done = true;
  assert.equal(store.snapshot.subjects.length, 8);
  assert.equal(store.snapshot.papers[0].done, false);
});

test("selection is harmless and one crumple action completes only the target paper", () => {
  const store = new GameStore(["미적분학", "영어"]);
  store.select(1);
  assert.equal(store.snapshot.papers[1].progress, 0);
  assert.equal(store.crumple(1), true);
  assert.equal(store.snapshot.papers[1].done, true);
  assert.equal(store.snapshot.papers[0].progress, 0);
  assert.equal(store.crumple(1), false);
  assert.equal(store.beginShred(1), false);
  assert.equal(store.crumple(99), false);
});

test("shredding is automatic, exclusive, and reports its paper even after selection changes", () => {
  const store = new GameStore(["미적분학", "영어", "물리"]);
  const processed = [];
  store.subscribe((_, event) => { if (event.type === "process") processed.push(event.paperId); });
  assert.equal(store.beginShred(0), true);
  assert.equal(store.beginShred(1), false);
  assert.equal(store.crumple(0), false);
  store.select(2);
  assert.equal(store.crumple(2), true);
  for (let i = 0; i < 8; i++) assert.equal(store.shredStep(0), true);
  assert.equal(store.snapshot.papers[0].done, true);
  assert.equal(store.snapshot.papers[1].progress, 0);
  assert.equal(processed.at(-1), 0);
  assert.equal(store.beginShred(1), true);
});

test("Space can flip without a tool mode; reset cancels stale shred steps", () => {
  const store = new GameStore(["미적분학", "영어"]);
  store.beginShred(0);
  assert.equal(store.flip(), true);
  assert.equal(store.flip(), false);
  assert.equal(store.shredStep(0), false);
  assert.equal(store.crumple(1), false);
  assert.ok(store.snapshot.papers.every((paper) => paper.done));
  store.reset();
  assert.equal(store.snapshot.phase, "playing");
  assert.equal(store.shredStep(0), false);
  assert.ok(store.snapshot.papers.every((paper) => !paper.done && paper.progress === 0 && paper.mode === ""));
  store.removeSubject(1);
  store.removeSubject(0);
  assert.equal(store.snapshot.phase, "setup");
  assert.equal(store.flip(), false);
});
