import test from "node:test";
import assert from "node:assert/strict";
import { GameStore } from "../src/domain/GameStore.ts";

test("subjects reject duplicates and over-capacity without changing the desk", () => {
  const store = new GameStore([]);
  assert.equal(store.addSubject("  확률과   통계 "), null);
  assert.equal(store.snapshot.subjects[0], "확률과 통계");
  assert.ok(store.addSubject("확률과 통계"));
  for (let i = 0; i < 7; i++) assert.equal(store.addSubject(`과목 ${i}`), null);
  assert.ok(store.addSubject("아홉 번째"));
  assert.equal(store.snapshot.subjects.length, 8);
  const copy = store.snapshot;
  copy.subjects.length = 0;
  assert.equal(store.snapshot.subjects.length, 8);
});

test("selection and mode changes do not count as processing clicks", () => {
  const store = new GameStore(["미적분학", "영어"]);
  assert.equal(store.process(), false);
  store.start();
  store.select(1);
  store.setMode("shred");
  assert.equal(store.snapshot.papers[1].progress, 0);
  assert.equal(store.process(), true);
  assert.equal(store.snapshot.papers[1].progress, 1);
  assert.equal(store.snapshot.papers[0].progress, 0);
  store.select(99);
  assert.equal(store.snapshot.selected, 1);
});

test("a flip locks processing; reset restores every subject and its processing state", () => {
  const store = new GameStore(["미적분학", "영어"]);
  store.start();
  for (let i = 0; i < 6; i++) store.process();
  assert.equal(store.snapshot.papers[0].done, true);
  store.setMode("flip");
  assert.equal(store.flip(), true);
  assert.equal(store.flip(), false);
  assert.equal(store.process(), false);
  assert.equal(
    store.snapshot.papers.every((paper) => paper.done),
    true,
  );
  store.reset();
  assert.equal(store.snapshot.phase, "playing");
  assert.deepEqual(store.snapshot.subjects, ["미적분학", "영어"]);
  assert.equal(
    store.snapshot.papers.every(
      (paper) => !paper.done && paper.progress === 0 && paper.mode === "",
    ),
    true,
  );
  store.edit();
  assert.equal(store.process(), false);
});
