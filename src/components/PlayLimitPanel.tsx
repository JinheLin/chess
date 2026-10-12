import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameController } from '../game/GameController';
import type { PlayLimit } from '../game/PlayLimit';
import { playLimitMessage } from '../game/PlayLimit';
import { PlayLimitSpeech } from '../audio/PlayLimitSpeech';

export function PlayLimitPanel({ controller, limit }: { controller: GameController; limit: PlayLimit }) {
  const [speech] = useState(() => new PlayLimitSpeech(controller));
  const voice = useSyncExternalStore(speech.subscribe, speech.getSnapshot);
  useEffect(() => {
    speech.connect();
    document.addEventListener('click', speech.activate);
    document.addEventListener('keydown', speech.activate);
    document.addEventListener('touchend', speech.activate, { capture: true, passive: true });
    return () => { document.removeEventListener('click', speech.activate); document.removeEventListener('keydown', speech.activate); document.removeEventListener('touchend', speech.activate, true); speech.dispose(); };
  }, [speech]);
  useEffect(() => {
    const timer = setTimeout(controller.refreshPlayLimit, Math.max(1, limit.refreshAt - Date.now() + 1));
    return () => clearTimeout(timer);
  }, [controller, limit.refreshAt]);
  return <div className="play-limit-panel">
    <div className="play-usage" role="status" aria-label="防沉迷用量">最近 4 小时：{limit.fourHourCount} / 3 局 <span>·</span> 今日：{limit.dailyCount} / 9 局{limit.reached && !limit.blocked && <small>本局可继续，结束后请休息。</small>}</div>
    {limit.blocked && <section className="play-limit-warning" role="alert" aria-label="防沉迷提示">
      <h2>该休息一下了</h2><p>{playLimitMessage(limit)}</p>
      <button onClick={speech.repeat} disabled={!voice.supported}>再次朗读</button>
      <small role="status" aria-label="防沉迷语音状态">{!voice.supported ? '此浏览器不支持语音提醒。' : voice.error}</small>
    </section>}
  </div>;
}
