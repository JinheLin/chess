import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { GameController } from '../../src/game/GameController';
import { PlayLimitSpeech } from '../../src/audio/PlayLimitSpeech';
import { FOUR_HOURS_MS } from '../../src/game/PlayLimit';
const start = new Date(2026, 9, 12, 8).getTime();
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(start); });
afterEach(() => vi.useRealTimers());
function setup(blocked = false) {
  const game = new GameController();
  if (blocked) for (let i = 0; i < 3; i++) { if (i) game.newGame(); game.resign(); }
  const said: SpeechSynthesisUtterance[] = [];
  const voice = { lang: 'zh-CN', localService: true } as SpeechSynthesisVoice;
  const port = { getVoices: () => [voice], cancel: vi.fn(), speak: vi.fn((u: SpeechSynthesisUtterance) => said.push(u)) };
  const speech = new PlayLimitSpeech(game, port, text => ({ text } as SpeechSynthesisUtterance)); speech.connect();
  return { game, speech, said, port, voice };
}
test('the third game may finish; its limit then speaks once, with Chinese voice and recovery time', () => {
  const s = setup(); s.speech.activate();
  for (let i = 0; i < 3; i++) { if (i) s.game.newGame(); s.game.resign(); }
  expect(s.said).toHaveLength(0); vi.advanceTimersByTime(100);
  expect(s.said).toHaveLength(1); expect(s.said[0].voice).toBe(s.voice);
  expect(s.said[0].text).toContain('防沉迷提醒'); expect(s.said[0].text).toContain('3局'); expect(s.said[0].text).toContain('后可开始新局');
  s.game.refreshPlayLimit(); s.game.newGame(); vi.advanceTimersByTime(100); expect(s.said).toHaveLength(1); s.speech.dispose();
});
test('a restored blocked page waits for the first gesture, and activation never repeats automatically', () => {
  const s = setup(true); vi.advanceTimersByTime(100); expect(s.said).toHaveLength(0);
  s.speech.activate(); vi.advanceTimersByTime(100); expect(s.said).toHaveLength(1);
  s.speech.activate(); s.game.refreshPlayLimit(); vi.advanceTimersByTime(100); expect(s.said).toHaveLength(1);
  s.speech.repeat(); vi.advanceTimersByTime(100); expect(s.said).toHaveLength(2); s.speech.dispose();
});
test('a reminder waiting for playback is canceled when the limit expires or the component leaves', () => {
  const s = setup(true); s.speech.activate(); vi.setSystemTime(start + FOUR_HOURS_MS); s.game.refreshPlayLimit();
  vi.advanceTimersByTime(100); expect(s.said).toHaveLength(0); s.speech.dispose();
  const t = setup(true); t.speech.activate(); t.speech.dispose(); vi.advanceTimersByTime(100); expect(t.said).toHaveLength(0);
});
test('speech errors and unsupported browsers keep the quota and visible-message data intact', () => {
  const s = setup(true); s.port.speak.mockImplementation(() => { throw new Error('blocked'); });
  s.speech.activate(); vi.advanceTimersByTime(100); expect(s.speech.getSnapshot().error).toContain('未成功');
  expect(s.game.getSnapshot().playLimit.blocked).toBe(true);
  const unsupported = new PlayLimitSpeech(s.game, null); unsupported.connect(); unsupported.activate();
  expect(unsupported.getSnapshot().supported).toBe(false); expect(s.game.newGame()).toBe(false);
  unsupported.dispose(); s.speech.dispose();
});
test('StrictMode cleanup and reconnect preserve one pending reminder', () => {
  const s = setup(true); s.speech.dispose(); s.speech.connect(); s.speech.activate(); vi.advanceTimersByTime(100);
  expect(s.said).toHaveLength(1); s.speech.dispose();
});
test('repeating after the rolling cap expires describes only the still-active daily cap', () => {
  const s = setup();
  const day = new Date(2026, 9, 12).getTime();
  const usage = [0, 4, 8].flatMap(hour => [0, 1, 2].map(i => ({ id: `${hour}-${i}`, startedAt: new Date(day + hour * 3600000).toISOString() })));
  s.game.connectPlayUsageStore({ read: () => usage, write: () => {} });
  s.speech.activate(); vi.advanceTimersByTime(100); expect(s.said[0].text).toContain('最近4小时');
  vi.setSystemTime(start + FOUR_HOURS_MS); s.game.refreshPlayLimit(); s.speech.repeat(); vi.advanceTimersByTime(100);
  expect(s.said.at(-1)?.text).toContain('今天已玩满9局'); expect(s.said.at(-1)?.text).not.toContain('最近4小时');
  s.speech.dispose();
});
