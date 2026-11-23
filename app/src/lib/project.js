// 프로젝트 만들기·저장·내보내기(.lecpage = 무압축 ZIP: project.json + 자산 파일)
import { projects, blobs } from './db.js';
import { uid, sha256Hex } from './util.js';
import { DEFAULT_INFO, ALLOWED_ASSET, isAllowedAsset, readStoredZip, readStoredZipBlob, storedZipWriter, blobCrc, sameEntries, PROJECT_FORMAT, PROJECT_VERSION } from '@engine/src/project-file.js';
// 첫 화면(Home·main.jsx)도 이 파일을 쓰므로 엔진·키트는 쓸 때만 불러옴(첫 화면 묶음을 가볍게)
const siteMeta = () => import('./site-meta.js');

// .lecpage 형식(받는 자료·ZIP 읽기·연수 정보 기본값)은 skill CLI(`lecpage.mjs app`)와 함께 쓰는 엔진 규칙
export { DEFAULT_INFO, ALLOWED_ASSET, readStoredZip };

/** 첫 화면에 놓은 교재 파일을 '교재 넣기' 화면으로 넘길 때 잠시 보관 */
const pending = new Map();
export function setPendingFiles(id, files) { pending.set(id, Array.from(files || [])); }
export function takePendingFiles(id) { const f = pending.get(id) || []; pending.delete(id); return f; }
/** 첫 화면에 놓고 아직 읽지 않은 교재가 있는지(새로 고치면 사라지므로 다시 고르라고 알릴 때) */
export const hasPendingFiles = () => [...pending.values()].some((f) => f.length > 0);

/** 옛 7단계 번호 → 새 3단계(교재 넣기·살펴보고 고치기·배포하기) */
export const stageOf = (n) => (n <= 2 ? 1 : n <= 5 ? 2 : 3);

/** 새 연수(빈 것). 교재를 넣고 AI를 고르면 사이트(v2: site·meta)가 생김. extra: 요청 한 줄·참고 디자인 등 */
export async function newProject(extra = {}) {
  const id = uid(10);
  const p = { id, title: '', step: 1, stage: 1, createdAt: Date.now(), files: [], material: null, info: { ...DEFAULT_INFO }, deploy: {}, ...(typeof extra === 'object' ? extra : {}) };
  await projects.put(p);
  return p;
}

/**
 * 연수를 지우기 전에: 그 연수의 AI 작업(이 탭·다른 탭)을 멈추고, 멈출 때까지 잠깐(길어야 ms) 기다림.
 * 멈추지 않고 지우면 작업이 AI를 계속 부르고, 지운 작업 기록(IndexedDB lecpage-gen)을 다시 씀
 */
export async function haltJobs(ids, ms = 4000) {
  let job;
  try { job = await import('./gen/job.js'); } catch { return; } // 조각을 못 받음(오프라인): 이 탭에서 도는 작업도 없음
  for (const id of ids) job.stopJob(id); // 이 탭이면 바로 멈추고, 아니면 다른 탭에 알림
  const until = Date.now() + ms;
  // 이 탭: 화면 상태가 '멈춤'으로 바뀐 뒤에도 마지막 저장이 끝나야 끝난 것(runningHere). 그 전에 지우면 그 저장이 지운 기록을 되살림
  const busy = async (id) => job.runningHere(id) || await job.heldElsewhere(id).catch(() => false);
  for (const id of ids) while (Date.now() < until && await busy(id)) await new Promise((ok) => setTimeout(ok, 100));
  // 기다리는 시간이 지나도록 안 멈춘 작업(느린 기기)이 뒤늦게 저장해도 기록을 다시 쓰지 않게
  for (const id of ids) job.dropJob(id);
}

/** 프로젝트 지우기(교재·그림·AI 작업 기록 포함). 도는 AI 작업은 먼저 멈춤 */
export async function deleteProject(id) { await haltJobs([id]); await projects.remove(id); }

