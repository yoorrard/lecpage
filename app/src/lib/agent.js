// AI 에이전트(Claude Code·Codex처럼 스스로 파일을 다루는 도구)에 lecpage 스킬을 넣는 명령. 한 곳에서 관리:
// 랜딩(landing/Paths.jsx)과 교재 넣기 화면 AI 카드의 '다른 방법'(pages/steps/Start.jsx)이 함께 씀.
// 도구별 자세한 설치는 도움말 'AI 에이전트에서 쓰기'(pages/Help.jsx)와 README의 표. 바꾸면 그 두 곳도 함께.
// 근거: Claude Code 플러그인 code.claude.com/docs/en/plugins/install · skills CLI github.com/vercel-labs/skills
export const SKILL_CMDS = [
  { for: 'Claude Code', where: '대화창에서', cmd: '/plugin install lecpage --marketplace yoorrard/lecpage' },
  { for: 'Codex·Cursor·Gemini CLI 등', where: '터미널에서', cmd: 'npx skills add yoorrard/lecpage' },
];
