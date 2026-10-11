import type { GameController } from '../game/GameController';
import type { GameState } from '../game/GameState';
import type { AnalysisEngine } from '../engine/AnalysisEngine';
import { StockfishEngine } from '../engine/StockfishEngine';
import { moveEvents, relativeScore, stepEvent, uci } from './PositionAnalyzer';
import type { ChessEvent } from './PositionAnalyzer';
import { CommentaryGenerator, CommentaryScheduler, PersonalityManager } from './Personality';
import type { Character, Commentary, Frequency } from './Personality';
export interface InteractionSettings {character:Character; frequency:Frequency; muted:boolean}
const defaults:InteractionSettings = {character:'alex',frequency:'normal',muted:false};
export function loadInteraction():InteractionSettings {
  try {
    const data = JSON.parse(localStorage.getItem('chess-lab.personality.v1') ?? 'null');
    if (data && ['alex','victor','professor'].includes(data.character) && ['quiet','normal','chatty','every'].includes(data.frequency) && typeof data.muted === 'boolean') return {character:data.character,frequency:data.frequency,muted:false};
  } catch { /* Interaction preferences must never prevent playing. */ }
  return {...defaults};
}
const priority = ['end','reversal','blunder','mistake','brilliant','mate','promotion','check','capture','balanced','move'];
export interface PersonalitySnapshot {
  settings:InteractionSettings; history:readonly Commentary[];
  emotion:PersonalityManager['state']; status:string; storageFailed:boolean;
}
/** Read-only observer. It cannot submit a move or modify GameController. */
export class PersonalityEngine {
  private manager = new PersonalityManager();
  private scheduler = new CommentaryScheduler();
  private generator = new CommentaryGenerator();
  private listeners = new Set<()=>void>();
  private snapshot:PersonalitySnapshot;
  private previous:GameState;
  private session:string;
  private engine:AnalysisEngine | null = null;
  private abort:AbortController | null = null;
  private revision = 0;
  private unsubscribe:()=>void = ()=>{};
  private balanced = 0;
  private sequence = 0;
  private analyzed = 0;
  private closed = false;
  constructor(private controller:GameController, private factory:()=>AnalysisEngine = ()=>new StockfishEngine(), settings = loadInteraction()) {
    this.previous = controller.getSnapshot(); this.session = controller.save().startedAt;
    this.analyzed = this.previous.history.length;
    this.snapshot = {settings,history:[],emotion:{...this.manager.state},status:'只评论已发生的棋局，不提供走法提示',storageFailed:false};
  }
  connect() {
    this.closed = false;
    this.previous = this.controller.getSnapshot();
    this.session = this.controller.save().startedAt;
    this.analyzed = this.previous.history.length;
    this.unsubscribe = this.controller.subscribe(()=>this.observe());
  }
  getSnapshot = ()=>this.snapshot;
  subscribe = (listener:()=>void)=>{this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};};
  private publish(patch:Partial<PersonalitySnapshot> = {}) {
    this.snapshot = {...this.snapshot,...patch,emotion:{...this.manager.state}};
    this.listeners.forEach(listener=>listener());
  }
  private cancel() {++this.revision; this.abort?.abort(); this.abort = null; this.engine?.dispose(); this.engine = null;}
  private reset() {
    this.cancel(); this.manager = new PersonalityManager(); this.scheduler = new CommentaryScheduler(); this.generator = new CommentaryGenerator(); this.balanced = 0;
    this.publish({history:[],status:'新篇章，从当前局面开始'});
  }
  configure(settings:InteractionSettings) {
    const changedCharacter = this.snapshot.settings.character !== settings.character;
    if (changedCharacter) this.reset(); else this.cancel();
    this.analyzed = this.controller.getSnapshot().history.length;
    let storageFailed = false;
    try {localStorage.setItem('chess-lab.personality.v1',JSON.stringify(settings));} catch {storageFailed = true;}
    this.publish({settings:{...settings},storageFailed,status:settings.muted ? '互动已静音，分析已暂停' : '只评论已发生的棋局，不提供走法提示'});
  }
  private speak(events:ChessEvent[]) {
    const ranked = [...events].sort((a,b)=>priority.indexOf(a.kind)-priority.indexOf(b.kind));
    const event = ranked.find(e=>e.kind !== 'balanced') ?? (this.balanced >= 6 ? ranked[0] : undefined);
    if (!event) return;
    if (this.snapshot.settings.frequency === 'every' && this.snapshot.history.some(message=>message.ply===event.ply) && event.kind !== 'end') return;
    this.manager.update(event);
    if (!this.scheduler.allow(event,this.snapshot.settings.frequency,Date.now())) {this.publish();return;}
    const text = this.generator.generate(event,this.snapshot.settings.character,this.manager);
    if (!text) {this.publish();return;}
    const message:Commentary = {id:++this.sequence,ply:event.ply,text,fact:event.fact,kind:event.kind,character:this.snapshot.settings.character};
    this.publish({history:[...this.snapshot.history,message].slice(-40)});
  }
  private observe() {
    if (this.closed) return;
    const state = this.controller.getSnapshot(), session = this.controller.save().startedAt;
    const previous = this.previous;
    const rewound = session !== this.session || state.settings.mode !== previous.settings.mode || state.history.length < previous.history.length ||
      previous.history.some((move,i)=>state.history[i] && uci(move)!==uci(state.history[i])) || (!!previous.result && !state.result);
    this.previous = state; this.session = session;
    if (rewound) {this.reset();this.analyzed = state.history.length;}
    if (this.snapshot.settings.muted || state.settings.mode !== 'ai') {this.cancel();this.analyzed = state.history.length;return;}
    if (state.result) {
      this.cancel();
      if (!previous.result) this.speak([{kind:'end',actor:state.result.startsWith(state.settings.playerColor === 'w' ? '白方获胜' : '黑方获胜') ? 'player' : 'ai',ply:state.history.length,important:true,fact:state.result}]);
      return;
    }
    const changed = state.history.length !== previous.history.length || rewound;
    if (!rewound && this.snapshot.settings.frequency === 'every' && state.history.length > previous.history.length) {
      for(let i=previous.history.length;i<state.history.length;i++) this.speak([stepEvent(state.history[i],i+1,state.settings.playerColor)]);
    }
    if (changed || state.phase === 'AI_THINKING' || state.phase === 'ENGINE_LOADING') this.cancel();
    if (state.phase !== 'PLAYER_TURN' || this.abort || state.history.length <= this.analyzed) return;
    const abort = new AbortController(); this.abort = abort;
    const revision = this.revision;
    // At most the latest human/AI pair. Never accumulate a background search backlog.
    const start = Math.max(this.analyzed,state.history.length-2);
    let engine:AnalysisEngine;
    try {engine = this.factory();} catch {
      this.abort = null; this.analyzed = state.history.length;
      this.publish({status:'局面分析暂不可用，仍可正常对弈'});return;
    }
    if (start > this.analyzed) this.balanced = 0;
    this.engine = engine;
    this.publish({status:'正在回看刚才的着法…'});
    void (async()=>{
      try {
        for (let index=start;index<state.history.length;index++) {
          const move = state.history[index];
          const initialFen = state.history[0].before;
          const moves = state.history.slice(0,index).map(uci);
          const before = await engine.analyze(move.before,{movetimeMs:700,signal:abort.signal,initialFen,moves});
          if (abort.signal.aborted || revision !== this.revision) return;
          const after = await engine.analyze(move.after,{movetimeMs:700,signal:abort.signal,initialFen,moves:[...moves,uci(move)]});
          if (abort.signal.aborted || revision !== this.revision) return;
          if (after?.stable && after.score.kind === 'cp') this.manager.assess(relativeScore(after,move.color === 'w' ? 'b' : 'w',state.settings.playerColor).value);
          const events = moveEvents(move,index+1,state.settings.playerColor,before,after);
          this.balanced = events.some(event=>event.kind==='balanced') ? this.balanced+1 : 0;
          this.speak(events); this.analyzed = index+1;
        }
        this.publish({status:'只评论已发生的棋局，不提供走法提示'});
      } catch {
        if (abort.signal.aborted || revision !== this.revision) return;
        // Known rule facts remain usable when evaluation is unavailable.
        const last = state.history.at(-1);
        if (last) this.speak(moveEvents(last,state.history.length,state.settings.playerColor));
        this.analyzed = state.history.length;
        this.publish({status:'局面分析暂不可用，仍可正常对弈'});
      } finally {
        engine.dispose();
        if (revision === this.revision) {this.engine = null;this.abort = null;}
      }
    })();
  }
  dispose() {this.closed = true;this.unsubscribe();this.cancel();this.listeners.clear();}
}
