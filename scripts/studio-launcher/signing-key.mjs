#!/usr/bin/env node
// lecpage 커넥트 묶음 서명 키(ed25519). 운영자가 자기 PC에서 키를 만들고 공개 키를 넣을 때, 릴리스 워크플로가 서명할 때 씀(바깥 패키지 없음).
//   node scripts/studio-launcher/signing-key.mjs new [--out <파일>]  키 한 쌍: 비밀 키는 저장소 밖 파일(기본 ~/.lecpage/connect-signing-key.pem,
//                                                                   이 사용자만 읽음), 공개 키는 저장소의 세 곳에 넣고 GitHub 비밀 등록 명령을 보여 줌
//   node scripts/studio-launcher/signing-key.mjs add <공개 키>      공개 키 넣기(키를 바꿀 때 새 키를 먼저)
//   node scripts/studio-launcher/signing-key.mjs remove <공개 키>   공개 키 빼기(마지막 키를 빼면 서명 확인을 끔)
//   node scripts/studio-launcher/signing-key.mjs check              세 곳의 공개 키 목록이 같은지
//   node scripts/studio-launcher/signing-key.mjs verify <파일>…     받은 파일을 옆의 <파일>.sig와 넣어 둔 공개 키로 확인
//   node scripts/studio-launcher/signing-key.mjs sign <파일>…       (워크플로) 환경 변수 CONNECT_SIGNING_KEY(PEM)로 <파일>.sig를 씀
// 공개 키 목록의 기준은 skills/lecpage/scripts/studio-update.mjs의 SIGNING_KEYS, 실행 파일 둘(lecpage-connect.cmd·.sh)에도 같은 목록(시험이 확인).
// 비밀 키는 화면·로그·저장소에 내지 않음. 절차: docs/operations.md 15절
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute, basename } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RELEASE, KEY_RE, verifySignature } from '../../skills/lecpage/scripts/studio-update.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** GitHub Actions 비밀 이름(워크플로의 서명 단계에만 넘김) */
export const SECRET = 'CONNECT_SIGNING_KEY';
export const REPO = RELEASE.match(/github\.com\/([^/]+\/[^/]+)\//)[1];
export const DEFAULT_OUT = join(homedir(), '.lecpage', 'connect-signing-key.pem');

const quoted = (s) => [...s.matchAll(/'([^']*)'/g)].map((m) => m[1]);
/** 공개 키 목록이 박힌 곳(첫 줄이 기준). 바꾸기는 줄 하나를 통째로 */
export const KEY_FILES = [
  { file: 'skills/lecpage/scripts/studio-update.mjs', re: /^export const SIGNING_KEYS = \[([^\]\n]*)\];$/m, parse: quoted, put: (k) => `export const SIGNING_KEYS = [${k.map((x) => `'${x}'`).join(', ')}];` },
  { file: 'scripts/studio-launcher/lecpage-connect.sh', re: /^ {2}SIGNING_KEYS='([^'\n]*)'$/m, parse: (s) => s.split(/\s+/).filter(Boolean), put: (k) => `  SIGNING_KEYS='${k.join(' ')}'` },
  { file: 'scripts/studio-launcher/lecpage-connect.cmd', re: /^\$SigningKeys = @\(([^)\n]*)\)$/m, parse: quoted, put: (k) => `$SigningKeys = @(${k.map((x) => `'${x}'`).join(', ')})` },
];

