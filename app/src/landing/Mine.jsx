import { useEffect, useState } from 'preact/hooks';
import { stageOf, duplicateProject, deleteProject } from '../lib/project.js';
import { Dialog } from '../components/ui.jsx';
import { copy, fmtDate, toast } from '../lib/util.js';

// 첫 화면의 '내 연수' 목록. 만든 연수가 있을 때만 받아요(처음 오는 사람의 첫 화면을 가볍게).
const STAGE = ['', '교재 넣기', '살펴보고 고치기', '공개하기'];

/**
 * 공개한 연수 카드의 연수 당일 바로 가기: 발표 화면·강사 화면(참여 기능이 있을 때)·주소와 QR.
 * 강사 화면을 누르면 이 기기에 기억한 관리자 키를 먼저 복사해 둠(새 탭이 열리기 전에, 붙여 넣기만 하게)
 */
function DayLinks({ p, adminKey }) {
  const url = String(p.deploy.lastUrl).replace(/\/?$/, '/');
  const live = (p.blueprint?.live?.features || []).length > 0;
  return (
    <div class="proj-day" role="group" aria-label={`${p.title || '연수'} 연수 당일`}>
      <a class="btn btn-sm" href={url + 'screen.html'} target="_blank" rel="noopener">발표 화면</a>
      {live && <a class="btn btn-sm" href={url + 'console.html'} target="_blank" rel="noopener" onClick={() => adminKey && copy(adminKey, '관리자 키를 복사했어요. 강사 화면에 붙여 넣으세요.')}>강사 화면</a>}
      <a class="btn btn-sm btn-quiet" href={`#/p/${p.id}/3`}>주소·QR</a>
    </div>
  );
}

/** list: 연수 목록, once·busyProps: 두 번 눌러도 한 번만(Home), reload: 목록 다시 읽기. 지우기 확인 창도 여기(첫 화면 코드를 가볍게) */
export function Mine({ list, once, busyProps, reload }) {
  const [del, setDel] = useState(null);
  // 공개한 연수의 강사 화면 관리자 키(바로 공개는 연수에, 내 서버·시트는 이 기기의 키 보관함에). 보관함 모듈은 필요할 때만 받음
  const [keys, setKeys] = useState({});
  useEffect(() => {
    const pub = list.filter((p) => p.deploy?.lastUrl && (p.blueprint?.live?.features || []).length);
    if (!pub.length) return;
    const now = Object.fromEntries(pub.filter((p) => p.deploy.lecpage?.adminKey).map((p) => [p.id, p.deploy.lecpage.adminKey]));
    setKeys(now);
    const rest = pub.filter((p) => !now[p.id] && p.blueprint.live?.url);
    if (rest.length) import('../lib/ai.js').then((m) => Promise.all(rest.map((p) => m.loadKey('live-admin:' + String(p.blueprint.live.url).replace(/\/+$/, '')).then((r) => [p.id, r.key])))).then((kv) => setKeys((k) => ({ ...k, ...Object.fromEntries(kv.filter((x) => x[1])) })), () => { });
  }, [list]);
  return (
    <section class="ld-mine" aria-labelledby="ld-mine-h">
      <div class="section-title"><h2 id="ld-mine-h">내 연수</h2><p class="muted">이 브라우저에 저장돼 있어요. 눌러서 이어서 만들어요.</p></div>
      <div class="grid grid-3">
        {list.map((p) => {
          const st = p.stage || stageOf(p.step || 1);
          return (
            <div class="proj">
              <a class="proj-link" href={`#/p/${p.id}/${st}`}><h3>{p.title || '이름 없는 연수'}</h3></a>
              <div class="meta"><span class="tag tag-lav">{STAGE[st]}</span>{p.deploy?.lastUrl && <span class="tag tag-mint">공유 중</span>}<span>{fmtDate(p.updatedAt)}</span></div>
              {p.deploy?.lastUrl && <DayLinks p={p} adminKey={keys[p.id]} />}
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
        <p>이 브라우저에 있는 교재·그림·고친 내용이 지워져요. 이미 올린 사이트는 그대로예요. 필요하면 먼저 파일로 저장해 두세요.</p>
        <div class="btn-row"><button class="btn btn-danger" onClick={async () => { await deleteProject(del.id); setDel(null); toast('지웠어요.'); reload(); }}>지우기</button><button class="btn btn-quiet" data-autofocus onClick={() => setDel(null)}>닫기</button></div>
      </Dialog>
    </section>
  );
}
