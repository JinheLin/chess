import { useEffect, useState, useSyncExternalStore } from 'react';
import { colorName } from './game/ChessRules';
import type { Promotion } from './game/GameState';
import { GameBoard } from './components/GameBoard';
import { MoveHistory } from './components/MoveHistory';
import { Modal } from './components/Modal';
import { GameSettingsDialog } from './components/GameSettingsDialog';
import { StockfishEngine } from './engine/StockfishEngine';
import { DIFFICULTIES } from './engine/ChessEngine';
import { useGameSession } from './hooks/useGameSession';
import { CapturedPieces } from './components/CapturedPieces';
import { PersonalityPanel } from './components/PersonalityPanel';
import { downloadPgn } from './storage/downloadPgn';
import { GameRecordsDialog } from './components/GameRecordsDialog';

export default function App() {
  const { controller, preferences, setPreferences, notice, dismissNotice, saveFailed, unlockSound } = useGameSession();
  useEffect(() => { controller.connectEngine(() => new StockfishEngine()); return () => controller.disconnectEngine(); }, [controller]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const flipped = preferences.flipped;
  const setFlipped = (value: boolean) => setPreferences(previous => ({...previous, flipped:value}));
  const [exportError, setExportError] = useState(false);
  const [confirmation, setConfirmation] = useState<'new' | 'resign' | 'undo' | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !document.querySelector('dialog[open]')) setToolsOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toolsOpen]);
  const clearBoard = () => setBoardKey(key => key + 1);
  const isAI = state.settings.mode === 'ai';
  const modeName = isAI ? '人机对弈' : '本地双人';
  const difficultyName = DIFFICULTIES[state.settings.difficulty].label;
  const resigningColor = isAI ? state.settings.playerColor : state.turn;
  const status = state.result ?? (state.phase === 'ENGINE_ERROR' ? '引擎暂不可用' : state.phase === 'ENGINE_LOADING' ? '正在准备 Stockfish…' : state.phase === 'AI_THINKING' ? 'AI 思考中…' : state.phase === 'PROMOTION_PENDING' ? '请选择升变棋子' : `${colorName(state.turn)}走棋${state.inCheck ? ' · 将军！' : ''}`);
  const toggleSound = () => setPreferences(previous => ({...previous, sound: !previous.sound}));
  const flipBoard = () => { setFlipped(!flipped); clearBoard(); };
  const requestNewGame = () => { if (state.history.length || state.result) setConfirmation('new'); else { controller.newGame(); clearBoard(); } };
  const exportGame = () => { try { downloadPgn(controller.exportPgn()); setExportError(false); } catch { setExportError(true); } };
  const player = (color: 'w' | 'b') => <div className="player-block"><div className={`player ${state.turn === color && !state.result ? 'active' : ''}`}>
    <div className={`avatar ${color === 'w' ? 'white' : 'black'}`}>{color === 'w' ? '♔' : '♚'}</div>
    <div><strong>{colorName(color)}</strong><small>{isAI ? color === state.settings.playerColor ? '你' : `Stockfish · ${difficultyName}` : `本地玩家 ${color === 'w' ? '01' : '02'}`}</small></div>
    <span className="player-status">{state.result ? '对局结束' : state.turn === color ? '● 正在走棋' : '等待走棋'}</span>
  </div><CapturedPieces history={state.history} color={color} /></div>;
  const statusIcon = state.phase === 'ENGINE_LOADING' ? <span className="spinner" /> : state.result ? '⚑' : state.turn === 'w' ? '♔' : '♚';
  const statusDetail = state.result ? '再来一局，探索新的可能' : state.phase === 'AI_THINKING' ? '你可以随时悔棋或开始新局' : state.phase === 'ENGINE_LOADING' ? '首次加载可能需要几秒钟' : state.inCheck ? '王受到攻击，请解除将军' : '从容思考，落子有声';
  const soundLabel = preferences.sound ? '♪ 音效开' : '♪ 音效关';
  return <div className={`app-shell${toolsOpen ? ' tools-open' : ''}`} onPointerDownCapture={unlockSound} onTouchStartCapture={unlockSound} onKeyDownCapture={unlockSound}>
    <header className="site-header"><a className="brand" href="./"><span className="brand-mark">♞</span><span>Chess<span className="brand-light"> Lab</span><small>专注棋盘，享受每一步</small></span></a><div className="header-tag"><i />{modeName} <span> / </span> 自由对弈</div></header>
    <main>
      <div className="page-heading"><div><p className="eyebrow">A LITTLE FOCUS. A GREAT GAME.</p><h1>下一步，皆有可能<span>。</span></h1><p className="subtitle">{isAI ? '与 Stockfish 对弈，让每一步都有新的发现。' : '和身边的朋友，下一盘好棋。'}</p></div><span className="mode-badge">♟ 经典对弈</span></div>
      {notice && <div className="session-notice" role="status" aria-label="恢复提示"><span>{notice}</span><button aria-label="关闭恢复提示" onClick={dismissNotice}>×</button></div>}
      <div className={`mobile-status${state.inCheck ? ' check' : ''}`} role="status" aria-label="对局状态"><span className="turn-icon">{statusIcon}</span><strong>{status}</strong><button aria-label="落子音效" aria-pressed={preferences.sound} onClick={toggleSound}>{soundLabel}</button></div>
      <div className="game-layout">
        <section className="board-column">
          {player(flipped ? 'w' : 'b')}
          <div className="board-slot"><GameBoard key={boardKey} controller={controller} state={state} flipped={flipped} /></div>
          {player(flipped ? 'b' : 'w')}
          <div className="board-caption"><span>点击或拖动棋子开始走棋</span><button aria-label="落子音效" aria-pressed={preferences.sound} onClick={toggleSound}>{soundLabel}</button><button onClick={flipBoard} aria-label="翻转棋盘">⇅ <span>翻转棋盘</span></button></div>
          {state.engineError && <div className="engine-error" role="alert"><p>{state.engineError}</p><button onClick={() => controller.retryEngine()}>重试引擎</button></div>}
        </section>
        <aside className="side-column">
          <div className="sheet" id="more-tools" role="region" aria-label="更多功能">
            <section className="game-panel"><div className="section-title"><h2>当前对局</h2><button className="settings-button" onClick={() => setSettingsOpen(true)}>对局设置</button><span className="live-label">{state.result ? '已结束' : '进行中'}</span></div>
              <div className={`turn-card desktop-status${state.inCheck ? ' check' : ''}`} role="status" aria-label="对局状态"><span className="turn-icon">{statusIcon}</span><div><strong>{status}</strong><p>{statusDetail}</p></div></div>
              <div className="game-meta"><div><small>对弈模式</small><strong>{modeName}{isAI ? ` · ${difficultyName}` : ''}</strong></div><div><small>时间限制</small><strong>不限时</strong></div></div>
              <button className="sheet-flip" onClick={flipBoard} aria-label="翻转棋盘">⇅ 翻转棋盘</button>
            </section>
            {isAI && <PersonalityPanel controller={controller} />}
            <MoveHistory history={state.history} />
            <div className="save-tools"><span role="status" aria-label="保存状态">{saveFailed ? '无法自动保存，请导出棋谱备份' : '已自动保存 · 仅此浏览器'}</span><button onClick={exportGame}>导出 PGN</button></div>
            <button className="records-button" onClick={() => setRecordsOpen(true)}>对弈记录 <span>{state.records.length} 局</span></button>
            {exportError && <p className="engine-error" role="alert">下载未成功，请检查浏览器下载设置后重试。</p>}
            <div className="tip"><span>✧</span><p><strong>落子之前，多看一步</strong><br/>点击己方棋子，即可查看所有合法落点。</p></div>
            <a className="sheet-license" href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">Stockfish 19 · GPLv3</a>
          </div>
          <div className="action-dock">
            <div className="controls"><button disabled={!state.canUndo} onClick={() => setConfirmation('undo')}>↶ 悔棋</button><button aria-label="认输" disabled={!!state.result || !!state.promotion} onClick={() => setConfirmation('resign')}>⚑ 认输</button></div>
            <button className="primary new-game" aria-label="开始新局" onClick={requestNewGame}><span className="dock-long">＋ 开始新局</span><span className="dock-short">新局</span></button>
            <button className="tools-toggle" aria-expanded={toolsOpen} aria-controls="more-tools" onClick={() => setToolsOpen(open => !open)}>更多</button>
          </div>
        </aside>
      </div>
    </main>
    {toolsOpen && <button type="button" className="sheet-backdrop" aria-label="关闭更多" onClick={() => setToolsOpen(false)} />}
    <footer className="site-footer"><span>CHESS LAB <b> / </b> 为思考留一点空间</span><span>本地运行 · <a href={`${import.meta.env.BASE_URL}THIRD_PARTY_NOTICES.txt`} target="_blank" rel="noreferrer">Stockfish 19 · GPLv3</a></span></footer>
    {settingsOpen && <GameSettingsDialog settings={state.settings} onClose={() => setSettingsOpen(false)} onStart={settings => { controller.newGame(settings); setFlipped(settings.mode === 'ai' && settings.playerColor === 'b'); clearBoard(); setSettingsOpen(false); }} />}
    {recordsOpen && <GameRecordsDialog records={state.records} onClose={() => setRecordsOpen(false)} />}
    {state.promotion && <Modal title="兵升变" onClose={() => controller.cancelPromotion()}><p>选择一枚棋子，继续你的对局。</p><div className="promotion-options">{([['q','后','♛'],['r','车','♜'],['b','象','♝'],['n','马','♞']] as const).map(([piece,name,glyph]) => <button key={piece} onClick={() => controller.promote(piece as Promotion)} aria-label={`升变为${name}`}><span>{glyph}</span>{name}</button>)}</div><button onClick={() => controller.cancelPromotion()}>取消</button></Modal>}
    {confirmation && <Modal title={confirmation === 'new' ? '开始新的对局？' : confirmation === 'undo' ? '确认悔棋？' : `${colorName(resigningColor)}确认认输？`} onClose={() => setConfirmation(null)}><p>{confirmation === 'new' ? '当前对局将保存到对弈记录，然后开始新局；未结束的对局记为未完成。' : confirmation === 'undo' ? (isAI ? '撤销你最近一步及电脑已有的回应；认输后将先撤销认输。' : '回退最近一步；认输后将先撤销认输。') : '认输后，本局将结束并保存到对弈记录。'}</p><div className="dialog-actions"><button onClick={() => setConfirmation(null)}>继续对局</button><button className="primary" onClick={() => { if (confirmation === 'new') controller.newGame(); else if (confirmation === 'undo') controller.undo(); else controller.resign(); clearBoard(); setConfirmation(null); }}>{confirmation === 'new' ? '确认新局' : confirmation === 'undo' ? '确认悔棋' : '确认认输'}</button></div></Modal>}
  </div>;
}
