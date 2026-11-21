// Playwright 찾기: 프로젝트에 설치된 것 → 전역 NODE_PATH(없으면 /opt/node22/lib/node_modules). 둘 다 없으면 한 줄 알리고 건너뜁니다.
function load() {
  const paths = [...(process.env.NODE_PATH || '').split(':'), '/opt/node22/lib/node_modules'].filter(Boolean);
  try { return require('playwright'); } catch {}
  try { return require(require.resolve('playwright', { paths })); } catch {}
  return null;
}
const pw = load();
if (!pw) { console.log('SKIP: playwright를 찾을 수 없어 e2e를 건너뜁니다.'); process.exit(0); }
module.exports = pw;
