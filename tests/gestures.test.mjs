import test from "node:test";
import assert from "node:assert/strict";
import {
  PointerGestures,
  DRAG_DISTANCE_PX,
} from "../src/input/PointerGestures.mjs";

test("a stationary press or small hand movement remains a single tap", () => {
  const gestures = new PointerGestures();
  gestures.begin(1, 100, 100);
  assert.equal(gestures.move(1, 103, 102).dragged, false);
  assert.deepEqual(gestures.end(1, 101, 100), {
    startX: 100,
    startY: 100,
    dragged: false,
    multiple: false,
  });
  assert.equal(gestures.end(1, 101, 100), null);
});

test("dragging at the threshold then returning to the start never becomes a click", () => {
  const gestures = new PointerGestures();
  gestures.begin(1, 0, 0);
  assert.equal(gestures.move(1, DRAG_DISTANCE_PX, 0).dragged, true);
  assert.equal(gestures.end(1, 0, 0).dragged, true);
});

test("a fast drag is detected on release even if move events were missed", () => {
  const gestures = new PointerGestures();
  gestures.begin(1, 20, 20);
  assert.equal(gestures.end(1, 80, 80).dragged, true);
});

test("a two-finger gesture suppresses both taps, including the final finger", () => {
  const gestures = new PointerGestures();
  gestures.begin(1, 100, 100);
  gestures.begin(2, 120, 100);
  assert.equal(gestures.end(2, 120, 100).multiple, true);
  assert.equal(gestures.end(1, 100, 100).multiple, true);
  assert.equal(gestures.count, 0);
  gestures.begin(3, 10, 10);
  assert.equal(gestures.end(3, 10, 10).multiple, false);
});

test("cancelling a gesture cannot produce a delayed tap on release", () => {
  const gestures = new PointerGestures();
  gestures.begin(1, 10, 10);
  gestures.reset();
  assert.equal(gestures.end(1, 10, 10), null);
});
