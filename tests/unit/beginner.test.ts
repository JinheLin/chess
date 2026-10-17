import {afterEach,expect,test,vi} from 'vitest';
import {beginnerMove} from '../../src/engine/BeginnerPolicy';
import {GameController} from '../../src/game/GameController';
import {validateGameRecords} from '../../src/game/GameRecord';
import type {SearchOptions} from '../../src/engine/ChessEngine';
afterEach(()=>vi.restoreAllMocks());
test('beginner policy sometimes misses the recommendation but can only select a legal move',()=>{
  expect(beginnerMove('e2e4',['e2e4','a2a3'],undefined,()=>0)).toBe('a2a3');
  expect(beginnerMove('e2e4',['e2e4','a2a3'],undefined,()=>.199)).toBe('a2a3');
  expect(beginnerMove('e2e4',['e2e4','a2a3'],undefined,()=>.2)).toBe('e2e4');
  expect(beginnerMove('e2e4',['e2e4','a2a3'],undefined,()=>.299)).toBe('e2e4');
  expect(beginnerMove('e2e4',['e2e4','a2a3'],undefined,()=>.3)).toBe('e2e4');
  expect(beginnerMove('e2e4',['e2e4','a2a3'],undefined,()=>.39)).toBe('e2e4');
  expect(beginnerMove('e2e4',['e2e4','a2a3'],undefined,()=>.8)).toBe('e2e4');
  expect(beginnerMove('a7a8q',['a7a8q'],100,()=>0)).toBe('a7a8q');
  expect(beginnerMove('a7a8q',['a7a8q','a7a8n'],100,()=>0)).toBe('a7a8n');
  expect(()=>beginnerMove('e2e5',['e2e4'],undefined,()=>0)).toThrow('非法');
});
test.each([
  [10,.099,'a2a3'],[10,.1,'e2e4'],[30,.299,'a2a3'],[30,.3,'e2e4'],[100,.999,'a2a3'],
])('random probability %i%% uses its configured boundary at %f',(percent,roll,expected)=>{
  expect(beginnerMove('e2e4',['e2e4','a2a3'],percent,()=>roll)).toBe(expected);
});
test.each([[3,10,true],[3,30,false],[3,100,false],[0,100,true]] as const)('controller applies probability %i/%i only to entry games',async(difficulty,beginnerRandomPercent,recommended)=>{
  vi.spyOn(Math,'random').mockReturnValue(.25);
  const game=new GameController(undefined,{mode:'ai',playerColor:'b',difficulty,beginnerRandomPercent});
  game.connectEngine(()=>({initialize:async()=>{},setDifficulty:async()=>{},getBestMove:async()=> 'e2e4',dispose:()=>{}}));
  for(let i=0;i<20;i++) await Promise.resolve();
  expect(game.getSnapshot().history).toHaveLength(1);
  expect(game.getSnapshot().history[0].lan==='e2e4').toBe(recommended);
  game.disconnectEngine();
});
test('new difficulty survives saves, limits playing search, and exports its distinct identity',async()=>{
  const game=new GameController(undefined,{mode:'ai',playerColor:'b',difficulty:3});
  let options:SearchOptions|undefined;
  game.connectEngine(()=>({initialize:async()=>{},setDifficulty:async level=>{expect(level).toBe(0);},getBestMove:async(_fen,o)=>{options=o;return 'e2e4';},dispose:()=>{}}));
  for(let i=0;i<20;i++) await Promise.resolve();
  expect(options).toMatchObject({movetimeMs:220,maxDepth:4});
  expect(game.getSnapshot().history).toHaveLength(1);
  expect(GameController.restore(game.save()).getSnapshot().settings.difficulty).toBe(3);
  expect(game.exportPgn()).toContain('Beginner policy');game.disconnectEngine();
  expect(GameController.restore(game.save()).exportPgn()).toContain('[BeginnerRandomPercent "20"]');
  for(const difficulty of [0,1,2] as const) expect(GameController.restore(new GameController(undefined,{mode:'ai',playerColor:'w',difficulty}).save()).getSnapshot().settings.difficulty).toBe(difficulty);
});
test('custom probability survives saves, records, PGN export and subsequent new games',()=>{
  const game=new GameController(undefined,{mode:'ai',playerColor:'w',difficulty:3,beginnerRandomPercent:40});
  const restored=GameController.restore(game.save());
  expect(restored.getSnapshot().settings.beginnerRandomPercent).toBe(40);
  expect(restored.exportPgn()).toContain('[BeginnerRandomPercent "40"]');
  restored.resign();
  const records=validateGameRecords(restored.getSnapshot().records);
  expect(records[0].settings.beginnerRandomPercent).toBe(40);
  restored.newGame();
  expect(restored.getSnapshot().settings.beginnerRandomPercent).toBe(40);
});
test('invalid probabilities are rejected before changing the game or accepting saved data',()=>{
  const game=new GameController(); game.move('e2','e4');
  const saved=game.save(),snapshot=game.getSnapshot();
  game.resign(); const [record]=game.getSnapshot().records;
  const ongoing=GameController.restore(saved),before=ongoing.getSnapshot();
  for(const beginnerRandomPercent of [-10,0,15,101,20.5,'20',null,NaN,Infinity]) {
    const settings={...saved.settings,beginnerRandomPercent};
    expect(()=>GameController.restore({...saved,settings})).toThrow('概率');
    expect(()=>validateGameRecords([{...record,settings}])).toThrow('概率');
    expect(()=>ongoing.newGame(settings as typeof saved.settings)).toThrow('概率');
    expect(ongoing.getSnapshot()).toBe(before);
  }
  expect(ongoing.getSnapshot().fen).toBe(snapshot.fen);
});
