import { useState, useSyncExternalStore } from 'react';
import { GameController } from './game/GameController';
import { colorName } from './game/ChessRules';
import type { Promotion } from './game/GameState';
import { GameBoard } from './components/GameBoard';
import { MoveHistory } from './components/MoveHistory';
import { Modal } from './components/Modal';

export default function App() {
  const [controller] = useState(() => new GameController());
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [flipped, setFlipped] = useState(false);
  const [confirmation, setConfirmation] = useState<'new' | 'resign' | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const clearBoard = () => setBoardKey(key => key + 1);
  const status = state.result ?? (state.phase === 'PROMOTION_PENDING' ? '请选择升变棋子' : `${colorName(state.turn)}走棋${state.inCheck ? ' · 将军！' : ''}`);
  const player = (color: 'w' | 'b') => <div className={`player ${state.turn === color && !state.result ? 'active' : ''}`}>
    <div className={`avatar ${color === 'w' ? 'white' : 'black'}`}>{color === 'w' ? '♔' : '♚'}</div>
    <div><strong>{colorName(color)}</strong><small>本地玩家 {color === 'w' ? '01' : '02'}</small></div>
    <span className="player-status">{state.result ? '对局结束' : state.turn === color ? '● 正在走棋' : '等待走棋'}</span>
  </div>;
  return <div className="app-shell">
    <header><a className="brand" href="./"><span className="brand-mark">♞</span><span>Chess<span className="brand-light"> Lab</span><small>专注棋盘，享受每一步</small></span></a><div className="header-tag"><i />本地双人 <span> / </span> 自由对弈</div></header>
    <main>
      <div className="page-heading"><div><p className="eyebrow">A LITTLE FOCUS. A GREAT GAME.</p><h1>下一步，皆有可能<span>。</span></h1><p className="subtitle">和身边的朋友，下一盘好棋。</p></div><span className="mode-badge">♟ 经典对弈</span></div>
      <div className="game-layout">
        <section className="board-column">
          {player(flipped ? 'w' : 'b')}
          <GameBoard key={boardKey} controller={controller} state={state} flipped={flipped} />
          {player(flipped ? 'b' : 'w')}
          <div className="board-caption"><span>点击或拖动棋子开始走棋</span><button onClick={() => { setFlipped(!flipped); clearBoard(); }} aria-label="翻转棋盘">⇅ <span>翻转棋盘</span></button></div>
        </section>
        <aside>
          <section className="game-panel"><div className="section-title"><h2>当前对局</h2><span className="live-label">{state.result ? '已结束' : '进行中'}</span></div>
            <div className={`turn-card ${state.inCheck ? 'check' : ''}`} role="status" aria-label="对局状态"><span className="turn-icon">{state.result ? '⚑' : state.turn === 'w' ? '♔' : '♚'}</span><div><strong>{status}</strong><p>{state.result ? '再来一局，探索新的可能' : state.inCheck ? '王受到攻击，请解除将军' : '从容思考，落子有声'}</p></div></div>
            <div className="game-meta"><div><small>对弈模式</small><strong>本地双人</strong></div><div><small>时间限制</small><strong>不限时</strong></div></div>
            <div className="controls"><button disabled={!state.history.length && !state.result} onClick={() => { controller.undo(); clearBoard(); }}>↶ 悔棋</button><button aria-label="认输" disabled={state.phase !== 'PLAYER_TURN'} onClick={() => setConfirmation('resign')}>⚑ 认输</button></div>
            <button className="primary new-game" onClick={() => { if (state.history.length || state.result) setConfirmation('new'); else { controller.newGame(); clearBoard(); } }}>＋ 开始新局</button>
          </section>
          <MoveHistory history={state.history} />
          <div className="tip"><span>✧</span><p><strong>落子之前，多看一步</strong><br/>点击己方棋子，即可查看所有合法落点。</p></div>
        </aside>
      </div>
    </main>
    <footer><span>CHESS LAB <b> / </b> 为思考留一点空间</span><span>无需登录 · 在浏览器中轻松对弈</span></footer>
    {state.promotion && <Modal title="兵升变" onClose={() => controller.cancelPromotion()}><p>选择一枚棋子，继续你的对局。</p><div className="promotion-options">{([['q','后','♛'],['r','车','♜'],['b','象','♝'],['n','马','♞']] as const).map(([piece,name,glyph]) => <button key={piece} onClick={() => controller.promote(piece as Promotion)} aria-label={`升变为${name}`}><span>{glyph}</span>{name}</button>)}</div><button onClick={() => controller.cancelPromotion()}>取消</button></Modal>}
    {confirmation && <Modal title={confirmation === 'new' ? '开始新的对局？' : `${colorName(state.turn)}确认认输？`} onClose={() => setConfirmation(null)}><p>{confirmation === 'new' ? '当前对局及走棋记录将被清空。' : '认输后，本局将结束。'}</p><div className="dialog-actions"><button onClick={() => setConfirmation(null)}>继续对局</button><button className="primary" onClick={() => { if (confirmation === 'new') controller.newGame(); else controller.resign(); clearBoard(); setConfirmation(null); }}>{confirmation === 'new' ? '确认新局' : '确认认输'}</button></div></Modal>}
  </div>;
}
