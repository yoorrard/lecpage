// 만든 사이트에 들어갈 실행 파일(engine/runtime)을 문자열로 묶음. 미리보기·빌드할 때만 불러옵니다(첫 화면을 가볍게).
const RAW = import.meta.glob('../../../skills/lecpage/engine/runtime/**/*.{js,css}', { query: '?raw', import: 'default', eager: true });
const files = {};
for (const [k, v] of Object.entries(RAW)) files[k.replace(/^.*\/engine\/runtime\//, '')] = v;
export const runtime = { read: (p) => { if (!(p in files)) throw new Error('없음: ' + p); return files[p]; } };