/** 프로젝트 복제(교재·그림 포함) */
export async function duplicateProject(p0) {
  const id = uid(10);
  // 사본은 새 연수: 배포 정보·지난 배포 표시·파일 지문은 따라가지 않음(새 주소·새 연수 코드)
  const p = { ...JSON.parse(JSON.stringify(p0)), id, title: (p0.title || '이름 없는 연수') + ' (사본)', createdAt: Date.now(), deploy: {}, pastDeploy: undefined, carryPending: undefined, fileHash: undefined };
  if (p.blueprint?.meta) p.blueprint.meta.title = p.title;
  if (p.info) p.info.title = p.title;
  const { randomCode } = await import('@engine/src/util.js');
  if (p.blueprint?.live) p.blueprint.live.code = randomCode();
  if (p.meta) { p.meta.title = p.title; p.meta.siteUrl = ''; p.meta.shortUrl = ''; if (p.meta.live) p.meta.live = { ...p.meta.live, code: randomCode() }; }
  // 참여 기능 연결은 연수 코드마다 따로라 사본(새 코드)에는 그대로 쓸 수 없음: 바로 배포 방은 원래 사이트의 것이라 빼고,
  // 강사가 연결한 서버(시트·Supabase·내 서버)는 남겨 두되 '연결 전'으로(배포하기 화면에서 [다시 확인]으로 새 코드를 등록)
  const { PUBLISH_API } = await import('./publish-api.js');
  const origin = (u) => { try { return new URL(u).origin; } catch { return ''; } };
  for (const lv of [p.meta?.live, p.blueprint?.live].filter(Boolean)) {
    if (lv.provider === 'http' && PUBLISH_API && origin(lv.url) === origin(PUBLISH_API)) Object.assign(lv, { provider: 'local', url: '', anonKey: '' });
  }
  p.liveOk = false;
  delete p.demo;
  await projects.put(p);
  // 파일은 하나씩 옮김(연수의 모든 파일을 한꺼번에 메모리에 올리지 않음). 큰 교재는 저장소의 Blob 그대로
  for (const k of await blobs.keys(p0.id)) { const v = await blobs.get(p0.id, k); if (v != null) await blobs.put(id, k, v); }
  return p;
}


const OWN_LIVE = ['sheets', 'supabase', 'http'];
/** 배포한 적이 있으면 무엇이 어디에 배포돼 있었는지(비밀 아님): 주소·배포한 곳·보관 기간. 다른 기기에서 열었을 때 보여 주려고 */
const pastOf = (p) => (p.deploy?.lastUrl ? { url: p.deploy.lastUrl, target: p.deploy.target || '', at: p.deploy.at || 0, ...(p.deploy.target === 'lecpage' && p.deploy.lecpage?.expiresAt ? { expiresAt: p.deploy.lecpage.expiresAt, view: p.deploy.lecpage.view || '' } : {}) } : null);

/**
 * .lecpage 파일 만들기. 기본은 남에게 건네도 되는 파일: 사이트 열쇠·강사 화면 관리자 키·사이트 암호·배포 토큰은 담지 않고,
 * 예전 주소·보관 기간(pastDeploy)만 담음. withKeys('내 다른 기기에서 이어 배포'를 켬)면 배포 정보와 참여 기능 연결·사이트 암호를 carry에 담아
 * 다른 기기에서도 같은 주소·같은 방으로 다시 배포(연 기기에서 강사가 [같은 주소로 배포]를 눌러야 씀)
 */
export async function exportProjectFile(p, { withKeys = false } = {}) {
  const keys = (await blobs.keys(p.id)).sort();
  let carry;
  if (withKeys && p.deploy?.lastUrl) {
    const live = (await siteMeta()).deployView(p)?.live || {};
    const own = OWN_LIVE.includes(live.provider) && live.url;
    const slot = 'live-admin:' + String(live.url).replace(/\/+$/, ''); const ai = own ? await import('./ai.js') : null; // 관리자 키: 연수 코드로 기억한 것 먼저(LiveSetup adminKeyFor와 같은 규칙)
    const liveAdminKey = own ? (live.code && (await ai.loadKey(slot + '#' + live.code).catch(() => ({}))).key) || (await ai.loadKey(slot).catch(() => ({}))).key || '' : '';
    carry = { deploy: p.deploy, live: { provider: live.provider || 'none', url: live.url || '', anonKey: live.anonKey || '', code: live.code || '' }, liveOk: !!p.liveOk, sitePassword: p.sitePassword || '', ...(liveAdminKey ? { liveAdminKey } : {}) };
  }
  const project = { ...p, deploy: undefined, sitePassword: undefined, carry: undefined, carryPending: undefined, fileHash: undefined, pastDeploy: pastOf(p) || p.pastDeploy || undefined, ...(carry ? { carry } : {}) };
  // 파일은 하나씩 꺼내 Blob 조각으로 이음(연수의 모든 파일을 한꺼번에 메모리에 올리지 않음: 큰 교재가 여럿이면 수 GB).
  // 교재 쪽 그림은 넣을 때 그린 것(assets/slides)과 사이트용(site/material)이 같은 내용이면 사이트용 한 벌만 담고 짝(same)을 적어 둠 → 열 때 되살림
  const w = storedZipWriter();
  const isSlide = (k) => /^assets\/slides\/slide-\d+\.\w+$/.test(k);
  const twinKey = (k) => { const m = /^(?:assets\/slides\/slide|site\/material\/p)-(\d+)\.(\w+)$/.exec(k); return m ? `${+m[1]}.${m[2].toLowerCase()}` : ''; };
  const mat = new Map(); const same = {};
  for (const k of [...keys.filter((x) => !isSlide(x)), ...keys.filter(isSlide)]) {
    if (k.startsWith('conv/')) continue; // 커넥트가 만든 PDF: 여는 쪽이 받지 않는 자리라 담지 않음(다시 만들 수 있음)
    const v = await blobs.get(p.id, k); if (v == null) continue;
    const data = v instanceof Blob ? v : new Blob([v]);
    const sum = await blobCrc(data);
    if (isSlide(k)) { const t = mat.get(twinKey(k)); if (t && t.crc === sum.crc && t.size === sum.size) { same[k] = t.key; continue; } }
    else if (k.startsWith('site/material/') && twinKey(k)) mat.set(twinKey(k), { ...sum, key: k });
    await w.add(k, data, sum);
  }
  await w.add('project.json', JSON.stringify({ format: PROJECT_FORMAT, version: PROJECT_VERSION, project, ...(Object.keys(same).length ? { same } : {}) }, null, 2));
  return w.finish();
}

