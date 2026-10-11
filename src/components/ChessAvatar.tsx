import type { Character } from '../personality/Personality';
/** Small original vector portraits; bundled locally, without remote image dependencies. */
export function ChessAvatar({character}:{character:Character}) {
  const professor = character === 'professor', victor = character === 'victor';
  return <svg viewBox="0 0 64 72" width="44" height="50" aria-hidden="true">
    <path d="M5 72V61c0-14 54-14 54 0v11" fill={professor ? '#405c73' : victor ? '#513e42' : '#416b52'} />
    <path d="M25 49h14v10l-7 7-7-7" fill="#dca77e" />
    <ellipse cx="32" cy="31" rx="19" ry="24" fill="#eac29a" />
    <path d={professor ? 'M12 31Q6 9 24 9L24 17Q14 18 16 34M40 10Q59 11 52 35L48 26Q48 16 40 17' : victor ? 'M12 32Q6 3 34 4Q59 2 53 32L46 20L40 12Q32 22 18 22Z' : 'M12 33Q2 9 22 8L19 3Q38 0 49 9Q59 19 51 33L46 20Q28 24 21 17L17 32Z'} fill={professor ? '#dddcd1' : victor ? '#2d2930' : '#775337'} />
    <g fill="#3d3430"><circle cx="24" cy="32" r="2"/><circle cx="40" cy="32" r="2"/></g>
    {professor && <g fill="none" stroke="#40505a" strokeWidth="1.8"><circle cx="23" cy="32" r="7"/><circle cx="41" cy="32" r="7"/><path d="M30 31h4"/></g>}
    {victor && <path d="M19 26l9 2m8 0 9-3" stroke="#2d2930" strokeWidth="2"/>}
    <path d={victor ? 'M26 43q7 2 13-3' : professor ? 'M27 44h10' : 'M25 41q7 10 14 0'} fill="none" stroke="#9f6450" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}
