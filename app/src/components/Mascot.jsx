// lecpage 마스코트: 로고의 종이 친구. mood: idle | happy | think | oops | sleep | wow
export function Mascot({ size = 96, mood = 'idle', look = false, bob = false, title }) {
  const ink = 'var(--line)';
  const eyes = {
    happy: <g fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round"><path d="M39 63q5-6 10 0" /><path d="M66 63q5-6 10 0" /></g>,
    sleep: <g fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round"><path d="M38 63h11" /><path d="M66 63h11" /></g>,
    oops: <g fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round"><path d="M39 59l9 8M48 59l-9 8" /><path d="M67 59l9 8M76 59l-9 8" /></g>,
  }[mood] || (
    <g class="pupils" fill={ink}>
      <ellipse class="eye" cx="44" cy={mood === 'wow' ? 60 : 62} rx="5" ry={mood === 'wow' ? 6 : 5} />
      <ellipse class="eye" cx="71" cy={mood === 'wow' ? 60 : 62} rx="5" ry={mood === 'wow' ? 6 : 5} />
    </g>
  );
  const mouth = {
    happy: <path d="M50 75q7.5 7 15 0" fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round" />,
    think: <path d="M53 77h9" fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round" transform="rotate(-8 57 77)" />,
    oops: <path d="M49 79q4-5 8 0t8 0" fill="none" stroke={ink} stroke-width="4" stroke-linecap="round" />,
    wow: <ellipse cx="57.5" cy="78" rx="4.5" ry="5.5" fill={ink} />,
    sleep: <path d="M53 77h9" fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round" />,
  }[mood] || <path d="M53 76h9" fill="none" stroke={ink} stroke-width="4.5" stroke-linecap="round" />;
  return (
    <svg class={`mascot${look ? ' look' : ''}${bob ? ' bob' : ''}`} width={size} height={size} viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : 'true'}>
      <path d="M33 14C50 12 64 12 79 13L104 37C106 52 106 76 104 93C103 102 96 107 86 107C66 109 46 109 31 107C20 106 14 100 13 90C12 72 12 50 14 33C15 21 21 15 33 14Z" style={{ fill: 'var(--paper)' }} stroke={ink} stroke-width="5" stroke-linejoin="round" />
      <path d="M79 13L79 28C79 34 82 37 88 37L104 37Z" style={{ fill: 'var(--lav)' }} stroke={ink} stroke-width="5" stroke-linejoin="round" />
      {eyes}
      {mouth}
      {mood === 'sleep' && <text x="88" y="30" font-size="16" font-family="Quicksand, sans-serif" font-weight="700" fill={ink}>z</text>}
    </svg>
  );
}

export function Wordmark({ size = 1 }) {
  return <span class="latin" style={{ fontSize: `${1.45 * size}rem`, letterSpacing: '-.01em' }}>lecpage</span>;
}
