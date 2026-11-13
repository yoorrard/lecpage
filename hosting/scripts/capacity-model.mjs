#!/usr/bin/env node
// 수용량·비용 표를 만듭니다(docs/research/scale-2026-11.md에 붙임). 값은 src/capacity.js의 모형(공식 한도·요금 × 측정한 단위 비용).
//   node scripts/capacity-model.mjs                 기본 가정(강사 한 명 한 달 연수 2회, 바로 배포 70%, 참가자 40명, 참여 기능 50%, 그중 학교망 40%)
//   node scripts/capacity-model.mjs --json          같은 값을 JSON으로
//   node scripts/capacity-model.mjs perUser=4 people=100 liveShare=1   가정 바꾸기
import { scenario, freeMaxUsers, trainingCost, costOf } from '../src/capacity.js';

const args = process.argv.slice(2);
const base = {};
for (const a of args) { const m = /^(\w+)=(.+)$/.exec(a); if (m) base[m[1]] = m[2] === 'true' ? true : m[2] === 'false' ? false : Number(m[2]); }
const USERS = [1000, 10000, 100000];
const NAMES = { workerReq: 'Worker 요청', doReq: 'DO 요청', doGbs: 'DO duration', rows: 'DO 행 쓰기', storage: '저장(5GB)', pagesApi: 'Pages API(5분)' };
const fmt = (n) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}백만` : Math.abs(n) >= 1e4 ? `${(n / 1e4).toFixed(n >= 1e5 ? 0 : 1)}만` : Math.round(n).toLocaleString('en-US'));
const usd = (n) => `$${n.toFixed(n >= 100 ? 0 : 2)}`;

// 2026-11-13 학교망 대비 뒤 런타임은 긴 대기(?wait=20, 측정 1분 3.4요청)가 기본. 서버는 무료면 방 안에서, 유료면 Worker가 대신 기다림(POLL_RELAY auto)
const variants = [
  ['지금 런타임(긴 대기), 무료 기본: 방 안에서 기다림', { longPoll: true }],
  ['지금 런타임(긴 대기), 유료 기본: Worker가 대신 기다림', { longPoll: true, relay: true }],
  ['예전 런타임(묻기 5초)', {}],
  ['참여 기능은 강사 계정으로(사이트만)', { liveShare: 0 }],
];
const out = { assumptions: { perUser: 2, instantShare: 0.7, people: 40, liveShare: 0.5, schoolShare: 0.4, minutes: 120, peakFactor: 2, workdays: 20, siteDays: 60, republishes: 1, ...base }, rows: [] };

if (args.includes('--json')) {
  for (const [name, v] of variants) for (const users of USERS) out.rows.push({ variant: name, users, ...scenario({ ...base, ...v, users }) });
  out.freeMax = Object.fromEntries(variants.map(([name, v]) => [name, freeMaxUsers({ ...base, ...v })]));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const a = out.assumptions;
console.log(`가정: 강사 한 명이 한 달에 연수 ${a.perUser}회, 그중 바로 배포 ${a.instantShare * 100}%, 참가자 ${a.people}명, ${a.minutes}분, 참여 기능 ${a.liveShare * 100}%, 그중 학교망(실시간 연결 막힘) ${a.schoolShare * 100}%, 가장 바쁜 날 = 평일 평균 × ${a.peakFactor}, 사이트 보관 ${a.siteDays}일, 다시 배포 ${a.republishes}번\n`);

console.log('### 연수 한 번이 드는 몫(Pages 보기)\n');
console.log('| 연수 | Worker 요청 | DO 요청 | DO duration(GB-s) | DO 행 쓰기 | Pages API | 유료면(넘는 몫) |');
console.log('|---|---|---|---|---|---|---|');
const kinds = [
  ['참여 기능 없음', { live: false }],
  ['참여 기능, 실시간 연결 됨(20%는 긴 대기, 방 안)', { live: true, network: 'good', longPoll: true }],
  ['참여 기능, 실시간 연결 됨(20%는 긴 대기, Worker가 대신)', { live: true, network: 'good', longPoll: true, relay: true }],
  ['학교망(모두 긴 대기, 방 안)', { live: true, network: 'restricted', longPoll: true }],
  ['학교망(모두 긴 대기, Worker가 대신)', { live: true, network: 'restricted', longPoll: true, relay: true }],
  ['학교망(예전 런타임 묻기 5초)', { live: true, network: 'restricted' }],
];
for (const [name, o] of kinds) {
  const c = trainingCost({ people: a.people, minutes: a.minutes, republishes: a.republishes, ...o });
  const marginal = (c.workerReq * 0.30 + c.doReq * 0.15 + c.doGbs * 12.5 + c.rows * 1.0 + c.workerReq * 0.02) / 1e6;
  console.log(`| ${name} | ${fmt(c.workerReq)} | ${fmt(c.doReq)} | ${Math.round(c.doGbs)} | ${fmt(c.rows)} | ${c.pagesApi} | ${marginal < 0.01 ? `${(marginal * 100).toFixed(2)}센트` : usd(marginal)} |`);
}

for (const [vname, v] of variants) {
  console.log(`\n### ${vname}: 사용자 수별(가장 바쁜 날, 무료 하루 한도 대비 %)\n`);
  console.log(`| 월 활성 강사 | 연수/월(바쁜 날) | ${Object.values(NAMES).join(' | ')} | 먼저 차는 것 | 무료로 | Workers Paid 월 |`);
  console.log(`|---|---|${Object.keys(NAMES).map(() => '---').join('|')}|---|---|---|`);
  for (const users of USERS) {
    const s = scenario({ ...base, ...v, users });
    const freeOk = Object.values(s.free).every((p) => p <= 60) ? '됨' : Object.values(s.free).every((p) => p <= 100) ? '빠듯(60% 넘음)' : '안 됨';
    console.log(`| ${users.toLocaleString('en-US')} | ${fmt(s.trainings)}(${fmt(s.peakTrainings)}) | ${Object.keys(NAMES).map((k) => `${s.free[k]}%`).join(' | ')} | ${NAMES[s.first.resource]} | ${freeOk} | ${usd(s.paid.total)} |`);
  }
  console.log(`\n무료로 버티는 가장 큰 사용자 수(모든 한도 60% 아래): **${freeMaxUsers({ ...base, ...v }).toLocaleString('en-US')}명**`);
}

console.log('\n### 비용 곡선(지금 가정, Workers Paid 월 비용)\n');
console.log('| 월 활성 강사 | 긴 대기, 방 안에서 | 긴 대기, Worker가 대신(유료 기본) | 예전 런타임(묻기 5초) | 사이트만(참여 기능은 강사 계정) |');
console.log('|---|---|---|---|---|');
for (const users of [500, 1000, 3000, 10000, 30000, 100000]) {
  const cells = variants.map(([, v]) => usd(scenario({ ...base, ...v, users }).paid.total));
  console.log(`| ${users.toLocaleString('en-US')} | ${cells.join(' | ')} |`);
}
const big = scenario({ ...base, longPoll: true, relay: true, users: 100000 });
console.log(`\n10만 명(유료 기본) 항목별: ${Object.entries(big.paid.items).map(([k, v]) => `${k} ${usd(v)}`).join(' · ')} → ${usd(costOf(big.month).total)}`);
