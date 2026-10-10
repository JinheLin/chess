import type { Color, Move } from 'chess.js';
const names: Record<string,string> = {p:'兵',n:'马',b:'象',r:'车',q:'后'};
const glyphs: Record<Color,Record<string,string>> = { w:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛'}, b:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕'} };
export function CapturedPieces({history, color}: {history: readonly Move[]; color: Color}) {
  const pieces = history.filter(move => move.color === color && move.captured).map(move => move.captured!);
  return <div className="captured" aria-label={`${color === 'w' ? '白方' : '黑方'}吃子`}>
    <span className="captured-label">吃子</span>{pieces.length ? pieces.map((piece,index) => <span key={index} role="img" aria-label={names[piece]}>{glyphs[color][piece]}</span>) : <span className="captured-empty">—</span>}
  </div>;
}
