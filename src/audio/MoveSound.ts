import type { GameState } from '../game/GameState';
export type SoundKind = 'move' | 'capture' | 'check' | 'end';
export function moveSound(previous: GameState, current: GameState): SoundKind | null {
  if (current.history.length !== previous.history.length + 1 || current.history.at(-1)?.before !== previous.fen) return null;
  return current.result ? 'end' : current.inCheck ? 'check' : current.history.at(-1)?.captured ? 'capture' : 'move';
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
    const frequencies = {move:[440],capture:[280,200],check:[640,800],end:[440,550,660]}[kind];
    try {
      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        const start = context.currentTime + index * 0.075;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        // Linear ramps only: Android WebView and older Chrome throw if an exponential ramp follows a zero gain.
        gain.gain.setValueAtTime(0.0001, start); gain.gain.linearRampToValueAtTime(0.07, start + 0.008); gain.gain.linearRampToValueAtTime(0.0001, start + 0.11);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.start(start); oscillator.stop(start + 0.12);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    } catch { /* Unavailable audio never affects rules or controls. */ }
  }
}
