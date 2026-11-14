// 런타임 파일 안에서 같은 이름의 함수(또는 같은 이름의 var와 함수)가 한 범위에 둘 있으면 뒤의 것이 앞을 덮어씀.
// 강사 화면에서 ms→초 함수 sec가 소제목 함수 sec에 덮여 '[object HTMLDivElement]마다 묻기'가 나온 일을 다시 막음.
// 방법: 함수 선언을 let으로 바꿔 컴파일만 해 봄(같은 범위의 let 둘·let과 var는 문법 오류). 실행하지 않음.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { here } from './live-helpers.mjs';

const RUNTIME = path.join(here, '../runtime');

/** 같은 범위에 이름이 겹치면 오류 글, 없으면 '' */
export function nameClash(src, filename = 'x.js') {
  const conv = src.replace(/(^|[;{}]\s*|\n\s*)function\s+([A-Za-z_$][\w$]*)\s*\(/g, (m, pre, name) => `${pre};let ${name} = function ${name}(`)
    // 선언이 식이 되었으니 '}' 다음 줄이 [ ( 로 시작하면 앞 식에 붙지 않게 끊음(원래 코드에서는 새 문장)
    .replace(/\}(\s*\n\s*)(?=[[(])/g, '};$1');
  try { new vm.Script(conv, { filename }); return ''; } catch (e) { return String(e.message); }
}

function runtimeFiles(dir = RUNTIME, out = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (f.name !== 'vendor') runtimeFiles(p, out); } else if (f.name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('검사가 겹친 이름을 찾음: 같은 범위의 함수 둘, var와 함수. 안쪽 범위·다른 범위는 괜찮음', () => {
  assert.match(nameClash('(function(){ function sec(ms){} function f(){} function sec(t){} })();'), /sec/);
  assert.match(nameClash('(function(){ var go = 1; function go(){} })();'), /go/);
  assert.equal(nameClash('(function(){ function a(){ function b(){} } function c(){ function b(){} } })();'), '');
  assert.equal(nameClash('(function(){ var x = function sec(){}; function sec2(){} })();'), '');
});

test('런타임 파일(강사·발표·참가자 화면, 참여 기능, 효과)에 한 범위 안 겹친 이름이 없음', () => {
  const files = runtimeFiles();
  assert.ok(files.length > 20 && files.some((f) => f.endsWith('console.js')));
  const bad = files.map((f) => [path.relative(RUNTIME, f), nameClash(fs.readFileSync(f, 'utf8'), f)]).filter(([, e]) => e);
  assert.deepEqual(bad, []);
});