/** 파일에서 받은 예전 배포 표시(글자·숫자만) */
function cleanPast(x) {
  if (!x || typeof x !== 'object' || !/^https?:\/\/\S+$/.test(String(x.url || ''))) return undefined;
  return { url: String(x.url).slice(0, 300), target: String(x.target || '').slice(0, 30), at: Number(x.at) || 0, expiresAt: Number(x.expiresAt) || 0, view: x.view === 'pages' ? 'pages' : '' };
}
/** 파일에서 받은 배포 정보(열쇠 포함): 모양만 확인해 두고, 쓰는 것은 강사가 배포하기 화면에서 [같은 주소로 배포]를 누를 때 */
function cleanCarry(c) {
  if (!c || typeof c !== 'object' || !c.deploy || typeof c.deploy !== 'object' || !/^https?:\/\/\S+$/.test(String(c.deploy.lastUrl || ''))) return undefined;
  const l = c.live && typeof c.live === 'object' ? c.live : {};
  return { deploy: JSON.parse(JSON.stringify(c.deploy)), live: { provider: [...OWN_LIVE, 'local', 'none'].includes(l.provider) ? l.provider : 'none', url: String(l.url || '').slice(0, 300), anonKey: String(l.anonKey || '').slice(0, 400), code: String(l.code || '').slice(0, 40) },
    liveOk: !!c.liveOk, sitePassword: String(c.sitePassword || '').slice(0, 200), liveAdminKey: String(c.liveAdminKey || '').slice(0, 200) };
}
/**
 * 예전 방식(설계도)으로 만든 연수를 파일에서 열 때: 사이트는 다시 그리지 않으므로(AI로 새로 만듦) 남겨 둘 것만.
 * 제목·켠 참여 기능·받을 정보·보관 기간. 참여 기능 서버 연결·주소·공개 범위는 남이 준 파일일 수 있어 받지 않음
 */
async function legacyOf(bp) {
  const { randomCode } = await import('@engine/src/util.js');
  const f = Array.isArray(bp?.live?.features) ? bp.live.features.filter((x) => typeof x === 'string').slice(0, 12) : [];
  const pv = bp?.privacy && typeof bp.privacy === 'object' ? bp.privacy : {};
  return {
    meta: { title: String(bp?.meta?.title || '').slice(0, 160) },
    live: { provider: f.length ? 'local' : 'none', url: '', anonKey: '', code: randomCode(), features: f, anonymous: true },
    privacy: { collect: Array.isArray(pv.collect) && pv.collect.length ? pv.collect.filter((x) => typeof x === 'string').slice(0, 4) : ['nickname'], retentionDays: Math.min(365, Math.max(1, +pv.retentionDays || 30)), consent: true, processors: [] },
  };
}

/** 화면에 그대로 보여 줄 오류(무슨 일인지 + 할 일). 그 밖의 오류(JSON 깨짐 등)는 부른 쪽이 쉬운 말로 바꿔요 */
const bad = (m) => Object.assign(new Error(m), { friendly: true });

