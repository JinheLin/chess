export const DEFAULT_BEGINNER_RANDOM_PERCENT = 20;
export const BEGINNER_RANDOM_PERCENT_OPTIONS = [10,20,30,40,50,60,70,80,90,100] as const;

export function validateBeginnerRandomPercent(value: unknown): void {
  if (value !== undefined && !BEGINNER_RANDOM_PERCENT_OPTIONS.some(percent => percent === value)) {
    throw new Error('无效的入门随机走法概率');
  }
}

/** Rules stay in chess.js. This policy only chooses among supplied legal moves. */
export function beginnerMove(recommended:string,legal:readonly string[],randomPercent=DEFAULT_BEGINNER_RANDOM_PERCENT,random:()=>number=Math.random):string {
  validateBeginnerRandomPercent(randomPercent);
  if (!legal.includes(recommended)) throw new Error('AI 返回非法走法，棋局已保留，请重试');
  const alternatives=legal.filter(move=>move!==recommended);
  if (!alternatives.length || random()>=randomPercent/100) return recommended;
  return alternatives[Math.min(alternatives.length-1,Math.floor(random()*alternatives.length))];
}
