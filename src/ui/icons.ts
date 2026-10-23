const icons = {
  paper: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h4M9 12h6m-6 4h6"/>',
  crumple:
    '<path d="m8 3 9 2 4 8-5 8-10-2-3-9z"/><path d="m8 3 3 7-8 0m8 0 6-5m-6 5 5 11m-5-11 10 3M6 19l5-9"/>',
  shred: '<path d="M7 3h10v8H7zM4 10h16v8H4zM7 14h10M7 18v4m5-4v4m5-4v4"/>',
  flip: '<path d="m3 10 16-4 2 6-16 4zM6 16l2 5m10-8 2 6M4 6V2m-2 2h4m9-2v2"/>',
  sound:
    '<path d="m11 4-5 4H3v8h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 4-5 4H3v8h3l5 4zM16 9l5 6m0-6-5 6"/>',
  reset: '<path d="M4 9a8 8 0 1 1 0 7M4 3v6h6"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
export const svg = (name: keyof typeof icons, cls = "") =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