/** 저장한 연수 파일(.lecpage)인지. 교재 자리(첫 화면·교재 넣기)에 놓아도 교재가 아니라 연수로 엶 */
export const isSavedFile = (f) => /\.lecpage$/i.test(f?.name || '');

/** 저장한 연수 파일을 새 연수로 넣고 그 연수로 감. 알릴 한 줄을 돌려줌(실패하면 오류. err.friendly면 그 글을 그대로 보여 줌) */
export async function openSavedFile(file) {
  const p = await importProjectFile(file);
  location.hash = `#/p/${p.id}/${p.stage || 1}`;
  if (p.reopened) return '이미 연 파일이라 그때 연 연수를 다시 열었어요. 하나 더 만들려면 처음 화면에서 [복제]를 눌러요.';
  if (p.origin === 'skill') return 'AI 에이전트에서 만든 연수를 열었어요.';
  if (p.carryPending) return '저장한 파일을 열었어요. 배포하기에서 같은 주소로 배포할 수 있어요.';
  if (p.pastDeploy) return '저장한 파일을 열었어요. 이 파일에는 배포 열쇠가 없어서, 여기서 배포하면 새 주소가 생겨요.';
  return '저장한 파일을 열었어요.';
}
export const OPEN_FAIL = '파일을 열지 못했어요. lecpage에서 저장한 .lecpage 파일인지 확인해 주세요.';

/** 파일에서 꺼낸 항목(Blob 조각)을 저장소에 담을 값으로: 큰 것은 Blob 그대로(메모리에 올리지 않음), 작은 것은 예전처럼 바이트 */
const BIG_ENTRY = 32 * 1024 * 1024;
const storable = async (v) => (v instanceof Blob ? (v.size > BIG_ENTRY ? v : new Uint8Array(await v.arrayBuffer())) : v);

export async function importProjectFile(file) {
  let proj, assets = {}, text;
  if (/\.json$/i.test(file.name)) {
    text = new TextDecoder().decode(await file.arrayBuffer());
    const j = JSON.parse(text);
    if (j.format === PROJECT_FORMAT) proj = j.project;
    // 설계도(JSON)만 담은 파일은 예전 방식: 열지 않고 새로 만드는 길로
    else throw bad('예전 방식의 설계도 파일이라 열 수 없어요. 교재를 넣고 AI로 새로 만들어 주세요.');
  } else {
    // 머리만 읽고 내용은 파일의 조각으로 둠(큰 교재가 든 파일을 메모리에 통째로 올리지 않음). 담을 때 하나씩 읽음
    const files = await readStoredZipBlob(file);
    const pj = files['project.json']; if (!pj) throw bad('lecpage에서 저장한 파일이 아니에요. lecpage의 [파일로 저장]으로 만든 .lecpage 파일을 넣어 주세요.');
    text = await pj.text();
    const j = JSON.parse(text);
    // AI 에이전트(Skill `lecpage app`)가 만든 사이트 파일(.lecpage v2: project.json + site/… + src/…) → 완성 화면으로 바로
    if (j?.format === PROJECT_FORMAT && +j.version === 2 && j.kind === 'site') {
      const bytes = {}; for (const [k, v] of Object.entries(files)) bytes[k] = new Uint8Array(await v.arrayBuffer());
      return importSiteFile(bytes, text);
    }
    proj = j.project;
    for (const [k, v] of Object.entries(files)) if (k !== 'project.json' && (isAllowedAsset(k) || /^site\/(material|assets\/img|files)\/[\w.\-가-힣]+\.(webp|png|jpe?g|gif|pdf|pptx|docx|hwpx?)$/i.test(k))) assets[k] = v;
    // 저장할 때 한 벌만 담은 교재 쪽 그림(same)을 되살림: 넣을 때 그린 것(assets/slides) ← 사이트용(site/material)
    for (const [dst, src] of sameEntries(j)) if (assets[dst] === undefined && assets[src] !== undefined) assets[dst] = assets[src];
  }
  // 같은 파일을 두 번 열면 같은 이름 연수가 둘 생기지 않게 그때 연 연수를 다시 엶(따로 하나 더 쓰려면 [복제])
  const fileHash = await sha256Hex(text).catch(() => '');
  const same = fileHash && (await projects.all()).find((x) => x.fileHash === fileHash);
  if (same) return { ...same, reopened: true };
  // 남이 준 파일: 실시간 연결·QR 주소는 다시 정하게 비우고, 자료는 그림·문서만 받음
  const id = uid(10);
  // 배포 정보: 열쇠를 담은 파일(carry)이어도 바로 쓰지 않고 배포하기 화면에서 강사가 고르게(남이 준 파일의 열쇠로 남의 사이트에 배포하지 않게)
  const carry = cleanCarry(proj?.carry);
  const { isV2, keepTeacher } = await siteMeta();
  const v2 = isV2(proj);
  const p = { ...proj, id, createdAt: Date.now(), deploy: {}, stage: v2 || proj?.blueprint ? 2 : 1, imported: true, demo: undefined, fileHash, carry: undefined, carryPending: carry, pastDeploy: carry ? cleanPast({ ...pastOf(carry), ...(proj?.pastDeploy || {}) }) : cleanPast(proj?.pastDeploy) };
  if (p.blueprint) p.blueprint = await legacyOf(p.blueprint);
  // 새 판: 사이트 글만 받고(그림은 위 assets), 연수 정보의 강사 칸(실시간 주소·QR 주소·공개 범위)은 비움
  if (v2) {
    p.v = 2;
    p.site = Object.fromEntries(Object.entries(proj.site || {}).filter(([k, v]) => typeof v === 'string' && /^[\w./-]+\.(html|css|js|json|txt|svg)$/i.test(k) && !k.includes('..')));
    p.meta = keepTeacher(proj.meta || {}, { access: 'link' });
    p.versions = []; p.gen = undefined;
  }
  await projects.put(p);
  for (const [k, v] of Object.entries(assets)) await blobs.put(id, k, await storable(v));
  return p;
}

