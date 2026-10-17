export const DEFAULT_BEGINNER_RANDOM_PERCENT = 20;
export const BEGINNER_RANDOM_PERCENT_OPTIONS = [10,20,30,40,50,60,70,80,90,100] as const;
export const DEFAULT_BEGINNER_MAX_DEPTH = 4;
export const BEGINNER_MAX_DEPTH_OPTIONS = [1,2,3,4,5,6,7,8,9,10] as const;
export const DEFAULT_BEGINNER_MOVETIME_MS = 220;
export const BEGINNER_MOVETIME_OPTIONS = [50,100,150,220,300,500,800,1000,1500,2000] as const;

export function validateBeginnerRandomPercent(value: unknown): void {
  if (value !== undefined && !BEGINNER_RANDOM_PERCENT_OPTIONS.some(percent => percent === value)) {
    throw new Error('无效的入门随机走法概率');
  }
}

export function validateBeginnerSettings(settings: { beginnerRandomPercent?: unknown; beginnerMaxDepth?: unknown; beginnerMovetimeMs?: unknown }): void {
  validateBeginnerRandomPercent(settings.beginnerRandomPercent);
  if (settings.beginnerMaxDepth !== undefined && !BEGINNER_MAX_DEPTH_OPTIONS.some(depth => depth === settings.beginnerMaxDepth)) {
    throw new Error('无效的入门搜索深度');
  }
  if (settings.beginnerMovetimeMs !== undefined && !BEGINNER_MOVETIME_OPTIONS.some(time => time === settings.beginnerMovetimeMs)) {
    throw new Error('无效的入门思考时间');
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
