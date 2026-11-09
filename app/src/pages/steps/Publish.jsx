import { useState } from 'preact/hooks';
import { StepHead } from '../Project.jsx';
import { Sheet, Field, Notice, Progress } from '../../components/ui.jsx';
import { Preview, projectAssets } from '../../components/Preview.jsx';
import { Mascot } from '../../components/Mascot.jsx';
import { buildSite, E, slugify } from '../../lib/engine.js';
import { exportProjectFile } from '../../lib/project.js';
import { deployGitHub, deployNetlify, GITHUB_TOKEN_URL, NETLIFY_TOKEN_URL } from '../../lib/deploy.js';
import { saveFile, safeName, toast, copy } from '../../lib/util.js';

const DOCS = 'https://github.com/yoorrard/lecpage/blob/main/skills/lecpage/references/deploy';

function checks(bp) {
  const v = E.validate(bp); const b = v.blueprint; const out = [];
  if (!b.meta.date) out.push({ k: 'warn', t: '날짜가 비어 있어요(첫 화면·일정에 표시돼요).' });
  const deck = b.sections.find((s) => s.type === 'deck');
  if (deck && deck.slides.some((s) => !s.src)) out.push({ k: 'info', t: '교재 뷰어에 쪽 그림이 없는 쪽이 있어요. PDF를 올리면 그림이 생겨요(없어도 글로 보여요).' });
  const sv = b.sections.find((s) => s.type === 'survey');
  if (sv && !sv.url) out.push({ k: 'warn', t: '만족도 조사 주소가 비어 있어요.' });
  if (b.live.provider === 'local') out.push({ k: 'warn', t: '실시간 기능이 미리보기 모드예요. 실제 연수 전에 6단계에서 서버를 연결하세요.' });
  if (['supabase', 'sheets', 'http'].includes(b.live.provider) && !b.live.url) out.push({ k: 'bad', t: '실시간 서버 주소가 비어 있어요(6단계).' });
  if (b.live.provider === 'supabase' && !b.live.anonKey) out.push({ k: 'bad', t: 'Supabase anon 키가 비어 있어요(6단계).' });
  for (const w of v.warnings.slice(0, 6)) out.push({ k: 'info', t: w.message_ko });
  if (!out.length) out.push({ k: 'ok', t: '확인할 문제가 없어요.' });
  return out;
}