/**
 * .lecpage v2(엔진 kit/project-v2.js) → 새 판 연수. 사이트 글은 p.site, 그림·자료는 저장소 site/…, 교재 원본은 src/….
 * 파일 안의 강사 값(공개 범위·주소·참여 서버)은 남이 준 파일일 수 있어 쓰지 않음(배포하기 화면에서 다시 정함)
 */
async function importSiteFile(files, text) {
  const fileHash = await sha256Hex(text).catch(() => '');
  const same = fileHash && (await projects.all()).find((x) => x.fileHash === fileHash);
  if (same) return { ...same, reopened: true };
  const { unpackProjectV2 } = await import('@engine/src/kit/project-v2.js');
  const u = unpackProjectV2(files);
  const id = uid(10); const site = {}; const bins = {};
  for (const [k, v] of Object.entries(u.site)) { if (typeof v === 'string') site[k] = v; else bins['site/' + k] = v; }
  const safe = (n) => String(n).replace(/[^\w가-힣.\-]+/g, '_').slice(0, 120);
  const srcFiles = u.originals.map((o) => ({ name: o.name, key: 'src/' + safe(o.name), size: o.bytes.length, ext: (o.name.split('.').pop() || '').toLowerCase(), pages: (u.sources.find((s) => s.name === o.name) || {}).pages || 0, errors: [] }));
  for (const o of u.originals) bins['src/' + safe(o.name)] = o.bytes;
  const html = site['index.html'] || '';
  const meta = (await siteMeta()).keepTeacher(u.meta, { access: 'link' });
  // AI 에이전트가 site/files/에 넣고 어디에도 걸지 않은 자료 → 완성 화면의 자료 목록(Skill 조립 kit-cmds unlistedFiles와 같은 규칙)
  const used = Object.values(site).join('\n');
  const materials = Object.keys(u.site).filter((k) => /^(assets\/)?files\/[^/]+$/.test(k) && !used.includes(k) && !used.includes(encodeURI(k))).sort().map((k) => {
    const name = k.split('/').pop(); const v = u.site[k];
    return { id: uid(8), title: name.replace(/\.[^.]+$/, ''), desc: '', href: k, size: typeof v === 'string' ? v.length : v?.byteLength || v?.length || 0, kind: ((/\.([a-z0-9]+)$/i.exec(name) || [])[1] || '').toUpperCase(), at: Date.now() };
  });
  const p = { id, v: 2, ...(materials.length ? { materials } : {}), title: u.title || meta.title || '', createdAt: Date.now(), stage: 2, step: 2, imported: true, origin: 'skill', fileHash, files: srcFiles, info: { ...DEFAULT_INFO }, deploy: {},
    site: { ...site, 'index.html': html }, meta, material: u.material?.pages?.length ? { pages: u.material.pages, files: [] } : null, versions: [{ id: uid(8), at: Date.now(), label: 'AI 에이전트가 만든 버전', site, meta }], ...(u.note ? { notes: [u.note] } : {}) };
  await projects.put(p);
  for (const [k, v] of Object.entries(bins)) await blobs.put(id, k, v);
  return p;
}
