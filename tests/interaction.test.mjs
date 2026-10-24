import test from "node:test";
import assert from "node:assert/strict";
import { InteractionController } from "../src/input/InteractionController.ts";
import { HOLD_MS } from "../src/domain/rules.mjs";

function harness(t) {
  class Element extends EventTarget {
    editing = false;
    focus() {}
    setPointerCapture() {}
    contains(target) { return target === this; }
    matches() { return this.editing; }
    getBoundingClientRect() { return { left: 0, top: 0, right: 400, bottom: 600 }; }
  }
  const stage = new Element();
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false });
  const frames = new Map();
  let nextFrame = 0;
  let now = 0;
  let enabled = true;
  const globals = {
    window, document, HTMLElement: Element,
    requestAnimationFrame: (frame) => { frames.set(++nextFrame, frame); return nextFrame; },
    cancelAnimationFrame: (id) => frames.delete(id),
  };
  const originals = new Map();
  for (const [name, value] of Object.entries(globals)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }
  t.mock.method(performance, "now", () => now);
  const releases = [];
  const charges = [];
  const crumples = [];
  const drags = [];
  const input = new InteractionController(stage, {
    enabled: () => enabled,
    pick: (x) => x < 100 ? 0 : null,
    select() {},
    crumple: (id) => crumples.push(id),
    dragStart: (id, x, y) => drags.push(["start", id, x, y]),
    dragMove: (x, y) => drags.push(["move", x, y]),
    dragEnd: (x, y) => drags.push(["end", x, y]),
    dragCancel: () => drags.push(["cancel"]),
    hover() {},
    charge: (progress, holding) => charges.push({ progress, holding }),
    release: (ready) => {
      releases.push(ready);
      if (ready) { enabled = false; input.cancel(); }
    },
  });
  t.after(() => {
    input.dispose();
    for (const [name, descriptor] of originals)
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
  });
  function send(target, type, props = {}) {
    const event = new Event(type, { cancelable: true });
    for (const [key, value] of Object.entries(props))
      Object.defineProperty(event, key, { value });
    target.dispatchEvent(event);
    return event;
  }
  return {
    input, stage, window, document, frames, releases, charges, crumples, drags,
    pointer(type, props = {}) {
      return send(stage, type, {
        pointerId: 1, pointerType: "touch", button: 0, clientX: 200, clientY: 300, ...props,
      });
    },
    key(type, props = {}) { return send(window, type, { code: "Space", repeat: false, ...props }); },
    send,
    timeAt(time) { now = time; },
    frameAt(time) {
      now = time;
      for (const [id, frame] of [...frames])
        if (frames.delete(id)) frame(time);
    },
    enable(value) { enabled = value; },
  };
}

test("a charged touch stays ready while held and flips exactly once on release", (t) => {
  const h = harness(t);
  h.pointer("pointerdown");
  h.frameAt(HOLD_MS - 1);
  assert.deepEqual(h.releases, []);
  assert.equal(h.charges.at(-1).holding, true);
  h.frameAt(HOLD_MS);
  assert.deepEqual(h.releases, []);
  assert.deepEqual(h.charges.at(-1), { progress: 1, holding: true });
  h.frameAt(HOLD_MS * 2);
  assert.deepEqual(h.releases, []);
  assert.deepEqual(h.charges.at(-1), { progress: 1, holding: true });
  h.pointer("pointerup");
  assert.deepEqual(h.releases, [true]);
  assert.deepEqual(h.charges.at(-1), { progress: 0, holding: false });
  assert.equal(h.frames.size, 0);
  h.pointer("pointerup");
  h.frameAt(HOLD_MS * 3);
  assert.deepEqual(h.releases, [true]);
});

test("lifting a short touch cancels quietly, while a release exactly at the threshold succeeds", (t) => {
  const h = harness(t);
  h.pointer("pointerdown");
  h.timeAt(HOLD_MS - 1);
  h.pointer("pointerup");
  h.frameAt(HOLD_MS);
  assert.deepEqual(h.releases, []);
  h.pointer("pointerdown");
  h.timeAt(HOLD_MS * 2);
  h.pointer("pointerup");
  assert.deepEqual(h.releases, [true]);
});

test("small finger jitter is tolerated, but camera dragging permanently cancels that hold", (t) => {
  const h = harness(t);
  h.pointer("pointerdown");
  h.pointer("pointermove", { clientX: 203, clientY: 302 });
  h.frameAt(500);
  assert.equal(h.charges.at(-1).holding, true);
  h.pointer("pointermove", { clientX: 220 });
  h.pointer("pointermove");
  h.frameAt(HOLD_MS);
  h.pointer("pointerup");
  assert.deepEqual(h.releases, []);
  assert.equal(h.charges.at(-1).holding, false);
});

test("a two-finger camera gesture stays cancelled after one finger is lifted", (t) => {
  const h = harness(t);
  h.pointer("pointerdown");
  h.pointer("pointerdown", { pointerId: 2, clientX: 250 });
  h.pointer("pointerup", { pointerId: 2, clientX: 250 });
  h.frameAt(HOLD_MS);
  h.pointer("pointerup");
  assert.deepEqual(h.releases, []);
  h.pointer("pointerdown");
  h.frameAt(HOLD_MS * 2);
  assert.deepEqual(h.releases, []);
  h.pointer("pointerup");
  assert.deepEqual(h.releases, [true]);
});

