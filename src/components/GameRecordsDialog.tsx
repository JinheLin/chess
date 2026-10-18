import { useState } from 'react';
import type { GameRecord } from '../game/GameRecord';
import { MAX_GAME_RECORDS } from '../game/GameRecord';
import { DIFFICULTIES } from '../engine/ChessEngine';
import { isCoaching } from '../game/GameState';
import { downloadPgn } from '../storage/downloadPgn';
import { Modal } from './Modal';

const dateFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
function duration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return `${hours ? `${hours} 小时 ` : ''}${minutes ? `${minutes} 分 ` : ''}${seconds % 60} 秒`;
}

export function GameRecordsDialog({ records, onClose }: { records: readonly GameRecord[]; onClose: () => void }) {
  const [exportError, setExportError] = useState(false);
  const exportRecord = (record: GameRecord) => {
    try { downloadPgn(record.pgn); setExportError(false); }
    catch { setExportError(true); }
  };
  return <Modal title="对弈记录" onClose={onClose}>
    <p>自动保留最近 {MAX_GAME_RECORDS} 局 · 仅此浏览器。耗时包含离开页面的时间。</p>
    {records.length ? <ol className="game-records" aria-label="历史对弈记录">
      {records.map(record => <li key={record.id} className="game-record">
        <strong className="record-result">{record.result}</strong>
        <dl>
          <div><dt>开始时间</dt><dd><time dateTime={record.startedAt}>{dateFormat.format(new Date(record.startedAt))}</time></dd></div>
          <div><dt>耗时{record.timingEstimated ? '（估算）' : ''}</dt><dd>{record.timingEstimated ? '约 ' : ''}{duration(record.durationMs)}</dd></div>
        </dl>
        {record.timingEstimated && <p className="record-time-note">旧存档缺少结束时间，按首次恢复时刻估算。</p>}
        <div className="record-footer"><span>{record.settings.mode === 'ai' ? `${isCoaching(record.settings) ? '下指导棋' : '人机对弈'} · ${DIFFICULTIES[record.settings.difficulty].label} · 执${record.settings.playerColor === 'w' ? '白' : '黑'}` : '本地双人'} · {record.plyCount} 步</span><button onClick={() => exportRecord(record)}>导出记录 PGN</button></div>
      </li>)}
    </ol> : <div className="records-empty"><strong>还没有对弈记录</strong><p>结束一局后自动保存；中途重开会保留为未完成。</p></div>}
    {exportError && <p role="alert" className="engine-error">下载未成功，请检查浏览器下载设置后重试。</p>}
    <div className="dialog-actions"><button onClick={onClose}>关闭</button></div>
  </Modal>;
}
