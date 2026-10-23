export class GameAudio {
  muted = false;
  private context?: AudioContext;
  play(kind: "crumple" | "shred" | "charge" | "flip" | "done") {
    if (this.muted) return;
    try {
      const ctx = (this.context ??= new AudioContext());
      if (ctx.state === "suspended") void ctx.resume();
      const duration = kind === "flip" ? 0.7 : kind === "shred" ? 0.2 : 0.14;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(kind === "flip" ? 0.22 : 0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      if (kind === "done" || kind === "charge") {
        const oscillator = ctx.createOscillator();
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(
          kind === "done" ? 660 : 160,
          ctx.currentTime,
        );
        oscillator.frequency.exponentialRampToValueAtTime(
          kind === "done" ? 1000 : 250,
          ctx.currentTime + duration,
        );
        oscillator.connect(gain);
        oscillator.start();
        oscillator.stop(ctx.currentTime + duration);
      } else {
        const buffer = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * duration),
          ctx.sampleRate,
        );
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++)
          data[i] =
            (Math.random() * 2 - 1) *
            (kind === "shred" ? Math.sin(i / 13) * 0.4 + 0.6 : 1);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = kind === "flip" ? "lowpass" : "bandpass";
        filter.frequency.value =
          kind === "flip" ? 380 : kind === "shred" ? 500 : 1600;
        source.connect(filter);
        filter.connect(gain);
        source.start();
      }
    } catch {
      /* The visual game remains playable when audio is unavailable. */
    }
  }
  dispose() {
    void this.context?.close().catch(() => {});
    this.context = undefined;
  }
}
