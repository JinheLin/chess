import type { GameController } from '../game/GameController';
import type { SpeechPort } from './CommentarySpeech';
import { playLimitMessage } from '../game/PlayLimit';

/** A quota reminder is independent of move sounds and personality voice settings. */
export class PlayLimitSpeech {
  private state: { supported: boolean; error: string };
  private listeners = new Set<() => void>();
  private activated = false;
  private key: number | null = null;
  private pending = '';
  private current: SpeechSynthesisUtterance | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe = () => {};
  constructor(private controller: GameController,
    private port: SpeechPort | null = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined' ? speechSynthesis : null,
    private create: (text: string) => SpeechSynthesisUtterance = text => new SpeechSynthesisUtterance(text)) {
    this.state = { supported: !!port, error: '' };
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(error: string) { this.state = { ...this.state, error }; this.listeners.forEach(listener => listener()); }
  connect() {
    const update = () => {
      const limit = this.controller.getSnapshot().playLimit;
      if (!limit.blocked) { this.key = null; this.pending = ''; this.stop(); return; }
      this.pending = playLimitMessage(limit);
      if (limit.nextAllowedAt === this.key) return;
      this.key = limit.nextAllowedAt;
      if (this.activated) this.say();
    };
    this.unsubscribe = this.controller.subscribe(update);
    update();
  }
  activate = () => {
    if (this.activated) return;
    this.activated = true;
    if (this.pending) this.say();
  };
  repeat = () => { this.activated = true; if (this.pending) this.say(); };
  private stop() {
    clearTimeout(this.timer);
    if (this.current) {
      this.current.onend = null; this.current.onerror = null; this.current.onstart = null;
      this.current = null;
      try { this.port?.cancel(); } catch { /* Keep the visible reminder. */ }
    }
  }
  private say() {
    if (!this.port) return;
    this.stop();
    // Replace any just-triggered chess commentary after Chrome's cancellation delay.
    try { this.port.cancel(); } catch { /* Speech can still be attempted. */ }
    this.timer = setTimeout(() => {
      try {
        const utterance = this.create(this.pending);
        this.current = utterance;
        const voices = this.port!.getVoices().filter(voice => /^(?:zh|cmn)(?:[-_]|$)/i.test(voice.lang));
        utterance.voice = voices.find(voice => voice.localService) ?? voices[0] ?? null;
        utterance.lang = utterance.voice?.lang ?? 'zh-CN'; utterance.rate = .95;
        const fail = () => { if (this.current !== utterance) return; this.stop(); this.publish('语音提醒未成功，可点击「再次朗读」重试。'); };
        utterance.onend = () => { if (this.current !== utterance) return; clearTimeout(this.timer); this.current = null; };
        utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) fail(); };
        utterance.onstart = () => { clearTimeout(this.timer); this.timer = setTimeout(fail, 45000); };
        this.timer = setTimeout(fail, 10000);
        this.publish(''); this.port!.resume?.(); this.port!.speak(utterance);
      } catch { this.stop(); this.publish('语音提醒未成功，可点击「再次朗读」重试。'); }
    }, 100);
  }
  dispose() { this.unsubscribe(); this.stop(); }
}
