#!/usr/bin/env node
// lecpage 교재 해석 CLI (Node ≥ 22)
//
//   node ingest.mjs <파일 또는 링크...> -o material.json [--images assets/media] [--slides assets/slides]
//                   [--draft blueprint.draft.json] [--context material.txt] [--max-chars 24000]
//
// PPTX·HWPX·DOCX·TXT·MD는 JS 엔진(engine/src/ingest)으로 읽습니다.
// PDF는 pdfjs-dist가 설치돼 있으면 JS로, 없으면 파이썬 보조 스크립트(scripts/ingest.py, PyMuPDF)로 읽습니다.
// 예전 .hwp/.ppt/.doc는 PDF·PPTX·HWPX로 다시 저장하라는 안내를 돌려줍니다.
import { runIngestCli } from '../engine/src/ingest/index.js';

const code = await runIngestCli(process.argv.slice(2)).catch((e) => {
  console.error(`교재 해석 중 알 수 없는 문제가 생겼어요: ${e && e.message ? e.message : e}`);
  return 1;
});
process.exitCode = code;
