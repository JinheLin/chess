export const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
export interface PlayUsage { id: string; startedAt: string }
export interface PlayUsageStore { read(): PlayUsage[]; write(usage: readonly PlayUsage[]): void }
export interface PlayLimit {
  fourHourCount: number;
  dailyCount: number;
  reached: boolean;
  blocked: boolean;
  nextAllowedAt: number | null;
  refreshAt: number;
}
function dayBounds(now: number) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [start.getTime(), end.getTime()];
}
export function validatePlayUsage(value: unknown): PlayUsage[] {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('无效防沉迷计数');
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || typeof item.startedAt !== 'string' || !Number.isFinite(Date.parse(item.startedAt))) throw new Error('无效防沉迷计数');
    ids.add(item.id);
  }
  return structuredClone(value) as PlayUsage[];
}
export function mergePlayUsage(a: readonly PlayUsage[], b: readonly PlayUsage[], now = Date.now()): PlayUsage[] {
  const cutoff = Math.min(dayBounds(now)[0], now - FOUR_HOURS_MS);
  const entries = new Map<string, PlayUsage>();
  for (const item of [...a, ...b]) {
    const previous = entries.get(item.id);
    if (Date.parse(item.startedAt) >= cutoff && (!previous || Date.parse(item.startedAt) < Date.parse(previous.startedAt))) entries.set(item.id, { ...item });
  }
  return [...entries.values()].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}
export function playLimit(usage: readonly PlayUsage[], active: boolean, now = Date.now()): PlayLimit {
  const [dayStart, dayEnd] = dayBounds(now);
  const times = usage.map(item => Date.parse(item.startedAt)).sort((a, b) => a - b);
  const recent = times.filter(time => time > now - FOUR_HOURS_MS);
  const dailyCount = times.filter(time => time >= dayStart && time < dayEnd).length;
  const reached = recent.length >= 3 || dailyCount >= 9;
  const nextAllowedAt = reached ? Math.max(recent.length >= 3 ? recent[recent.length - 3] + FOUR_HOURS_MS : 0, dailyCount >= 9 ? dayEnd : 0) : null;
  return { fourHourCount: recent.length, dailyCount, reached, blocked: reached && !active, nextAllowedAt, refreshAt: Math.min(recent[0] === undefined ? dayEnd : recent[0] + FOUR_HOURS_MS, dayEnd) };
}
export function playLimitMessage(limit: PlayLimit): string {
  const reasons = [limit.fourHourCount >= 3 ? '最近4小时已玩满3局' : '', limit.dailyCount >= 9 ? '今天已玩满9局' : ''].filter(Boolean).join('，');
  const time = limit.nextAllowedAt === null ? '' : new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(limit.nextAllowedAt);
  return `防沉迷提醒：${reasons}。请休息一下，${time}后可开始新局。`;
}
