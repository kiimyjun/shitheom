// CSS pixels, shared by game input and camera navigation.
export const DRAG_DISTANCE_PX = 8;

/** Remembers the entire gesture, so returning to its start never becomes a click. */
export class PointerGestures {
  pointers = new Map();

  get count() {
    return this.pointers.size;
  }

  begin(id, x, y) {
    if (this.pointers.has(id)) return;
    const multiple = this.pointers.size > 0;
    if (multiple)
      for (const pointer of this.pointers.values()) pointer.multiple = true;
    this.pointers.set(id, { startX: x, startY: y, dragged: false, multiple });
  }

  move(id, x, y) {
    const pointer = this.pointers.get(id);
    if (!pointer) return null;
    if (Math.hypot(x - pointer.startX, y - pointer.startY) >= DRAG_DISTANCE_PX)
      pointer.dragged = true;
    return pointer;
  }

  end(id, x, y) {
    const pointer = this.move(id, x, y);
    this.pointers.delete(id);
    return pointer ? { ...pointer } : null;
  }

  remove(id) {
    this.pointers.delete(id);
  }
  reset() {
    this.pointers.clear();
  }
}
