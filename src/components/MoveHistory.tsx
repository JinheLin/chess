import { useEffect, useRef } from 'react';
import type { Move } from 'chess.js';
export function MoveHistory({ history }: { history: readonly Move[] }) {
  const scroll = useRef<HTMLDivElement>(null);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = scroll.current.scrollHeight; }, [history.length]);
  return <section className="history-section">
    <div className="section-title"><h2>走棋记录</h2><span>SAN</span></div>
    <div className="history-head"><span>回合</span><span>白方</span><span>黑方</span></div>
    <div ref={scroll} className="history-scroll" aria-label="走棋记录">
      {!history.length ? <div className="empty-history"><span>♙</span><p>每一局，都有新的可能</p><small>走出第一步，棋谱将在这里记录</small></div> :
      Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => <div className="history-row" key={i}><span>{i + 1}.</span><span>{history[i * 2]?.san}</span><span className={i * 2 + 1 === history.length - 1 ? 'latest' : ''}>{history[i * 2 + 1]?.san ?? '—'}</span></div>)}
    </div>
    <div className="history-footer"><span>标准国际象棋</span><span>{history.length} 步</span></div>
  </section>;
}
