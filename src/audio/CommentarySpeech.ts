import type { Character } from '../personality/Personality';
import { CHARACTERS } from '../personality/Personality';
import type { PersonalityEngine } from '../personality/PersonalityEngine';
export interface SpeechPort {
  getVoices(): SpeechSynthesisVoice[];
  speak(utterance:SpeechSynthesisUtterance):void;
  cancel():void;
}
/** Owns a single utterance. Never accumulate a backlog of old chess comments. */
export class CommentarySpeech {
  private state:{enabled:boolean;supported:boolean;error:string;speaking:boolean};
  private listeners = new Set<()=>void>();
  private current:SpeechSynthesisUtterance | null = null;
  private timer:ReturnType<typeof setTimeout> | undefined;
  private unsubscribe = ()=>{};
  constructor(private engine:PersonalityEngine,
    private port:SpeechPort | null = typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined' ? speechSynthesis : null,
    private create:(text:string)=>SpeechSynthesisUtterance = text=>new SpeechSynthesisUtterance(text)) {
    this.state = {enabled:false,supported:!!port,error:'',speaking:false};
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
      if (invalid) {this.stop();if(next.settings.muted && this.state.enabled) this.publish({enabled:false});return;}
      if (changed && this.state.enabled) this.say(last.text,last.character);
    });
  }
  toggle() {
    if (this.state.enabled) {this.stop();this.publish({enabled:false,error:''});return;}
    const snapshot = this.engine.getSnapshot();
    if (!this.port || snapshot.settings.muted) return;
    this.publish({enabled:true,error:''});
    // Called directly from a user gesture, including the first utterance.
    const last = snapshot.history.at(-1);
    this.say(last?.text ?? CHARACTERS[snapshot.settings.character].intro,snapshot.settings.character);
  }
  stop() {
    clearTimeout(this.timer);
    const current = this.current; this.current = null;
    if (current) {current.onstart=null;current.onend=null;current.onerror=null;try {this.port?.cancel();} catch { /* Optional audio. */ }}
    if (this.state.speaking) this.publish({speaking:false});
  }
  private say(text:string,character:Character) {
    this.stop();
    try {
      const utterance = this.create(text);this.current=utterance;
      const voices = this.port!.getVoices().filter(voice=>/^zh(?:-|_|$)/i.test(voice.lang));
      utterance.voice = voices.find(voice=>voice.localService) ?? voices[0] ?? null;
      utterance.lang = utterance.voice?.lang ?? 'zh-CN';
      utterance.rate = character === 'professor' ? .88 : character === 'victor' ? 1.05 : .98;
      utterance.pitch = character === 'professor' ? .9 : character === 'victor' ? .95 : 1.05;
      const fail = ()=>{
        if (this.current !== utterance) return;
        this.stop();this.publish({enabled:false,error:'朗读未成功，请检查浏览器声音或系统中文语音后重试。'});
      };
      utterance.onstart = ()=>{if(this.current===utterance) {clearTimeout(this.timer);this.publish({speaking:true});this.timer=setTimeout(fail,45000);}};
      utterance.onend = ()=>{if(this.current===utterance) {clearTimeout(this.timer);this.current=null;this.publish({speaking:false});}};
      utterance.onerror = fail;
      this.timer=setTimeout(fail,10000);
      this.port!.speak(utterance);
    } catch {
      this.stop();this.publish({enabled:false,error:'此设备暂时无法朗读，文字对话仍可使用。'});
    }
  }
  dispose() {this.unsubscribe();this.stop();}
}
