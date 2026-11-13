// JSON 응답·오류·CORS. 오류 모양은 언제나 { error: { code, message_ko } }

export const ERRORS = {
  bad_request: [400, '요청 형식이 맞지 않아요.'],
  unauthorized: [401, '이 사이트를 고칠 열쇠가 맞지 않아요.'],
  not_found: [404, '사이트를 찾지 못했어요. 보관 기간이 끝났을 수 있어요.'],
  too_large: [413, '파일이 너무 커요.'],
  too_many_files: [413, '파일이 너무 많아요.'],
  bad_path: [400, '올릴 수 없는 파일 이름이 있어요.'],
  bad_type: [415, '올릴 수 없는 파일 형식이 있어요.'],
  runtime_mismatch: [422, '사이트의 실행 파일이 이 서버가 아는 lecpage 버전과 달라요.'],
  rate_limited: [429, '잠시 뒤에 다시 해 주세요. 같은 인터넷 주소에서 너무 많이 올렸어요.'],
  full: [507, '바로 배포 저장 공간이 가득 찼어요. 다른 배포 방법을 써 주세요.'],
  blocked: [403, '신고가 들어와 가려 둔 사이트예요.'],
  missing_blobs: [409, '아직 올라오지 않은 파일이 있어요.'],
  code_taken: [409, '이 연수 코드는 다른 사이트가 쓰고 있어요. 다른 코드로 해 주세요.'],
};

export class HttpError extends Error {
  /** @param {keyof typeof ERRORS} code @param {string} [message_ko] @param {object} [extra] { status, headers, ...error에 덧붙일 값 } */
  constructor(code, message_ko, extra = {}) {
    const [status, fallback] = ERRORS[code] || ERRORS.bad_request;
    super(message_ko || fallback);
    const { status: s, headers, ...rest } = extra;
    this.code = code; this.status = s || status; this.headers = headers || {}; this.extra = rest;
  }
  toResponse() {
    return json({ error: { code: this.code, message_ko: this.message, ...this.extra } }, this.status, this.headers);
  }
}

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  });
}
export const noContent = () => new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });

/** Durable Object가 돌려준 오류 응답을 그대로 HttpError로(Worker ↔ DO 사이) */
export async function errorFrom(res) {
  let j = {};
  try { j = await res.json(); } catch { /* 본문 없음 */ }
  const { code = 'bad_request', message_ko, ...extra } = j.error || {};
  const headers = {};
  if (res.headers.get('retry-after')) headers['retry-after'] = res.headers.get('retry-after');
  return new HttpError(Object.hasOwn(ERRORS, code) ? code : 'bad_request', message_ko, { status: res.status, headers, ...extra });
}

/** 본문을 max바이트까지만 읽어 JSON 객체로. 넘치거나 JSON 객체가 아니면 HttpError. optional이면 빈 본문은 {} */
export async function readJson(request, max = 1024 * 1024, { optional = false } = {}) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > max) throw new HttpError('too_large', '요청이 너무 커요.');
  const chunks = []; let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { try { await reader.cancel(); } catch { /* 이미 끊김 */ } throw new HttpError('too_large', '요청이 너무 커요.'); }
      chunks.push(value);
    }
  }
  if (!size && optional) return {};
  const all = new Uint8Array(size); let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  let v;
  try { v = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(all) || 'null'); } catch { throw new HttpError('bad_request', 'JSON으로 보내 주세요.'); }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new HttpError('bad_request');
  return v;
}

/** 허용한 출처면 CORS 머리글. 아니면 빈 객체(브라우저가 응답을 못 읽음) */
export function corsHeaders(origin, allowed) {
  const h = { vary: 'Origin' };
  if (origin && allowed.has(origin)) {
    h['access-control-allow-origin'] = origin;
    h['access-control-expose-headers'] = 'retry-after';
  }
  return h;
}
export function preflight(origin, allowed) {
  const h = corsHeaders(origin, allowed);
  if (h['access-control-allow-origin']) {
    h['access-control-allow-methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
    h['access-control-allow-headers'] = 'authorization,content-type';
    h['access-control-max-age'] = '86400';
  }
  return new Response(null, { status: 204, headers: h });
}
export function withHeaders(res, extra) {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  return out;
}
