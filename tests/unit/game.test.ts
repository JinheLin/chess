import { describe, expect, test } from 'vitest';
import { GameController } from '../../src/game/GameController';
import type { Square } from 'chess.js';
const play = (game: GameController, moves: string[]) => moves.forEach(move => expect(game.move(move.slice(0,2) as Square, move.slice(2) as Square)).toBe(true));

describe('authoritative rules and state transitions', () => {
  test('illegal move leaves FEN and history unchanged', () => {
    const game = new GameController(); const before = game.getSnapshot();
    expect(game.move('e2','e5')).toBe(false); expect(game.getSnapshot()).toBe(before);
  });
  test('turn enforcement and undo restore exact state', () => {
    const game = new GameController(); const initial = game.getSnapshot().fen;
    play(game,['e2e4','e7e5']); expect(game.move('d7','d5')).toBe(false);
    game.undo(); expect(game.getSnapshot().turn).toBe('b'); game.undo();
    expect(game.getSnapshot().fen).toBe(initial); expect(game.getSnapshot().history).toHaveLength(0);
  });
  test('castling moves rook, but cannot cross an attacked square', () => {
    const game = new GameController('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    expect(game.move('e1','g1')).toBe(true); expect(game.getSnapshot().fen).toContain('R4RK1');
    const attacked = new GameController('r3kr1r/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    expect(attacked.move('e1','g1')).toBe(false);
  });
  test('en passant is available immediately and removes the pawn', () => {
    const game = new GameController(); play(game,['e2e4','a7a6','e4e5','d7d5','e5d6']);
    expect(game.getSnapshot().history.at(-1)?.isEnPassant()).toBe(true);
    expect(game.getSnapshot().fen.split('/')[3]).toBe('8');
  });
  test('en passant expires after one turn', () => {
    const game = new GameController(); play(game,['e2e4','a7a6','e4e5','d7d5','h2h3','a6a5']);
    expect(game.move('e5','d6')).toBe(false);
  });
  test.each(['q','r','b','n'] as const)('promotion to %s requires selection before mutation', piece => {
    const game = new GameController('7k/P7/8/8/8/8/8/7K w - - 0 1'); const fen = game.getSnapshot().fen;
    game.move('a7','a8'); expect(game.getSnapshot().phase).toBe('PROMOTION_PENDING');
    expect(game.getSnapshot().fen).toBe(fen); expect(game.move('h1','g1')).toBe(false);
    game.promote(piece); expect(game.getSnapshot().history.at(-1)?.promotion).toBe(piece);
  });
  test('promotion cancellation and reset discard pending move', () => {
    const game = new GameController('7k/P7/8/8/8/8/8/7K w - - 0 1');
    game.move('a7','a8'); game.cancelPromotion(); expect(game.getSnapshot().history).toHaveLength(0);
    game.move('a7','a8'); game.newGame(); game.promote('q'); expect(game.getSnapshot().history).toHaveLength(0);
  });
  test('checkmate freezes play and undo reopens game', () => {
    const game = new GameController(); play(game,['f2f3','e7e5','g2g4','d8h4']);
    expect(game.getSnapshot().result).toBe('黑方获胜 · 将死'); expect(game.move('a2','a3')).toBe(false);
    game.undo(); expect(game.getSnapshot().phase).toBe('PLAYER_TURN');
  });
  test.each([
    ['7k/5Q2/6K1/8/8/8/8/8 b - - 0 1','和棋 · 逼和'],
    ['7k/8/6K1/8/8/8/8/8 w - - 0 1','和棋 · 子力不足'],
    ['7k/8/6K1/8/8/8/8/R7 w - - 100 1','和棋 · 五十步规则'],
  ])('draw detection: %s', (fen,result) => expect(new GameController(fen).getSnapshot().result).toBe(result));
  test('threefold repetition uses full history and undo removes draw', () => {
    const game = new GameController(); play(game,['g1f3','g8f6','f3g1','f6g8','g1f3','g8f6','f3g1','f6g8']);
    expect(game.getSnapshot().result).toBe('和棋 · 三次重复局面'); game.undo(); expect(game.getSnapshot().result).toBeNull();
  });
  test('resignation, undo and reset are consistent', () => {
    const game = new GameController(); game.resign(); expect(game.getSnapshot().result).toBe('黑方获胜 · 白方认输');
    game.undo(); expect(game.getSnapshot().result).toBeNull(); game.resign(); game.newGame(); expect(game.getSnapshot().phase).toBe('PLAYER_TURN');
  });
  test('cannot expose own king', () => {
    const game = new GameController('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1'); expect(game.move('e2','d2')).toBe(false);
  });
});
