import { describe, expect, test } from 'vitest';
import { Chess } from 'chess.js';
import { parseInfo, stableEvaluation } from '../../src/engine/AnalysisEngine';
import type { Evaluation } from '../../src/engine/AnalysisEngine';
import { moveEvents, relativeScore } from '../../src/personality/PositionAnalyzer';
import type { ChessEvent } from '../../src/personality/PositionAnalyzer';
import { CommentaryGenerator, CommentaryScheduler, PersonalityManager } from '../../src/personality/Personality';
const cp = (value:number,pv=['e2e4']):Evaluation=>({depth:14,stable:true,score:{kind:'cp',value},pv});
const event = (kind:ChessEvent['kind'],ply=1,actor:ChessEvent['actor']='player'):ChessEvent=>({kind,ply,actor,important:kind!=='capture',fact:'已发生的事实'});
describe('position facts and conservative judgments',()=>{
  test('UCI parser rejects bounds, missing PV and secondary lines; stability needs independent deep iterations',()=>{
    expect(parseInfo('info depth 15 score cp 55 lowerbound pv e2e4')).toBeNull();
    expect(parseInfo('info depth 15 multipv 2 score cp 55 pv e2e4')).toBeNull();
    expect(parseInfo('info depth 15 score cp 55')).toBeNull();
    expect(stableEvaluation([cp(40),cp(40)])?.stable).toBe(false);
    expect(stableEvaluation([{...cp(40),depth:10},{...cp(150),depth:11}])?.stable).toBe(false);
    expect(stableEvaluation([{...cp(40),depth:10},{...cp(50),depth:11}])?.stable).toBe(true);
  });
  test('score is normalized to either player color; cp loss is not material',()=>{
    expect(relativeScore(cp(100),'w','b').value).toBe(-100);
    const move = new Chess().move('e4');
    expect(moveEvents(move,1,'w',cp(40),cp(250)).map(e=>e.kind)).toContain('blunder');
    expect(moveEvents(move,1,'b',cp(40),cp(250)).find(e=>e.kind==='blunder')?.actor).toBe('ai');
  });
  test('uncertain scores never accuse; mate values never enter cp subtraction',()=>{
    const move = new Chess().move('e4');
    expect(moveEvents(move,1,'w',{...cp(40),stable:false},cp(900))).toEqual([]);
    const mate = {...cp(1),score:{kind:'mate' as const,value:3}};
    expect(moveEvents(move,1,'w',cp(40),mate).map(e=>e.kind)).toEqual(['mate']);
  });
  test('taking a queen is a fact, not proof of a winning position or a brilliant move',()=>{
    const game = new Chess('4k3/8/8/8/8/8/4q3/4R1K1 w - - 0 1');
    const move = game.move('Rxe2+');
    const facts = moveEvents(move,1,'w');
    expect(facts.map(e=>e.kind)).toEqual(['check','capture']);
    expect(facts.every(e=>e.playerAdvantage===undefined)).toBe(true);
    expect(moveEvents(move,1,'w',cp(0,['g1h1']),cp(0)).some(e=>e.kind==='brilliant')).toBe(false);
    expect(moveEvents(move,1,'w',cp(0,['e1e2']),cp(0)).some(e=>e.kind==='brilliant')).toBe(true);
  });
  test('an ordinary best opening move is not labeled brilliant',()=>{
    expect(moveEvents(new Chess().move('e4'),1,'w',cp(20),cp(-20)).some(e=>e.kind==='brilliant')).toBe(false);
  });
});
describe('emotion, memory and speech timing',()=>{
  test('AI admits its own error; player praise builds respect and stays bounded',()=>{
    const manager = new PersonalityManager(), generator = new CommentaryGenerator();
    const mistake = event('blunder',1,'ai');manager.update(mistake);
    expect(generator.generate(mistake,'victor',manager)).toContain('我的问题');
    expect(manager.state.frustration).toBeGreaterThan(0);
    for(let i=0;i<20;i++) manager.update(event('brilliant',i));
    expect(manager.state.respect).toBe(100);
    expect(generator.generate(event('brilliant',25),'alex',manager)).toContain('不止一次');
  });
  test('a comeback references a taunt only if it was actually spoken this game',()=>{
    const manager = new PersonalityManager(), generator = new CommentaryGenerator();
    generator.generate(event('blunder',8),'victor',manager);
    const reversal = {...event('reversal',24),playerAdvantage:200};manager.update(reversal);
    expect(generator.generate(reversal,'victor',manager)).toContain('后悔刚才');
    expect(new CommentaryGenerator().generate(reversal,'victor',new PersonalityManager())).not.toContain('后悔刚才');
  });
  test('cooldown, semantic dedup, variable gaps and one terminal line',()=>{
    const scheduler = new CommentaryScheduler(()=>.99);
    expect(scheduler.allow(event('capture',1),'normal',0)).toBe(true);
    expect(scheduler.allow(event('promotion',2),'normal',1000)).toBe(false);
    expect(scheduler.allow(event('check',2),'normal',3000)).toBe(true);
    expect(scheduler.allow(event('check',4),'normal',20000)).toBe(false);
    expect(scheduler.allow(event('capture',13),'normal',30000)).toBe(true);
    expect(scheduler.allow(event('end',13),'quiet',30001)).toBe(true);
    expect(scheduler.allow(event('end',13),'quiet',30002)).toBe(false);
  });
  test('phrases do not repeat soon and do not expose PV moves',()=>{
    const g = new CommentaryGenerator(), m = new PersonalityManager();
    const a = g.generate(event('capture',1),'alex',m), b = g.generate(event('capture',13),'alex',m);
    expect(a).not.toBe(b);expect(g.generate(event('capture',14),'alex',m)).toBeNull();
    expect(g.generate(event('capture',30),'alex',m)).toBe(a);
    expect(a).not.toMatch(/[a-h][1-8]/);
  });
});
test('sustained advantage builds confidence independently from character and playing strength',()=>{
  const manager = new PersonalityManager();
  for(let i=0;i<3;i++) manager.assess(-200);
  expect(manager.state.confidence).toBe(59);
  for(let i=0;i<100;i++) manager.assess(200);
  expect(manager.state.confidence).toBe(0);
});
