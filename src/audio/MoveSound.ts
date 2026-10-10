import type { GameState } from '../game/GameState';
export type SoundKind = 'move' | 'capture' | 'check' | 'end';
export function moveSound(previous: GameState, current: GameState): SoundKind | null {
  if (current.history.length !== previous.history.length + 1 || current.history.at(-1)?.before !== previous.fen) return null;
  return current.result ? 'end' : current.inCheck ? 'check' : current.history.at(-1)?.captured ? 'capture' : 'move';
}
/** Short local synthesised tones; no remote audio, autoplay or media downloads. */
export class MoveSound {
  private context: AudioContext | null = null;
  unlock() {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch { /* Audio is optional and must not interrupt a game. */ }
  }
  play(kind: SoundKind) {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const frequencies = {move:[440],capture:[280,200],check:[640,800],end:[440,550,660]}[kind];
    try {
      frequencies.forEach((frequency,index) => {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        const start = context.currentTime + index * 0.075;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(0.07, start + 0.008); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + 0.12);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Unavailable audio never affects rules or controls. */ }
  }
  dispose() { void this.context?.close().catch(() => undefined); this.context = null; }
}
