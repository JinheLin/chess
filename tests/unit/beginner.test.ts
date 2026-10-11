import {expect,test} from 'vitest';
import {beginnerMove} from '../../src/engine/BeginnerPolicy';
import {GameController} from '../../src/game/GameController';
import type {SearchOptions} from '../../src/engine/ChessEngine';
test('beginner policy sometimes misses the recommendation but can only select a legal move',()=>{
  expect(beginnerMove('e2e4',['e2e4','a2a3'],()=>0)).toBe('a2a3');
  expect(beginnerMove('e2e4',['e2e4','a2a3'],()=>.8)).toBe('e2e4');
  expect(beginnerMove('a7a8q',['a7a8q'],()=>0)).toBe('a7a8q');
  expect(beginnerMove('a7a8q',['a7a8q','a7a8n'],()=>0)).toBe('a7a8n');
  expect(()=>beginnerMove('e2e5',['e2e4'],()=>0)).toThrow('非法');
});
test('new difficulty survives saves, limits playing search, and exports its distinct identity',async()=>{
  const game=new GameController(undefined,{mode:'ai',playerColor:'b',difficulty:3});
  let options:SearchOptions|undefined;
  game.connectEngine(()=>({initialize:async()=>{},setDifficulty:async level=>{expect(level).toBe(0);},getBestMove:async(_fen,o)=>{options=o;return 'e2e4';},dispose:()=>{}}));
  for(let i=0;i<20;i++) await Promise.resolve();
  expect(options).toMatchObject({movetimeMs:120,maxDepth:2});
  expect(game.getSnapshot().history).toHaveLength(1);
  expect(GameController.restore(game.save()).getSnapshot().settings.difficulty).toBe(3);
  expect(game.exportPgn()).toContain('Beginner policy');game.disconnectEngine();
  for(const difficulty of [0,1,2] as const) expect(GameController.restore(new GameController(undefined,{mode:'ai',playerColor:'w',difficulty}).save()).getSnapshot().settings.difficulty).toBe(difficulty);
});