/** 글에서 공개 키 목록 → 배열(자리가 없으면 null) */
export function keysInText(entry, text) { const m = entry.re.exec(text); return m ? entry.parse(m[1]) : null; }
/** 글의 공개 키 목록 줄을 keys로 바꾼 글(자리가 없으면 오류) */
export function withKeys(entry, text, keys) {
  if (!entry.re.test(text)) throw new Error(`${entry.file}에서 공개 키 목록 자리를 찾지 못했어요.`);
  return text.replace(entry.re, () => entry.put(keys));
}
/** 공개 키 꼴 확인(base64url 43자, ed25519 32바이트) */
export function checkKey(x) {
  if (!KEY_RE.test(String(x))) throw new Error(`공개 키 꼴이 아니에요(base64url 43자): ${x}`);
  try { createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' }); } catch { throw new Error(`ed25519 공개 키가 아니에요: ${x}`); }
  return x;
}
/** 열쇠 객체(비밀·공개) → 공개 키(base64url) */
export const publicKeyOf = (key) => (key.type === 'public' ? key : createPublicKey(key)).export({ format: 'jwk' }).x;

/** 세 곳의 목록 → { 파일: 배열 } */
export function readKeys(root = ROOT) {
  const out = {};
  for (const e of KEY_FILES) {
    const keys = keysInText(e, readFileSync(join(root, e.file), 'utf8'));
    if (!keys) throw new Error(`${e.file}에서 공개 키 목록 자리를 찾지 못했어요.`);
    out[e.file] = keys;
  }
  return out;
}
/** 세 곳이 같으면 그 목록, 다르면 오류 */
export function embeddedKeys(root = ROOT) {
  const all = readKeys(root);
  const [first, ...rest] = Object.values(all);
  if (rest.some((k) => k.join(' ') !== first.join(' '))) {
    throw new Error(`공개 키 목록이 서로 달라요. 'node scripts/studio-launcher/signing-key.mjs check'로 보고 add·remove로 맞춰요.\n${Object.entries(all).map(([f, k]) => `  ${f}: ${k.join(' ') || '(없음)'}`).join('\n')}`);
  }
  for (const x of first) checkKey(x);
  return first;
}
/** 세 곳에 같은 목록을 씀 */
export function writeKeys(keys, root = ROOT) {
  keys.forEach(checkKey);
  if (new Set(keys).size !== keys.length) throw new Error('같은 공개 키가 두 번 있어요.');
  for (const e of KEY_FILES) {
    const p = join(root, e.file);
    writeFileSync(p, withKeys(e, readFileSync(p, 'utf8'), keys));
  }
}
export function addKey(x, root = ROOT) {
  const keys = embeddedKeys(root); checkKey(x);
  if (keys.includes(x)) throw new Error('이미 들어 있는 공개 키예요.');
  writeKeys([...keys, x], root);
  return [...keys, x];
}
export function removeKey(x, root = ROOT) {
  const keys = embeddedKeys(root);
  if (!keys.includes(x)) throw new Error('들어 있지 않은 공개 키예요.');
  const next = keys.filter((k) => k !== x);
  writeKeys(next, root);
  return next;
}

const shQ = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const psQ = (s) => `'${String(s).replace(/'/g, "''")}'`;
/** 비밀 키 파일(들)을 GitHub 비밀로 올리는 명령(파일을 읽어 넘기기만 하고 내용은 화면에 내지 않음). 여럿이면 이어 붙임(키를 바꾸는 동안) */
export function secretCommand(file, platform = process.platform) {
  const files = [].concat(file);
  if (platform === 'win32') return `Get-Content -Raw ${files.map(psQ).join(',')} | gh secret set ${SECRET} --repo ${REPO}`;
  return files.length > 1 ? `cat ${files.map(shQ).join(' ')} | gh secret set ${SECRET} --repo ${REPO}` : `gh secret set ${SECRET} --repo ${REPO} < ${shQ(files[0])}`;
}

/**
 * 키 한 쌍 만들기: 비밀 키는 out(저장소 밖, 이미 있으면 덮지 않음, 0600)에 PKCS#8 PEM으로, 공개 키는 세 곳에 더함 → { file, publicKey }
 * 윈도우에서는 0600이 뜻이 없어 사용자 폴더 권한(이 사용자·관리자만)으로 보호됨
 */
export function newKey({ out = DEFAULT_OUT, root = ROOT, platform = process.platform, log = console.log } = {}) {
  const file = resolve(out);
  const rel = relative(resolve(root), file);
  if (!rel || (!rel.startsWith('..') && !isAbsolute(rel))) throw new Error('비밀 키 파일은 저장소 밖에 둬요(--out으로 다른 곳을 골라요).');
  if (existsSync(file)) throw new Error(`이미 키 파일이 있어요: ${file}\n같은 키로 GitHub 비밀만 다시 넣으려면: ${secretCommand(file, platform)}\n새 키로 바꾸려면 docs/operations.md 15절의 '키 바꾸기'를 따라요.`);
  const keys = embeddedKeys(root);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  writeFileSync(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  try { chmodSync(file, 0o600); } catch { /* 윈도우 */ }
  const x = publicKeyOf(publicKey);
  try { writeKeys([...keys, x], root); } catch (e) { throw new Error(`비밀 키는 ${file}에 만들었지만 공개 키를 저장소에 넣지 못했어요(${e.message}). 고친 뒤: node scripts/studio-launcher/signing-key.mjs add ${x}`); }
  const head = [
    `비밀 키를 만들었어요: ${file}`,
    '  이 파일 내용은 화면·저장소·대화·메신저에 붙여 넣지 마세요.',
    `공개 키: ${x}`,
    `저장소의 세 곳에 공개 키를 넣었어요: ${KEY_FILES.map((e) => e.file).join(' · ')}`,
    '',
  ];
  const verify = `gh release download studio-latest --repo ${REPO} -p 'lecpage-connect.tar.gz*' -D <빈 폴더> 다음 node scripts/studio-launcher/signing-key.mjs verify <빈 폴더>/lecpage-connect.tar.gz`;
  log([...head, ...(keys.length ? [
    '목록에 예전 공개 키가 있어 키 바꾸기로 이어가요(docs/operations.md 15절):',
    '1. 공개 키를 넣은 세 파일을 커밋하고 main에 push해요(서명은 아직 예전 키로, 새 목록이 먼저 퍼짐).',
    `2. 비밀을 예전 키와 새 키 둘로: ${secretCommand(['<예전 키 파일>', file], platform)}`,
    '3. 몇 달 뒤: 비밀을 새 키 하나로 바꾼 다음 예전 키를 빼고(node scripts/studio-launcher/signing-key.mjs remove <예전 공개 키>) 커밋·push해요.',
  ] : [
    '이 순서로 마무리해요(docs/operations.md 15절):',
    `1. GitHub 비밀 등록(키 내용은 화면에 나오지 않아요): ${secretCommand(file, platform)}`,
    `2. 확인: gh secret list --repo ${REPO}  (${SECRET}가 보이면 돼요)`,
    '3. 공개 키를 넣은 세 파일을 커밋하고 main에 push해요. 릴리스 워크플로가 묶음과 함께 서명(.sig)을 올려요.',
    `4. 올라간 묶음 확인: ${verify}`,
    '5. 키 파일은 비밀번호 관리자에 파일로 보관해요(키를 바꿀 때 예전 키로도 서명해야 이미 깔린 커넥트가 새 판을 받아요). 보관한 뒤에는 이 PC에서 지워도 돼요.',
  ])].join('\n'));
  return { file, publicKey: x };
}

/**
 * (워크플로) files마다 <파일>.sig(base64 서명, 키마다 한 줄)를 씀. pem은 비밀 CONNECT_SIGNING_KEY: PEM 비밀 키 하나, 키를 바꾸는 동안은 둘을 이어 붙인 것
 * (예전 키·새 키로 함께 서명해 아직 새 공개 키를 받지 못한 실행 파일·커넥트도 받게).
 * 공개 키도 비밀도 없으면 건너뜀(지금과 같음) · 공개 키가 있는데 비밀이 없거나, 비밀의 키가 목록에 없으면 실패(서명 없이 올리면 실행 파일이 받지 않음)
 */
export function runSign({ files = [], pem = '', root = ROOT, log = console.log } = {}) {
  const keys = embeddedKeys(root);
  if (!String(pem).trim()) {
    if (!keys.length) { log(`공개 키를 아직 넣지 않았고 비밀 ${SECRET}도 없어 서명을 건너뛰어요(실행 파일은 SHA-256만 확인).`); return { signed: [], skipped: true }; }
    throw new Error(`공개 키가 들어 있는데 비밀 ${SECRET}가 없어요. 서명 없이 올리면 실행 파일이 새 판을 받지 않아요(docs/operations.md 15절).`);
  }
  const blocks = String(pem).match(/-----BEGIN PRIVATE KEY-----[\s\S]+?-----END PRIVATE KEY-----/g) || [];
  const privs = new Map();
  const unreadable = new Error(`비밀 ${SECRET}를 읽지 못했어요(PEM 꼴의 ed25519 비밀 키여야 해요).`);
  for (const b of blocks) {
    let k; try { k = createPrivateKey(b); } catch { throw unreadable; }
    if (k.asymmetricKeyType !== 'ed25519') throw new Error(`비밀 ${SECRET}에 ed25519가 아닌 키가 있어요.`);
    privs.set(publicKeyOf(k), k);
  }
  if (!privs.size) throw unreadable;
  if (keys.length && [...privs.keys()].some((x) => !keys.includes(x))) throw new Error(`비밀 ${SECRET}의 키가 넣어 둔 공개 키 중 어느 것과도 맞지 않아요. 키를 바꾸는 중이면 새 공개 키를 먼저 넣어요(docs/operations.md 15절).`);
  if (!files.length) throw new Error('서명할 파일이 없어요.');
  const signed = [];
  for (const f of files) {
    const data = readFileSync(f);
    const lines = [...privs].map(([x, k]) => {
      const sig = sign(null, data, k).toString('base64');
      if (!verifySignature(data, sig, [x])) throw new Error(`서명을 확인하지 못했어요: ${basename(f)}`);
      return sig;
    });
    writeFileSync(`${f}.sig`, `${lines.join('\n')}\n`);
    signed.push(`${f}.sig`);
  }
  log(`서명했어요(키 ${privs.size}개): ${signed.map((s) => basename(s)).join(' · ')}${keys.length ? '' : ' (공개 키를 아직 넣지 않아 실행 파일은 이 서명을 확인하지 않아요)'}`);
  return { signed, skipped: false, keys: [...privs.keys()] };
}

/** 받은 파일을 <파일>.sig와 넣어 둔 공개 키로 확인 → [{ file, ok }] */
export function verifyFiles(files, root = ROOT) {
  const keys = embeddedKeys(root);
  if (!keys.length) throw new Error('공개 키를 아직 넣지 않았어요.');
  return files.map((f) => {
    let ok = false;
    try { ok = verifySignature(readFileSync(f), readFileSync(`${f}.sig`, 'utf8'), keys); } catch { /* 파일이나 .sig가 없음 */ }
    return { file: f, ok };
  });
}

const USAGE = `쓰는 법: node scripts/studio-launcher/signing-key.mjs <new [--out 파일] | add 공개키 | remove 공개키 | check | verify 파일… | sign 파일…>
자세한 순서: docs/operations.md 15절`;
export function main(argv, { env = process.env, log = console.log, err = console.error } = {}) {
  const [cmd, ...rest] = argv;
  const gha = env.GITHUB_ACTIONS === 'true';
  try {
    if (cmd === 'new') {
      const i = rest.indexOf('--out');
      newKey({ out: i >= 0 ? rest[i + 1] : DEFAULT_OUT, log });
    } else if (cmd === 'add' && rest[0]) {
      log(`넣었어요. 지금 목록: ${addKey(rest[0]).join(' ')}`);
    } else if (cmd === 'remove' && rest[0]) {
      const next = removeKey(rest[0]);
      log(next.length ? `뺐어요. 지금 목록: ${next.join(' ')}` : '뺐어요. 공개 키가 없어 실행 파일은 서명을 확인하지 않아요(SHA-256만).');
    } else if (cmd === 'check') {
      const keys = embeddedKeys();
      log(keys.length ? `세 곳이 같아요: ${keys.join(' ')}` : '세 곳이 같아요: 공개 키 없음(서명 확인을 하지 않음)');
    } else if (cmd === 'verify' && rest.length) {
      const r = verifyFiles(rest);
      for (const { file, ok } of r) log(`${ok ? '맞아요' : '맞지 않아요'}: ${basename(file)}`);
      if (r.some((x) => !x.ok)) return 1;
    } else if (cmd === 'sign') {
      const r = runSign({ files: rest, pem: env[SECRET] || '', log: (m) => log(gha ? `::notice::${m}` : m) });
      if (r.skipped) return 0;
    } else {
      log(USAGE);
      return cmd ? 1 : 0;
    }
    return 0;
  } catch (e) {
    err(gha ? `::error::${e.message.replace(/\n/g, '%0A')}` : e.message);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
