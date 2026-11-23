// 저장한 연수 파일(.lecpage) 열기 — 첫 화면·교재 넣기 화면이 함께 씀(project.js openSavedFile 위에 한 겹)
// - 같은 파일을 두 번 열면 같은 이름 연수가 둘 생기던 것: 이 브라우저에서 이미 연 파일이면(내용이 같은 파일) 그때 만든 연수로 감.
//   열었던 파일의 지문(SHA-256)과 연수 id만 이 브라우저 저장소(kv)에 적음. 따로 하나 더 두려면 '내 연수'의 [복제]
// - lecpage가 저장한 파일이 아니면(다른 ZIP) 낯선 파일 이름(project.json) 대신 쉬운 말로
import { openSavedFile, OPEN_FAIL, stageOf } from './project.js';
import { kv, projects } from './db.js';

const NOT_OURS = "lecpage에서 저장한 파일이 아니에요. lecpage의 [파일로 저장]으로 받은 .lecpage 파일을 열어 주세요.";

// 큰 파일(큰 교재가 든 연수)은 통째로 읽지 않음: 크기 + 끝 4MiB로 지문을 냄.
// 끝에는 ZIP 목록(항목마다 이름·크기·CRC)과 맨 뒤에 담는 project.json이 있어 내용이 다르면 지문도 달라요
const FP_WHOLE = 64 * 1024 * 1024, FP_TAIL = 4 * 1024 * 1024;
async function fingerprint(file) {
  try {
    const big = file.size > FP_WHOLE;
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', await (big ? file.slice(file.size - FP_TAIL) : file).arrayBuffer()));
    const hex = Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
    return big ? `t${file.size}-${hex}` : hex;
  } catch { return ''; }
}

/** 열고 알릴 한 줄을 돌려줌(실패하면 오류. 알릴 말은 openFailMessage) */
export async function openSaved(file) {
  const fp = await fingerprint(file);
  if (fp) {
    const id = await kv.get('opened:' + fp).catch(() => null);
    const p = id && await projects.get(id).catch(() => null);
    if (p) { location.hash = `#/p/${p.id}/${p.stage || stageOf(p.step || 1)}`; return '이미 열었던 파일이에요. 그때 연 연수로 이어서 해요.'; }
  }
  const msg = await openSavedFile(file);
  const id = /#\/p\/([^/]+)/.exec(location.hash)?.[1];
  if (fp && id) kv.set('opened:' + fp, id).catch(() => { });
  return msg;
}

/** 열지 못했을 때 보여 줄 한 줄 */
export function openFailMessage(err) {
  if (!err?.friendly) return OPEN_FAIL;
  return /project\.json/.test(err.message || '') ? NOT_OURS : err.message;
}
