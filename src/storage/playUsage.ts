import { validatePlayUsage } from '../game/PlayLimit';
import type { PlayUsageStore } from '../game/PlayLimit';
import type { StoragePort } from './session';

export const PLAY_USAGE_KEY = 'chess-lab.play-usage.v1';
export function playUsageStore(storage: () => StoragePort): PlayUsageStore {
  return {
    read() {
      const raw = storage().getItem(PLAY_USAGE_KEY);
      if (!raw) return [];
      if (raw.length > 200000) throw new Error('防沉迷计数过大');
      const data = JSON.parse(raw);
      if (data?.version !== 1) throw new Error('无效防沉迷计数');
      return validatePlayUsage(data.usage);
    },
    write(usage) { storage().setItem(PLAY_USAGE_KEY, JSON.stringify({ version: 1, usage })); },
  };
}
