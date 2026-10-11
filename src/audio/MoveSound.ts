import type { Square } from 'chess.js';
import type { GameState } from '../game/GameState';
export type SoundKind = 'move' | 'capture' | 'check' | 'mate' | 'end';
export type BoardEffect = 'capture' | 'check' | 'mate';
/** The strongest event on the latest move. Check outranks a capture; checkmate outranks both. */
export function boardEffect(state: GameState): { kind: BoardEffect; square: Square } | null {
  const last = state.history.at(-1);
  if (!last) return null;
  if (state.result?.includes('将死')) return { kind: 'mate', square: state.checkedKing ?? last.to };
  if (state.inCheck) return { kind: 'check', square: state.checkedKing ?? last.to };
  if (last.captured) return { kind: 'capture', square: last.to };
  return null;
}
export function moveSound(previous: GameState, current: GameState): SoundKind | null {
  if (current.history.length !== previous.history.length + 1 || current.history.at(-1)?.before !== previous.fen) return null;
  return boardEffect(current)?.kind ?? (current.result ? 'end' : 'move');
}
function createAudioContext(): AudioContext | null {
  const scope = globalThis as typeof globalThis & {webkitAudioContext?: typeof AudioContext};
  const Ctor = typeof scope.AudioContext === 'function' ? scope.AudioContext : scope.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}
/** Short local synthesised tones; no remote audio, autoplay or media downloads.
 * Android Chrome and in-app WebViews keep a new context suspended until a touch
 * resumes it, and that resume() promise settles after the tap that played the move. */
export class MoveSound {
  private context: AudioContext | null = null;
  private primed = false;
  private token = 0;
  unlock() {
    try {
      if (!this.context || this.context.state === 'closed') { this.context = createAudioContext(); this.primed = false; }
      const context = this.context;
      if (!context) return;
      void context.resume().catch(() => undefined);
      this.prime(context);
    } catch { /* Audio is optional and must not interrupt a game. */ }
  }
  play(kind: SoundKind) {
    const context = this.context;
    if (!context) return;
    const token = ++this.token;
    const emit = () => { if (token === this.token && this.context === context && context.state === 'running') this.emit(context, kind); };
    if (context.state === 'running') emit();
    else void context.resume().then(emit).catch(() => undefined);
  }
  dispose() { this.token++; void this.context?.close().catch(() => undefined); this.context = null; this.primed = false; }
  private prime(context: AudioContext) {
    if (this.primed) return;
    try {
      // A one-sample buffer started inside the touch is what actually opens the output device on many Android WebViews.
      const buffer = context.createBuffer(1, 1, context.sampleRate || 22050);
      const source = context.createBufferSource();
      source.buffer = buffer; source.connect(context.destination); source.start(0);
      if (context.state === 'running') this.primed = true;
    } catch { /* Retry on the next touch if this WebView rejects start() while suspended. */ }
  }
  private emit(context: AudioContext, kind: SoundKind) {
    const voices: Record<SoundKind, { type: OscillatorType; frequency: number; at: number; duration: number; peak: number }[]> = {
      move: [{ type: 'sine', frequency: 520, at: 0, duration: 0.07, peak: 0.05 }],
      capture: [
        { type: 'triangle', frequency: 210, at: 0, duration: 0.13, peak: 0.22 },
        { type: 'square', frequency: 140, at: 0.015, duration: 0.08, peak: 0.08 },
      ],
      check: [
        { type: 'triangle', frequency: 740, at: 0, duration: 0.1, peak: 0.13 },
        { type: 'triangle', frequency: 1040, at: 0.09, duration: 0.16, peak: 0.13 },
      ],
      mate: [
        { type: 'sine', frequency: 494, at: 0, duration: 0.2, peak: 0.15 },
        { type: 'sine', frequency: 370, at: 0.16, duration: 0.22, peak: 0.15 },
        { type: 'triangle', frequency: 247, at: 0.34, duration: 0.4, peak: 0.18 },
      ],
      end: [
        { type: 'sine', frequency: 440, at: 0, duration: 0.12, peak: 0.07 },
        { type: 'sine', frequency: 554, at: 0.1, duration: 0.16, peak: 0.07 },
      ],
    };
    try {
      for (const voice of voices[kind]) this.tone(context, voice);
    } catch { /* Unavailable audio never affects rules or controls. */ }
  }
  private tone(context: AudioContext, voice: { type: OscillatorType; frequency: number; at: number; duration: number; peak: number }) {
    const oscillator = context.createOscillator(); const gain = context.createGain();
    const start = context.currentTime + voice.at;
    oscillator.type = voice.type; oscillator.frequency.value = voice.frequency;
    // Linear ramps only: Android WebView and older Chrome throw if an exponential ramp follows a zero gain.
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(voice.peak, start + 0.012);
    gain.gain.linearRampToValueAtTime(0.0001, start + voice.duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(start); oscillator.stop(start + voice.duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
}
