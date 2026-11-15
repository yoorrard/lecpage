import { useEffect, useState } from 'preact/hooks';
import { stageOf, duplicateProject, deleteProject, exportProjectFile } from '../lib/project.js';
import { Dialog } from '../components/ui.jsx';
import { copy, fmtDate, toast, saveFile, safeName } from '../lib/util.js';

// 첫 화면의 '내 연수' 목록. 만든 연수가 있을 때만 받아요(처음 오는 사람의 첫 화면을 가볍게).
const STAGE = ['', '교재 넣기', '살펴보고 고치기', '배포하기'];
const md = (t) => new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
/** 배포 상태 꼬리표: 보관 기간이 정해진 바로 배포(마지막 배포 뒤 N일)는 그날까지, 지났으면 '보관 기간 끝' */
function deployTag(p) {
  const lec = p.deploy?.target === 'lecpage' ? p.deploy.lecpage : null;
  if ((lec?.view === 'pages' || lec?.fixed) && lec.expiresAt) return lec.expiresAt <= Date.now() ? { t: '보관 기간 끝', gone: true } : { t: `배포됨 · ${md(lec.expiresAt)}까지`, until: md(lec.expiresAt) };
  return { t: '배포됨' };
}

/**
 * 배포한 연수 카드의 연수 당일 바로 가기: 강사 화면(참여 기능이 있을 때, 다른 화면은 모두 여기서)·발표 화면·주소와 QR.
 * 강사 화면을 누르면 이 기기에 기억한 관리자 키를 먼저 복사해 둠(새 탭이 열리기 전에, 붙여 넣기만 하게)
 */
function DayLinks({ p, adminKey }) {
  const url = String(p.deploy.lastUrl).replace(/\/?$/, '/');
  const live = (p.blueprint?.live?.features || []).length > 0;
  return (
    <div class="proj-day" role="group" aria-label={`${p.title || '연수'} 연수 당일`}>
      {live && <a class="btn btn-sm" href={url + 'console.html'} target="_blank" rel="noopener" onClick={() => adminKey && copy(adminKey, '관리자 키를 복사했어요. 강사 화면에 붙여 넣으세요.')}>강사 화면</a>}
      <a class="btn btn-sm" href={url + 'screen.html'} target="_blank" rel="noopener">발표 화면</a>
      <a class="btn btn-sm btn-quiet" href={`#/p/${p.id}/3`}>주소·QR</a>
    </div>
  );
}

/** list: 연수 목록, once·busyProps: 두 번 눌러도 한 번만(Home), reload: 목록 다시 읽기. 지우기 확인 창도 여기(첫 화면 코드를 가볍게) */
export function Mine({ list, once, busyProps, reload }) {
  const [del, setDel] = useState(null);
  // 배포한 연수의 강사 화면 관리자 키(바로 배포는 연수에, 내 서버·시트는 이 기기의 키 보관함에). 보관함 모듈은 필요할 때만 받음
  const [keys, setKeys] = useState({});
  useEffect(() => {
    const pub = list.filter((p) => p.deploy?.lastUrl && (p.blueprint?.live?.features || []).length);
    if (!pub.length) return;
    const now = Object.fromEntries(pub.filter((p) => p.deploy.lecpage?.adminKey).map((p) => [p.id, p.deploy.lecpage.adminKey]));
    setKeys(now);
    const rest = pub.filter((p) => !now[p.id] && p.blueprint.live?.url);
    if (rest.length) import('../lib/ai.js').then((m) => Promise.all(rest.map((p) => m.loadKey('live-admin:' + String(p.blueprint.live.url).replace(/\/+$/, '')).then((r) => [p.id, r.key])))).then((kv) => setKeys((k) => ({ ...k, ...Object.fromEntries(kv.filter((x) => x[1])) })), () => { });
  }, [list]);
  const delTag = del?.deploy?.lastUrl ? deployTag(del) : null;
  const live = !!delTag && !delTag.gone; // 아직 열려 있는 배포한 연수
  return (
    <section class="ld-mine" aria-labelledby="ld-mine-h">
      <div class="section-title"><h2 id="ld-mine-h">내 연수</h2><p class="muted">이 브라우저에 저장돼 있어요. 눌러서 이어서 만들어요.</p></div>
      <div class="grid grid-3">
        {list.map((p) => {
          const st = p.stage || stageOf(p.step || 1);
          const tag = p.deploy?.lastUrl ? deployTag(p) : null;
          return (
            <div class="proj">
              <a class="proj-link" href={`#/p/${p.id}/${st}`}><h3>{p.title || '이름 없는 연수'}</h3></a>
              <div class="meta"><span class="tag tag-lav">{STAGE[st]}</span>{tag && <span class={`tag ${tag.gone ? 'tag-peach' : 'tag-mint'}`}>{tag.t}</span>}<span>{fmtDate(p.updatedAt)}</span></div>
              {tag && !tag.gone && <DayLinks p={p} adminKey={keys[p.id]} />}
              {tag?.gone && <div class="proj-day"><a class="btn btn-sm" href={`#/p/${p.id}/3`}>다시 배포하기</a><span class="small muted">새 주소로 열려요.</span></div>}
              <div class="proj-actions">
                <button class="btn btn-sm btn-quiet" {...busyProps(`dup-${p.id}`, '복제 중…')} onClick={() => once(`dup-${p.id}`, async () => { await duplicateProject(p); toast('복제했어요.'); reload(); }, { stay: true, fail: '복제하지 못했어요. 설정에서 저장 공간을 확인해 주세요.' })}>복제</button>
                <button class="btn btn-sm btn-quiet" onClick={() => setDel(p)}>지우기</button>
              </div>
            </div>
          );
        })}
      </div>
      <Dialog open={!!del} onClose={() => setDel(null)} label="연수 지우기 확인">
        <h2 class="h-sub">"{del?.title || '이름 없는 연수'}"를 지울까요?</h2>
        {live
          ? <>
            <p>이 브라우저에 있는 교재·그림·고친 내용과 배포 열쇠가 지워져요. 배포한 사이트는 {delTag.until ? `${delTag.until}까지` : '그대로'} 열려 있지만, 이 기기에서는 더 고치거나 다시 배포하거나 내릴 수 없어요.</p>
            <p class="small">계속 관리하려면 먼저 열쇠까지 담아 파일로 저장해 두세요. 남에게 주지 않을 파일이에요.</p>
          </>
          : <p>이 브라우저에 있는 교재·그림·고친 내용이 지워져요. 필요하면 먼저 파일로 저장해 두세요.</p>}
        <div class="btn-row">
          {live && <button class="btn" onClick={async () => { saveFile(safeName(del.title) + '.lecpage', await exportProjectFile(del, { withKeys: true }), 'application/zip'); toast('열쇠까지 담아 저장했어요. 남에게 주지 마세요.'); }}>열쇠까지 파일로 저장</button>}
          <button class="btn btn-danger" onClick={async () => { await deleteProject(del.id); setDel(null); toast('지웠어요.'); reload(); }}>지우기</button><button class="btn btn-quiet" data-autofocus onClick={() => setDel(null)}>닫기</button>
        </div>
      </Dialog>
    </section>
  );
}
