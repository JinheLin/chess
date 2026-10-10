import { Chess } from 'chess.js';
import type { Color } from 'chess.js';
export const colorName = (color: Color) => color === 'w' ? '白方' : '黑方';
export function resultOf(chess: Chess): string | null {
  if (chess.isCheckmate()) return `${colorName(chess.turn() === 'w' ? 'b' : 'w')}获胜 · 将死`;
  if (chess.isStalemate()) return '和棋 · 逼和';
  if (chess.isInsufficientMaterial()) return '和棋 · 子力不足';
  if (chess.isThreefoldRepetition()) return '和棋 · 三次重复局面';
  if (chess.isDrawByFiftyMoves()) return '和棋 · 五十步规则';
  return null;
}