export function StepPublish({ p, update, go }) {
  const bp = p.blueprint;
  const [busy, setBusy] = useState('');
  const [prog, setProg] = useState(null);
  const [ghToken, setGhToken] = useState('');
  const [repo, setRepo] = useState(p.deploy?.github?.repo || slugify(p.title));
  const [nlToken, setNlToken] = useState('');
  const [result, setResult] = useState(p.deploy?.lastUrl || '');
  if (!bp) return <><StepHead title="완성·배포" /><Notice>먼저 설계도를 만들어 주세요.</Notice></>;

  async function files() { const assets = await projectAssets(p.id, true); const r = buildSite(bp, assets, { ...p.info }); if (r.errors.length) throw new Error(r.errors.map((e) => e.message_ko).join(' ')); return r; }
  async function zip() { setBusy('zip'); try { const r = await files(); saveFile(safeName(p.title) + '.zip', E.zipFiles(r.files), 'application/zip'); toast('사이트 파일(ZIP)을 내려받았어요.'); } catch (e) { toast(e.message); } setBusy(''); }
  async function projectFile() { const z = await exportProjectFile(p); saveFile(safeName(p.title) + '.lecpage', z, 'application/zip'); toast('프로젝트 파일을 저장했어요.'); }
  async function gh() {
    setBusy('gh'); setProg({ step: '준비', pct: 1 });
    try { const r = await files(); const out = await deployGitHub({ token: ghToken, repo: slugify(repo), files: r.files, onProgress: setProg }); setResult(out.url); update({ deploy: { ...(p.deploy || {}), github: { repo: slugify(repo), url: out.url }, lastUrl: out.url } }); toast('GitHub Pages에 올렸어요.'); }
    catch (e) { toast('배포하지 못했어요: ' + e.message); setProg(null); }
    setBusy('');
  }
  async function nl() {
    setBusy('nl'); setProg({ step: '준비', pct: 1 });
    try { const r = await files(); const out = await deployNetlify({ token: nlToken, siteId: p.deploy?.netlify?.siteId, zip: E.zipFiles(r.files), onProgress: setProg }); setResult(out.url); update({ deploy: { ...(p.deploy || {}), netlify: { siteId: out.siteId, url: out.url }, lastUrl: out.url } }); toast('Netlify에 올렸어요.'); }
    catch (e) { toast('배포하지 못했어요: ' + e.message); setProg(null); }
    setBusy('');
  }
  const list = checks(bp);
  return (
    <>
      <StepHead title="완성! 이제 내보내요" desc="마지막으로 확인하고, 파일로 받거나 내 계정에 바로 올리세요." />
      <Sheet>
        <div class="stack">
          <h2 style={{ fontSize: '1.2rem' }}>마지막 확인</h2>
          <ul class="warnings">{list.map((c) => <li style={{ color: c.k === 'bad' ? 'var(--bad)' : c.k === 'ok' ? 'var(--ok)' : undefined }}>{c.k === 'ok' ? '✓' : c.k === 'bad' ? '✕' : '·'} {c.t}</li>)}</ul>
          <div class="btn-row">
            <button class="btn btn-primary" disabled={!!busy} onClick={zip}>사이트 파일 받기(ZIP)</button>
            <button class="btn" onClick={projectFile}>프로젝트 파일 저장(.lecpage)</button>
          </div>
          <p class="small muted">ZIP을 풀어 index.html을 열면 바로 보여요. 프로젝트 파일은 다른 컴퓨터의 lecpage에서 이어서 고칠 때 써요.</p>
        </div>
      </Sheet>
      <Preview p={p} height="min(70vh,720px)" />
      <Sheet fold={false}>
        <div class="stack">
          <h2 style={{ fontSize: '1.2rem' }}>내 계정에 바로 올리기</h2>
          <p class="small muted">토큰은 이번 배포에만 쓰고 저장하지 않아요. 브라우저에서 GitHub·Netlify로 바로 보내요.</p>
          {prog && <div class="stack"><Progress pct={prog.pct} /><span class="small muted">{prog.step}</span></div>}
          {result && <Notice kind="ok"><Mascot size={40} mood="happy" /><span>올렸어요: <a href={result} target="_blank" rel="noopener">{result}</a> <button class="btn btn-sm btn-quiet" onClick={() => copy(result)}>주소 복사</button></span></Notice>}
          <details open>
            <summary><b>GitHub Pages</b> <span class="small muted">무료 · 공개 저장소로 만들어져요(교재가 공개돼요)</span></summary>
            <div class="stack" style={{ marginTop: '10px' }}>
              <ol class="small" style={{ margin: 0, paddingLeft: '1.2em' }}><li><a href={GITHUB_TOKEN_URL} target="_blank" rel="noopener">토큰 만들기 페이지</a>를 열어 맨 아래 'Generate token'을 누르세요(권한은 미리 채워져 있어요).</li><li>만든 토큰을 붙여 넣고 저장소 이름을 정하세요.</li></ol>
              <div class="form-grid">
                <Field label="GitHub 토큰"><input type="password" autoComplete="off" value={ghToken} onInput={(e) => setGhToken(e.target.value.trim())} placeholder="github_pat_…" /></Field>
                <Field label="저장소 이름" hint="영문·숫자·하이픈"><input value={repo} onInput={(e) => setRepo(e.target.value)} /></Field>
              </div>
              <div><button class="btn btn-ink" disabled={!ghToken || !!busy} onClick={gh}>{busy === 'gh' ? '올리는 중…' : 'GitHub Pages에 올리기'}</button></div>
            </div>
          </details>
          <details>
            <summary><b>Netlify</b> <span class="small muted">무료 크레딧 월 300(배포 1회 15) · 비공개 원본</span></summary>
            <div class="stack" style={{ marginTop: '10px' }}>
              <p class="small"><a href={NETLIFY_TOKEN_URL} target="_blank" rel="noopener">개인 접근 토큰</a>을 만들어 붙여 넣으세요. 같은 프로젝트를 다시 올리면 같은 주소에 새 버전이 올라가요.</p>
              <Field label="Netlify 토큰"><input type="password" autoComplete="off" value={nlToken} onInput={(e) => setNlToken(e.target.value.trim())} /></Field>
              <div><button class="btn btn-ink" disabled={!nlToken || !!busy} onClick={nl}>{busy === 'nl' ? '올리는 중…' : 'Netlify에 올리기'}</button></div>
            </div>
          </details>
          <details>
            <summary><b>다른 곳에 올리기</b> <span class="small muted">ZIP을 받아서 직접</span></summary>
            <ul class="small" style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
              <li><a href={`${DOCS}/cloudflare.md`} target="_blank" rel="noopener">Cloudflare</a> — 무료·무제한 전송, 끌어다 놓기로 올리기. 큰 연수에 가장 좋아요.</li>
              <li><a href={`${DOCS}/netlify.md`} target="_blank" rel="noopener">Netlify Drop</a> — 계정 없이 끌어다 놓기(1시간 안에 계정 연결).</li>
              <li><a href={`${DOCS}/own-server-nginx-caddy.md`} target="_blank" rel="noopener">학교·기관 서버</a>, <a href={`${DOCS}/nas-synology.md`} target="_blank" rel="noopener">NAS</a>, <a href={`${DOCS}/aws-s3-cloudfront.md`} target="_blank" rel="noopener">AWS</a></li>
              <li><a href={`${DOCS}/local-lan-classroom.md`} target="_blank" rel="noopener">인터넷 없는 교실</a> — 강사 노트북을 서버로</li>
              <li><a href={`${DOCS}/zip-usb-offline.md`} target="_blank" rel="noopener">USB로 나눠 주기</a></li>
            </ul>
          </details>
        </div>
      </Sheet>
      <div class="step-foot"><button class="btn btn-quiet" onClick={() => go(6)}>이전</button><a class="btn" href="#/">처음으로</a></div>
    </>
  );
}
