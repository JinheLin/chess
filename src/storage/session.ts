import { GameController } from '../game/GameController';
export const SESSION_KEY = 'chess-lab.session.v1';
export interface Preferences { flipped: boolean; sound: boolean }
export interface StoragePort { getItem(key: string): string | null; setItem(key: string, value: string): void }
const browserStorage = () => window.localStorage;
export function loadSession(storage: () => StoragePort = browserStorage) {
  const fresh = () => ({ controller: new GameController(undefined, {mode:'ai',playerColor:'w',difficulty:1}), preferences: {flipped:false,sound:true}, notice: '' });
  let raw: string | null;
  try { raw = storage().getItem(SESSION_KEY); }
  catch { return { ...fresh(), notice: '浏览器不允许本地保存，本局仍可正常对弈。' }; }
  if (!raw) return fresh();
  try {
    if (raw.length > 1000000) throw new Error('存档过大');
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || typeof data.preferences?.flipped !== 'boolean' || typeof data.preferences?.sound !== 'boolean') throw new Error('无效存档');
    const controller = GameController.restore(data.game);
    return {controller, preferences: {flipped:data.preferences.flipped as boolean,sound:data.preferences.sound as boolean}, notice: '已恢复上次对局，完整棋谱已保留。'};
  } catch { return { ...fresh(), notice: '上次存档无法读取，已开始新局。' }; }
}
export function saveSession(controller: GameController, preferences: Preferences, storage: () => StoragePort = browserStorage): boolean {
  try { storage().setItem(SESSION_KEY, JSON.stringify({version:1,game:controller.save(),preferences})); return true; }
  catch { return false; }
}
