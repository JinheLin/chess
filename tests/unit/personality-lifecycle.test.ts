import { expect, test } from 'vitest';
import { GameController } from '../../src/game/GameController';
import type { AnalysisEngine, Evaluation } from '../../src/engine/AnalysisEngine';
import type { SearchOptions } from '../../src/engine/ChessEngine';
import { PersonalityEngine } from '../../src/personality/PersonalityEngine';
const flush = async()=>{for(let i=0;i<20;i++) await Promise.resolve();};
class Analyzer implements AnalysisEngine {
  requests:{options:SearchOptions;resolve:(e:Evaluation|null)=>void}[]=[];
  disposed=false;
  analyze(_fen:string,options:SearchOptions) {return new Promise<Evaluation|null>(resolve=>this.requests.push({options,resolve}));}
  dispose(){this.disposed=true;}
}
async function setup() {
  const game = new GameController(undefined,{mode:'ai',playerColor:'w',difficulty:0});
  let reply:(move:string)=>void = ()=>{};
  game.connectEngine(()=>({initialize:async()=>{},setDifficulty:async()=>{},getBestMove:()=>new Promise<string>(resolve=>{reply=resolve;}),dispose:()=>{}}));
  const analyzers:Analyzer[]=[];
  const personality = new PersonalityEngine(game,()=>{const a=new Analyzer();analyzers.push(a);return a;},{character:'victor',frequency:'normal',muted:false});
  personality.connect();await flush();game.move('e2','e4');await flush();
  expect(analyzers).toHaveLength(0); // Never compete with a playing search.
  reply('e7e5');await flush();
  return {game,personality,analyzers};
}
for (const action of ['undo','new','mute','character','dispose','next-move'] as const) {
  test(`${action} invalidates analysis even when the analyzer ignores cancellation`,async()=>{
    const {game,personality,analyzers}=await setup();const request=analyzers[0].requests[0];
    if(action==='undo') game.undo();
    if(action==='new') game.newGame();
    if(action==='mute') personality.configure({character:'victor',frequency:'normal',muted:true});
    if(action==='character') personality.configure({character:'alex',frequency:'normal',muted:false});
    if(action==='dispose') personality.dispose();
    if(action==='next-move') game.move('g1','f3');
    expect(request.options.signal?.aborted).toBe(true);expect(analyzers[0].disposed).toBe(true);
    request.resolve({depth:16,stable:true,score:{kind:'cp',value:900},pv:['e2e4']});await flush();
    expect(analyzers[0].requests).toHaveLength(1);expect(personality.getSnapshot().history).toEqual([]);
    personality.dispose();game.disconnectEngine();
  });
}
test('terminal line appears once, cancels analysis, and undo clears narrative',async()=>{
  const {game,personality,analyzers}=await setup();game.resign();game.resign();
  expect(personality.getSnapshot().history).toHaveLength(1);
  expect(personality.getSnapshot().history[0].kind).toBe('end');expect(analyzers[0].disposed).toBe(true);
  expect(personality.getSnapshot().history[0].text).toContain('我赢了');
  game.undo();expect(personality.getSnapshot().history).toEqual([]);
  personality.dispose();game.disconnectEngine();
});
test('analysis replays history and its failure cannot change the board',async()=>{
  const {game,personality,analyzers}=await setup();const a=analyzers[0],fen=game.getSnapshot().fen;
  expect(a.requests[0].options.moves).toEqual([]);a.requests[0].resolve(null);await flush();
  expect(a.requests[1].options.moves).toEqual(['e2e4']);a.requests[1].resolve(null);await flush();
  expect(a.requests[2].options.moves).toEqual(['e2e4']);a.requests[2].resolve(null);await flush();
  expect(a.requests[3].options.moves).toEqual(['e2e4','e7e5']);a.requests[3].resolve(null);await flush();
  expect(game.getSnapshot().fen).toBe(fen);expect(personality.getSnapshot().history).toEqual([]);expect(a.disposed).toBe(true);
  personality.dispose();game.disconnectEngine();
});
test('observer reconnect is safe and local games never analyze or speak',()=>{
  const game = new GameController();let calls=0;
  const personality = new PersonalityEngine(game,()=>{calls++;throw new Error('unavailable');},{character:'alex',frequency:'normal',muted:false});
  personality.connect();personality.dispose();personality.connect();game.move('e2','e4');game.resign();
  expect(calls).toBe(0);expect(personality.getSnapshot().history).toEqual([]);personality.dispose();
});
