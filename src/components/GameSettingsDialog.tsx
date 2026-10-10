import { useState } from 'react';
import type { GameSettings } from '../game/GameState';
import { DIFFICULTIES } from '../engine/ChessEngine';
import { Modal } from './Modal';
export function GameSettingsDialog({ settings, onClose, onStart }: {
  settings: GameSettings; onClose: () => void; onStart: (settings: GameSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  return <Modal title="对局设置" onClose={onClose}>
    <p>应用设置将开始新局，并清空当前棋谱。</p>
    <div className="settings-fields">
      <label>对弈模式<select value={draft.mode} onChange={event => setDraft({ ...draft, mode: event.target.value as GameSettings['mode'] })}>
        <option value="ai">人机对弈</option><option value="local">本地双人</option>
      </select></label>
      {draft.mode === 'ai' && <>
        <label>我的执棋<select value={draft.playerColor} onChange={event => setDraft({ ...draft, playerColor: event.target.value as GameSettings['playerColor'] })}>
          <option value="w">白方 · 我先走</option><option value="b">黑方 · AI 先走</option>
        </select></label>
        <label>AI 难度<select value={draft.difficulty} onChange={event => setDraft({ ...draft, difficulty: Number(event.target.value) as GameSettings['difficulty'] })}>
          {DIFFICULTIES.map((difficulty, index) => <option key={index} value={index}>{difficulty.label}</option>)}
        </select></label>
        <small>Stockfish 在本机思考。初级也有一定棋力。</small>
      </>}
    </div>
    <div className="dialog-actions"><button onClick={onClose}>取消</button><button className="primary" onClick={() => onStart(draft)}>应用并开始新局</button></div>
  </Modal>;
}
