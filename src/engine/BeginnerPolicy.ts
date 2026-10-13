/** Rules stay in chess.js. This policy only chooses among supplied legal moves. */
export function beginnerMove(recommended:string,legal:readonly string[],random:()=>number=Math.random):string {
  if (!legal.includes(recommended)) throw new Error('AI 返回非法走法，棋局已保留，请重试');
  const alternatives=legal.filter(move=>move!==recommended);
  if (!alternatives.length || random()>=.3) return recommended;
  return alternatives[Math.min(alternatives.length-1,Math.floor(random()*alternatives.length))];
}