for (const reason of ["drag", "second-finger"])
  test(`${reason} cancels a fully charged touch before release`, (t) => {
    const h = harness(t);
    h.pointer("pointerdown");
    h.frameAt(HOLD_MS);
    assert.deepEqual(h.charges.at(-1), { progress: 1, holding: true });
    if (reason === "drag") h.pointer("pointermove", { clientX: 220 });
    else {
      h.pointer("pointerdown", { pointerId: 2, clientX: 250 });
      h.pointer("pointerup", { pointerId: 2, clientX: 250 });
    }
    h.pointer("pointerup");
    h.frameAt(HOLD_MS * 2);
    assert.deepEqual(h.releases, []);
    assert.deepEqual(h.charges.at(-1), { progress: 0, holding: false });
  });

test("paper holds and drags never start a desk charge", (t) => {
  const h = harness(t);
  h.pointer("pointerdown", { clientX: 50 });
  h.frameAt(HOLD_MS);
  h.pointer("pointermove", { clientX: 80 });
  h.pointer("pointerup", { clientX: 80 });
  assert.deepEqual(h.releases, []);
  assert.deepEqual(h.charges, []);
  assert.equal(h.drags[0][0], "start");
  assert.equal(h.drags.at(-1)[0], "end");
});

test("double-tapping a paper still crumples it once", (t) => {
  const h = harness(t);
  h.pointer("pointerdown", { clientX: 50 });
  h.pointer("pointerup", { clientX: 50 });
  h.timeAt(200);
  h.pointer("pointerdown", { clientX: 50 });
  h.pointer("pointerup", { clientX: 50 });
  assert.deepEqual(h.crumples, [0]);
  assert.deepEqual(h.charges, []);
});

test("mouse holds do not flip; Space still requires a release and ignores key repeat", (t) => {
  const h = harness(t);
  h.pointer("pointerdown", { pointerType: "mouse" });
  h.frameAt(HOLD_MS);
  h.pointer("pointerup", { pointerType: "mouse" });
  assert.deepEqual(h.charges, []);
  h.key("keydown");
  h.frameAt(HOLD_MS * 2);
  h.key("keydown", { repeat: true });
  assert.deepEqual(h.releases, []);
  h.key("keyup");
  assert.deepEqual(h.releases, [true]);
});

test("releasing Space cannot complete or interrupt a touch charge", (t) => {
  const h = harness(t);
  h.pointer("pointerdown");
  h.timeAt(500);
  h.key("keyup");
  assert.deepEqual(h.releases, []);
  assert.equal(h.charges.at(-1).holding, true);
  h.frameAt(HOLD_MS);
  assert.deepEqual(h.releases, []);
  h.pointer("pointerup");
  assert.deepEqual(h.releases, [true]);
});

for (const reason of ["pointercancel", "lostpointercapture", "blur", "hidden", "outside-control", "reset"])
  test(`${reason} cancels a touch hold and its pending animation`, (t) => {
    const h = harness(t);
    h.pointer("pointerdown");
    h.frameAt(500);
    if (reason === "blur") h.send(h.window, "blur");
    else if (reason === "hidden") {
      h.document.hidden = true;
      h.send(h.document, "visibilitychange");
    } else if (reason === "outside-control") h.send(h.window, "pointerdown");
    else if (reason === "reset") h.input.cancel();
    else h.pointer(reason);
    h.frameAt(HOLD_MS);
    h.pointer("pointerup");
    assert.deepEqual(h.releases, []);
    assert.equal(h.frames.size, 0);
    assert.deepEqual(h.charges.at(-1), { progress: 0, holding: false });
  });

test("leaving the stage cancels a touch even within the drag tolerance", (t) => {
  const h = harness(t);
  h.pointer("pointerdown", { clientX: 398 });
  h.pointer("pointermove", { clientX: 402 });
  h.frameAt(HOLD_MS);
  assert.deepEqual(h.releases, []);
  assert.equal(h.charges.at(-1).holding, false);
});

test("a fast drag ending without a move event cannot become a long press", (t) => {
  const h = harness(t);
  h.pointer("pointerdown");
  h.timeAt(HOLD_MS);
  h.pointer("pointerup", { clientX: 240 });
  assert.deepEqual(h.releases, []);
});

test("an inactive game cannot start or finish a touch charge", (t) => {
  const h = harness(t);
  h.enable(false);
  h.pointer("pointerdown");
  assert.deepEqual(h.charges, []);
  h.enable(true);
  h.pointer("pointerdown");
  h.enable(false);
  h.frameAt(HOLD_MS);
  assert.deepEqual(h.releases, []);
  assert.equal(h.charges.at(-1).holding, false);
});

test("long-press context menus are suppressed on the game stage", (t) => {
  const h = harness(t);
  assert.equal(h.send(h.stage, "contextmenu").defaultPrevented, true);
});
