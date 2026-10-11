import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import type { GameController } from '../game/GameController';
import type { GameState } from '../game/GameState';

export function GameBoard({ controller, state, flipped }: { controller: GameController; state: GameState; flipped: boolean }) {
  const [selected, select] = useState<Square | null>(null);
  const styles: Record<string, CSSProperties> = {};
  const last = state.history.at(-1);
  if (last) for (const square of [last.from, last.to]) styles[square] = { backgroundColor: '#cfcb78' };
  if (state.checkedKing) styles[state.checkedKing] = { background: 'radial-gradient(ellipse, #e55d52 10%, #cc726a 85%)' };
  if (selected) {
    styles[selected] = { backgroundColor: '#e0c478' };
    for (const move of controller.legalMoves(selected)) styles[move.to] = { backgroundImage: move.captured ? 'radial-gradient(transparent 57%, #203f3b66 60%, #203f3b66 70%, transparent 73%)' : 'radial-gradient(#213e3b55 22%, transparent 24%)' };
  }
  const click = (square: Square) => {
    if (selected && selected !== square) {
      const legal = controller.legalMoves(selected).some(move => move.to === square);
      if (legal) { controller.move(selected, square); select(null); return; }
    }
    select(selected !== square && controller.canSelect(square) ? square : null);
  };
  return <div className="board-frame" aria-label="国际象棋棋盘">
    <Chessboard options={{
      id: 'chess-lab', position: state.fen, boardOrientation: flipped ? 'black' : 'white',
      darkSquareStyle: { backgroundColor: '#6b8b78' }, lightSquareStyle: { backgroundColor: '#eeecdf' },
      darkSquareNotationStyle: { color: '#f5f2e9', fontSize: 12 }, lightSquareNotationStyle: { color: '#446351', fontSize: 12 },
      squareStyles: styles, animationDurationInMs: 180, allowDrawingArrows: false,
      allowDragging: state.phase === 'PLAYER_TURN',
      canDragPiece: ({ square }) => !!square && controller.canSelect(square as Square),
      onPieceDrag: ({ square }) => select(square as Square),
      onPieceDragCancel: () => select(null),
      onSquareClick: ({ square }) => click(square as Square),
      onPieceDrop: ({ sourceSquare, targetSquare }) => { select(null); return !!targetSquare && controller.move(sourceSquare as Square, targetSquare as Square); },
      squareRenderer: ({ square, children }) => <div data-testid={`square-${square}`} style={{width:'100%',height:'100%',...styles[square]}}>{children}</div>,
    }} />
    {state.phase === 'ENGINE_LOADING' && <div className="board-loading" aria-hidden="true"><span className="spinner" /><span>正在准备 Stockfish</span></div>}
  </div>;
}
