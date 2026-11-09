import { StepHead, StepFoot } from '../Project.jsx';
import { Sheet, Field, Chips } from '../../components/ui.jsx';

const SIZE = [{ value: 25, label: '30명 이하' }, { value: 60, label: '31~100명' }, { value: 200, label: '101~300명' }, { value: 500, label: '300명 넘음' }];
const FORMAT = [{ value: 'lecture', label: '강의 중심' }, { value: 'practice', label: '실습 중심' }, { value: 'workshop', label: '강의+실습' }, { value: 'conference', label: '설명회·컨퍼런스' }, { value: 'course', label: '여러 차시 과정' }];
const FEATURES = [{ value: 'qa', label: '실시간 질문' }, { value: 'help', label: '막혔어요(도움 요청)' }, { value: 'progress', label: '실습 진행 현황' }, { value: 'board', label: '결과물 공유 보드' }, { value: 'poll', label: '투표·워드클라우드' }, { value: 'attendance', label: '출석·이수 확인' }, { value: 'signal', label: '신호등(이해 정도)' }, { value: 'reactions', label: '박수·반응' }];
const DEVICES = [{ value: 'laptop', label: '개인 노트북' }, { value: 'chromebook', label: '학교 크롬북' }, { value: 'tablet', label: '태블릿' }, { value: 'phone', label: '휴대폰' }];
const NETWORK = [{ value: 'good', label: '잘 됨' }, { value: 'slow', label: '느림' }, { value: 'restricted', label: '학교망(막힌 곳 있음)' }, { value: 'offline', label: '인터넷 없음' }];
const MOODS = ['차분하고 따뜻하게', '밝고 경쾌하게', '미래적·테크', '공식적·단정하게', '감성적·울림', '손그림·아날로그', '레트로·팝', '자연·숲', '글 중심·잡지처럼'];
const ADMIN = [{ value: 'school', label: '교내 자율연수' }, { value: 'official', label: '교육청 승인 직무연수' }, { value: 'conference', label: '컨퍼런스·설명회' }, { value: 'student', label: '학생 대상' }];

export function StepInfo({ p, update, go }) {
  const info = p.info;
  const set = (k) => (e) => update({ info: { ...p.info, [k]: e?.target ? e.target.value : e }, infoTouched: true });
  return (
    <>
      <StepHead title="연수 정보를 알려 주세요" desc={p.material ? '교재에서 찾은 내용을 미리 채웠어요. 맞는지 확인하고 빈칸만 채워 주세요.' : '아는 만큼만 채워도 돼요. 나머지는 나중에 고칠 수 있어요.'} />
      <Sheet>
        <div class="stack">
          <h2 style={{ fontSize: '1.3rem' }}>기본 정보</h2>
          <div class="form-grid">
            <Field label="연수명"><input value={info.title} onInput={set('title')} maxLength={160} placeholder="예: 수업에 바로 쓰는 AI" /></Field>
            <Field label="핵심 메시지(부제)"><input value={info.subtitle} onInput={set('subtitle')} maxLength={200} placeholder="이 연수가 약속하는 한 문장" /></Field>
            <Field label="주최·주관"><input value={info.organizer} onInput={set('organizer')} maxLength={120} /></Field>
            <Field label="날짜"><input type="date" value={info.date} onInput={set('date')} /></Field>
            <Field label="시작 시간"><input type="time" value={info.start} onInput={set('start')} /></Field>
            <Field label="끝 시간"><input type="time" value={info.end} onInput={set('end')} /></Field>
            <Field label="장소 또는 접속 링크"><input value={info.venue} onInput={set('venue')} maxLength={120} /></Field>
            <Field label="만족도 조사 주소" hint="구글 설문 등. 없으면 비워 두세요."><input type="url" value={info.surveyUrl} onInput={set('surveyUrl')} placeholder="https://" /></Field>
          </div>
          <h2 style={{ fontSize: '1.3rem', marginTop: '10px' }}>강사</h2>
          <div class="form-grid">
            <Field label="이름"><input value={info.instructorName} onInput={set('instructorName')} maxLength={40} /></Field>
            <Field label="소속·직함"><input value={info.instructorOrg} onInput={set('instructorOrg')} maxLength={80} /></Field>
            <Field label="이메일(공개할 때만)"><input type="email" value={info.instructorEmail} onInput={set('instructorEmail')} /></Field>
          </div>
          <Field label="강사 소개(선택)"><textarea value={info.instructorBio} onInput={set('instructorBio')} maxLength={600} rows={3} /></Field>
        </div>
      </Sheet>
      <Sheet fold={false}>
        <div class="stack">
          <h2 style={{ fontSize: '1.3rem' }}>참가자와 연수 모습</h2>
          <Q label="참가 인원은?"><Chips options={SIZE} value={info.size} onChange={set('size')} label="참가 인원" /></Q>
          <Q label="연수 형식은?"><Chips options={FORMAT} value={info.format} onChange={set('format')} label="연수 형식" /></Q>
          <Q label="꼭 필요한 참여 기능(여러 개)"><Chips options={FEATURES} value={info.features} onChange={set('features')} multiple label="참여 기능" /></Q>
          <Q label="참가자는 무엇으로 접속하나요?(여러 개)"><Chips options={DEVICES} value={info.devices} onChange={set('devices')} multiple label="접속 기기" /></Q>
          <Q label="연수 장소 인터넷은?"><Chips options={NETWORK} value={info.network} onChange={set('network')} label="인터넷" /></Q>
          <Q label="연수 성격"><Chips options={ADMIN} value={info.admin} onChange={(v) => update({ info: { ...p.info, admin: v, minor: v === 'student' ? true : p.info.minor } })} label="연수 성격" /></Q>
          <label class="check"><input type="checkbox" checked={info.minor} onChange={(e) => update({ info: { ...p.info, minor: e.target.checked } })} /><span>만 14세 미만 학생이 참여해요 <span class="small muted">(별명만 받고 사진 업로드를 조심하도록 바꿔요)</span></span></label>
          <label class="check"><input type="checkbox" checked={info.commercial} onChange={(e) => update({ info: { ...p.info, commercial: e.target.checked } })} /><span>강사료가 있는 연수예요 <span class="small muted">(상업 이용 제한이 있는 무료 호스팅을 피해요)</span></span></label>
        </div>
      </Sheet>
      <Sheet fold={false}>
        <div class="stack">
          <h2 style={{ fontSize: '1.3rem' }}>분위기</h2>
          <Q label="사이트 분위기(여러 개)"><Chips options={MOODS} value={info.mood} onChange={set('mood')} multiple label="분위기" /></Q>
          <Q label="움직임은 어느 정도?"><Chips options={[{ value: 1, label: '차분하게' }, { value: 2, label: '보통' }, { value: 3, label: '화려하게' }]} value={info.motion} onChange={set('motion')} label="움직임" /></Q>
          <div class="row"><Field label="기관 색(선택)"><input type="color" value={info.accent || '#5B49B0'} onInput={set('accent')} style={{ width: '64px', height: '44px', padding: '2px' }} /></Field>{info.accent && <button class="btn btn-sm btn-quiet" onClick={() => set('accent')('')}>기관 색 쓰지 않기</button>}</div>
        </div>
      </Sheet>
      <StepFoot go={go} prev={1} next={3} nextLabel="다음: AI로 설계" disabled={!info.title} />
    </>
  );
}
function Q({ label, children }) { return <div class="field"><span>{label}</span>{children}</div>; }
