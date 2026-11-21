// 세 회사 어댑터를 한 꼴로: stream({ key, model, system, parts, maxTokens, signal, onText, onEvent, … }) → { text, stop, usage, resumeToken? }
// parts: [{ kind: 'pdf'|'doc'|'image'|'text', mime, name, data, text, cache }]
import * as anthropic from './anthropic.js';
import * as openai from './openai.js';
import * as demo from './demo.js';
import * as chatgpt from './chatgpt.js';
import { AiError } from './common.js';

const MODS = { anthropic, openai };
/** demo: 먼저 해보기(레퍼런스에서 떼어 낸 답을 흘려보냄, 어디로도 보내지 않음) */
export function adapter(provider) {
  const m = provider === 'demo' ? demo : provider === 'chatgpt' ? chatgpt : MODS[provider]; // chatgpt: ChatGPT 계정(PC 프로그램 중계)
  if (!m) throw new AiError('model', `이 길로는 아직 만들 수 없어요(${provider}).`, { provider });
  return m;
}
export const GEN_PROVIDERS = Object.keys(MODS);

/**
 * 교재를 건넬 때의 한도(바이트·쪽·장). 문서끼리 다른 숫자는 작은 쪽으로(근거: ai-first-2026-11.md §1.2~1.4).
 * pdfBytes: 원본 PDF 하나, totalBytes: 한 요청에 넣는 파일·그림 합계(base64 전), images: 그림 장수
 */
export const LIMITS = {
  // Claude는 요청 128MB·600쪽이지만 쪽마다 글+그림 토큰이 들어가 빽빽한 교재는 문맥이 먼저 참 → 1M 문맥 300쪽, 그 밖 60쪽에서 쪽 그림으로 바꿈
  anthropic: { pdfBytes: 90e6, totalBytes: 90e6, pdfPages: 300, smallPdfPages: 60, images: 100, office: false },
  openai: { pdfBytes: 48e6, totalBytes: 48e6, pdfPages: 1000, smallPdfPages: 1000, images: 200, office: false },
  chatgpt: { pdfBytes: 48e6, totalBytes: 48e6, pdfPages: 1000, smallPdfPages: 1000, images: 200, office: false }, // 같은 Responses API(파일 업로드 API만 안 됨, 본문에 넣는 파일은 됨)
};
/** 문맥 1M 모델이면 Claude PDF 300쪽, 아니면 60쪽(넘으면 쪽 그림으로) */
export function pdfPageLimit(provider, model = '') {
  const L = LIMITS[provider]; if (!L) return 100;
  if (provider !== 'anthropic') return L.pdfPages;
  return /claude-(opus|sonnet|fable|haiku)-(4-[6-9]|5)/.test(model) ? L.pdfPages : L.smallPdfPages;
}
