import { useState } from 'react';
import type { GameSettings } from '../game/GameState';
import { isCoaching } from '../game/GameState';
import { DIFFICULTIES } from '../engine/ChessEngine';
import { BEGINNER_RANDOM_PERCENT_OPTIONS, DEFAULT_BEGINNER_RANDOM_PERCENT, BEGINNER_MAX_DEPTH_OPTIONS, DEFAULT_BEGINNER_MAX_DEPTH, BEGINNER_MOVETIME_OPTIONS, DEFAULT_BEGINNER_MOVETIME_MS } from '../engine/BeginnerPolicy';
import { Modal } from './Modal';
export function GameSettingsDialog({ settings, onClose, onStart }: {
  settings: GameSettings; onClose: () => void; onStart: (settings: GameSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const randomPercent = draft.beginnerRandomPercent ?? DEFAULT_BEGINNER_RANDOM_PERCENT;
  return <Modal title="对局设置" onClose={onClose}>
    <p>应用设置将保存当前对局并开始新局；未结束的对局记为未完成。</p>
    <div className="settings-fields">
      <label>对弈模式<select value={isCoaching(draft) ? 'coach' : draft.mode} onChange={event => setDraft({ ...draft, mode: event.target.value === 'local' ? 'local' : 'ai', coaching: event.target.value === 'coach' })}>
        <option value="ai">人机对弈</option><option value="coach">下指导棋</option><option value="local">本地双人</option>
      </select></label>
      {isCoaching(draft) && <small>与电脑边下边学：走前可查看推荐着法，走后自动点评。提示不会替你落子，随时可以悔棋重试。</small>}
      {draft.mode === 'ai' && <>
        <label>我的执棋<select value={draft.playerColor} onChange={event => setDraft({ ...draft, playerColor: event.target.value as GameSettings['playerColor'] })}>
          <option value="w">白方 · 我先走</option><option value="b">黑方 · AI 先走</option>
        </select></label>
        <label>AI 难度<select value={draft.difficulty} onChange={event => setDraft({ ...draft, difficulty: Number(event.target.value) as GameSettings['difficulty'] })}>
          {[3,0,1,2].map(index => <option key={index} value={index}>{DIFFICULTIES[index].label}</option>)}
        </select></label>
        <small>入门会减少计算并偶尔漏看机会，适合熟悉规则；初级及以上使用 Stockfish 正常对弈。</small>
        {draft.difficulty === 3 && <>
          <label>入门搜索深度<select value={draft.beginnerMaxDepth ?? DEFAULT_BEGINNER_MAX_DEPTH} aria-describedby="beginner-search-help" onChange={event => setDraft({ ...draft, beginnerMaxDepth: Number(event.target.value) })}>
            {BEGINNER_MAX_DEPTH_OPTIONS.map(depth => <option key={depth} value={depth}>{depth} 层</option>)}
          </select></label>
          <label>入门思考时间<select value={draft.beginnerMovetimeMs ?? DEFAULT_BEGINNER_MOVETIME_MS} aria-describedby="beginner-search-help" onChange={event => setDraft({ ...draft, beginnerMovetimeMs: Number(event.target.value) })}>
            {BEGINNER_MOVETIME_OPTIONS.map(time => <option key={time} value={time}>{time} 毫秒</option>)}
          </select></label>
          <small id="beginner-search-help">搜索深度和思考时间都是上限，通常越高越难；达到任一限制时即可落子。</small>
          <label>入门随机走法概率<select value={randomPercent} aria-describedby="beginner-random-help" onChange={event => setDraft({ ...draft, beginnerRandomPercent: Number(event.target.value) })}>
            {BEGINNER_RANDOM_PERCENT_OPTIONS.map(percent => <option key={percent} value={percent}>{percent}%</option>)}
          </select></label>
          <small id="beginner-random-help">越低越少偏离推荐走法，通常更难。100% 有其他合法走法时总是随机选择。</small>
        </>}
      </>}
    </div>
    <div className="dialog-actions"><button onClick={onClose}>取消</button><button className="primary" onClick={() => onStart(draft)}>应用并开始新局</button></div>
  </Modal>;
}
