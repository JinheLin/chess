import type { Character } from '../personality/Personality';
import { CHARACTERS } from '../personality/Personality';
import type { PersonalityEngine } from '../personality/PersonalityEngine';
export interface SpeechPort {
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance:SpeechSynthesisUtterance):void;
  cancel():void;
  resume?():void;
  addEventListener?(type:string, listener:EventListener):void;
  removeEventListener?(type:string, listener:EventListener):void;
}
const CHINESE = /^(?:zh|cmn)(?:[-_]|$)/i;
/** Chrome Android drops a speak() that shares a turn with cancel(). */
const REPLACE_DELAY_MS = 100;
/** Owns a single utterance. Never accumulate a backlog of old chess comments. */
export class CommentarySpeech {
  private state:{enabled:boolean;supported:boolean;error:string;speaking:boolean};
  private listeners = new Set<()=>void>();
  private activated = false;
  private current:SpeechSynthesisUtterance | null = null;
  private timer:ReturnType<typeof setTimeout> | undefined;
  private replaceTimer:ReturnType<typeof setTimeout> | undefined;
  private cachedVoices:SpeechSynthesisVoice[] = [];
  private unbindVoices = ()=>{};
  private unsubscribe = ()=>{};
  constructor(private engine:PersonalityEngine,
    private port:SpeechPort | null = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined' ? speechSynthesis : null,
    private create:(text:string)=>SpeechSynthesisUtterance = text=>new SpeechSynthesisUtterance(text),
    private suspended:()=>boolean = ()=>false) {
    this.state = {enabled:!!port,supported:!!port,error:'',speaking:false};
    this.rememberVoices();
  }
  getSnapshot = ()=>this.state;
  subscribe = (listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<typeof this.state>) {this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
  connect() {
    let previous = this.engine.getSnapshot();
    this.unsubscribe = this.engine.subscribe(()=>{
      const next = this.engine.getSnapshot(), last = next.history.at(-1);
      const changed = last?.id !== previous.history.at(-1)?.id;
      const invalid = next.settings.muted || !last || next.settings.character !== previous.settings.character;
      previous = next;
      if (this.suspended()) {this.stop();return;}
      if (invalid) {this.stop();if(next.settings.muted && this.state.enabled) this.publish({enabled:false});return;}
      if (changed && this.state.enabled && this.activated) this.say(last.text,last.character);
    });
  }
  activate() {
    if (this.suspended() || !this.state.enabled || this.activated || !this.port || this.engine.getSnapshot().settings.muted) return;
    this.activated = true;
    const snapshot = this.engine.getSnapshot(), last = snapshot.history.at(-1);
    this.say(last?.text ?? CHARACTERS[snapshot.settings.character].intro,snapshot.settings.character);
  }
  toggle() {
    if (this.state.enabled) {this.stop();this.publish({enabled:false,error:''});return;}
    const snapshot = this.engine.getSnapshot();
    if (!this.port || snapshot.settings.muted) return;
    this.publish({enabled:true,error:''});
    this.activated = true;
    if (this.suspended()) return;
    // Called directly from a user gesture, including the first utterance.
    const last = snapshot.history.at(-1);
    this.say(last?.text ?? CHARACTERS[snapshot.settings.character].intro,snapshot.settings.character);
  }
  stop() {
    clearTimeout(this.timer); clearTimeout(this.replaceTimer);
    const current = this.current; this.current = null;
    if (current) {current.onstart=null;current.onend=null;current.onboundary=null;current.onerror=null;try {this.port?.cancel();} catch { /* Optional audio. */ }}
    if (this.state.speaking) this.publish({speaking:false});
  }
  private rememberVoices() {
    const port = this.port; if (!port) return;
    const load = () => { try { const voices = port.getVoices(); if (voices.length) this.cachedVoices = voices; } catch { /* Keep the last list. */ } };
    load();
    port.addEventListener?.('voiceschanged', load);
    this.unbindVoices = () => port.removeEventListener?.('voiceschanged', load);
  }
  private readVoices() { try { return this.port?.getVoices() ?? []; } catch { return []; } }
  private chooseVoice() {
    const live = this.readVoices();
    const pool = (live.length ? live : this.cachedVoices).filter(voice => CHINESE.test(voice.lang));
    const voices = pool.length ? pool : (live.length ? live : this.cachedVoices).filter(voice => /^yue(?:[-_]|$)/i.test(voice.lang));
    return voices.find(voice => voice.localService) ?? voices[0] ?? null;
  }
  private say(text:string,character:Character) {
    const replace = this.current !== null;
    this.stop();
    try {
      const utterance = this.create(text); this.current = utterance;
      const voice = this.chooseVoice();
      utterance.voice = voice; utterance.lang = voice?.lang ?? 'zh-CN';
      utterance.rate = character === 'professor' ? .88 : character === 'victor' ? 1.05 : .98;
      utterance.pitch = character === 'professor' ? .9 : character === 'victor' ? .95 : 1.05;
      const fail = (error = '朗读未成功。请调高媒体音量，或在系统设置中安装中文「文字转语音」后再试。') => {
        if (this.current !== utterance) return;
        this.stop(); this.publish({enabled:false, error});
      };
      const started = () => { if (this.current !== utterance) return; clearTimeout(this.timer); this.publish({speaking:true}); this.timer = setTimeout(fail, 45000); };
      utterance.onstart = started; utterance.onboundary = started;
      utterance.onend = () => { if (this.current !== utterance) return; clearTimeout(this.timer); this.current = null; this.publish({speaking:false}); };
      utterance.onerror = event => {
        if (event.error === 'interrupted' || event.error === 'canceled') return;
        fail(event.error === 'language-unavailable' || event.error === 'voice-unavailable'
          ? '系统没有中文语音。请在系统设置里安装中文「文字转语音」引擎后再打开朗读。' : undefined);
      };
      this.timer = setTimeout(fail, 10000);
      const go = () => {
        if (this.current !== utterance || !this.port) return;
        try { this.port.resume?.(); this.port.speak(utterance); }
        catch { this.stop(); this.publish({enabled:false, error:'此设备暂时无法朗读，文字对话仍可使用。'}); }
      };
      if (replace) this.replaceTimer = setTimeout(go, REPLACE_DELAY_MS);
      else go();
    } catch {
      this.stop(); this.publish({enabled:false, error:'此设备暂时无法朗读，文字对话仍可使用。'});
    }
  }
  dispose() { this.unbindVoices(); this.unsubscribe(); this.stop(); }
}
