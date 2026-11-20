import { useEffect, useState } from 'preact/hooks';
import { Mascot } from '../components/Mascot.jsx';
import { openDemo } from '../lib/demo.js';
import { storageKind, STORAGE_MSG } from '../lib/db.js';

// 먼저 해보기(#/demo): 별도 화면 없이 '실제와 똑같은 연수 화면'을 체험 연수로 엶(예시 교재 PDF가 들어 있음, lib/demo.js).
export function Demo() {
  const [err, setErr] = useState('');
  useEffect(() => {
    let off = false;
    openDemo().then((id) => { if (!off) location.replace(`#/p/${id}/1`); }, (e) => { if (!off) setErr(STORAGE_MSG[storageKind(e)] || '체험 연수를 열지 못했어요. 인터넷 연결을 확인하고 새로 고침해 주세요.'); });
    return () => { off = true; };
  }, []);
  if (err) return <div class="empty"><Mascot size={84} mood="oops" /><p role="alert">{err}</p><a class="btn" href="#/">처음으로</a></div>;
  return <p class="muted" aria-live="polite">체험 연수를 여는 중…</p>;
}
