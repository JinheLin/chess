import { useEffect, useState, useSyncExternalStore } from 'react';
import type { GameController } from '../game/GameController';
import { CommentarySpeech } from '../audio/CommentarySpeech';
import { ChessAvatar } from './ChessAvatar';
import { CHARACTERS } from '../personality/Personality';
import type { Character, Frequency } from '../personality/Personality';
import { PersonalityEngine } from '../personality/PersonalityEngine';
export function PersonalityPanel({controller}:{controller:GameController}) {
  const [engine] = useState(()=>new PersonalityEngine(controller));
  useEffect(()=>{engine.connect();return ()=>engine.dispose();},[engine]);
  return <Panel engine={engine} />;
}
function Panel({engine}:{engine:PersonalityEngine}) {
  const state = useSyncExternalStore(engine.subscribe,engine.getSnapshot);
  const [speech] = useState(()=>new CommentarySpeech(engine));
  const voice = useSyncExternalStore(speech.subscribe,speech.getSnapshot);
  useEffect(()=>{
    speech.connect();
    const activate = (event:Event)=>{if (!(event.target instanceof Element) || !event.target.closest('[aria-label="语音朗读"]')) speech.activate();};
    document.addEventListener('click',activate);
    document.addEventListener('keydown',activate);
    return ()=>{document.removeEventListener('click',activate);document.removeEventListener('keydown',activate);speech.dispose();};
  },[speech]);
  const {settings} = state, character = CHARACTERS[settings.character];
  const last = state.history.at(-1);
  const [expired,setExpired] = useState<number | undefined>();
  useEffect(()=>{if (!last) return;const timer = setTimeout(()=>setExpired(last.id),9000);return ()=>clearTimeout(timer);},[last]);
  const mood = state.emotion.frustration >= 25 ? '有些懊恼' : state.emotion.respect >= 54 ? '认真以待' : state.emotion.excitement >= 25 ? '兴致正浓' : state.emotion.confidence >= 65 ? '渐入佳境' : '从容应战';
  return <section className={`personality-panel persona-${settings.character}`} aria-label="棋手人格">
    <div className="persona-heading"><div className="persona-avatar" aria-hidden="true"><ChessAvatar character={settings.character} /></div><div><h2>{character.name}</h2><small>{character.style} · {mood}</small></div><button type="button" role="switch" aria-label="语音朗读" aria-checked={voice.enabled} className="persona-switch" disabled={!voice.supported} onClick={()=>speech.toggle()}><span aria-hidden="true" />语音{voice.enabled ? '开' : '关'}</button></div>
    <div className="persona-settings"><label>棋手性格<select value={settings.character} onChange={e=>engine.configure({...settings,character:e.target.value as Character})}>{Object.entries(CHARACTERS).map(([key,value])=><option key={key} value={key}>{value.name} · {value.style}</option>)}</select></label><label>互动频率<select value={settings.frequency} onChange={e=>engine.configure({...settings,frequency:e.target.value as Frequency})}><option value="quiet">安静</option><option value="normal">适中</option><option value="chatty">话痨</option></select></label></div>
    <small className="persona-context">{last && !settings.muted ? `第 ${Math.max(1,Math.ceil(last.ply/2))} 回合 · 已落子点评` : '性格与棋力独立设置'}</small>
    <p className="persona-bubble" role="status" aria-label="棋手对话">{settings.muted ? '安静对弈，专注棋盘。' : last && expired !== last.id ? last.text : state.history.length ? '正在关注棋盘…' : character.intro}</p>
    <small className="persona-note" role="status" aria-label="语音状态">{!voice.supported ? '此浏览器不支持朗读' : voice.error || (voice.speaking ? '正在朗读…' : '')}</small>
    {state.storageFailed && <p role="status">互动设置暂无法保存，刷新后可能恢复默认。</p>}
    <details><summary>本局对话 · {state.history.length}</summary><ol className="persona-history" aria-label="对话历史">{state.history.map(message=><li key={message.id}><small>{CHARACTERS[message.character].name} · 第 {Math.max(1,Math.ceil(message.ply/2))} 回合</small><p>{message.text}</p><small>{message.fact}</small></li>)}</ol><small>刷新、悔棋或更换棋手会清空故事；最多保留 40 条。</small></details>
  </section>;
}
