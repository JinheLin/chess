import type { GameCoach, CoachState } from '../coaching/GameCoach';
import type { GameState } from '../game/GameState';

export function CoachPanel({ coach, coaching, game }: { coach: GameCoach; coaching: CoachState; game: GameState }) {
  const ready = game.phase === 'PLAYER_TURN';
  return <section className="coach-panel" aria-label="指导棋">
    <div className="coach-heading"><h2>✧ 下指导棋</h2><button onClick={() => coaching.hint ? coach.hideHint() : coach.requestHint()} disabled={!ready || !!coaching.busy}>{coaching.busy === 'hint' ? '正在找建议…' : coaching.hint ? '隐藏提示' : '给我提示'}</button></div>
    <div className="coach-content" role="status" aria-live="polite">
      {coaching.hint && <div className="coach-hint"><strong>可以考虑：{coaching.hint.text}</strong><p>{coaching.hint.lesson}</p><small>棋盘上的蓝色格标出起点与落点，请自行走棋。搜索建议仅供参考。</small></div>}
      {coaching.feedback && <p className="coach-feedback"><strong>上一步点评：</strong>{coaching.feedback}</p>}
      {coaching.busy === 'review' && <p>正在回看你上一步的走法…</p>}
      {!coaching.busy && !coaching.hint && !coaching.feedback && <p>{game.result ? '本局已结束，可以开始新局继续练习。' : game.phase === 'PROMOTION_PENDING' ? '先选择升变棋子，再继续指导。' : ready ? '先自己想一想，需要时点「给我提示」。走后会自动点评，也可以悔棋再试。' : '等电脑走完，再一起看看局面。'}</p>}
      {coaching.error && <p className="coach-error">{coaching.error}<button onClick={() => coach.retry()}>重试指导</button></p>}
    </div>
  </section>;
}
