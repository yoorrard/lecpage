// 연수 주제·분위기 추론: 제목·부제·교재 글에서 키워드를 세어 주제(topic)와 기본 분위기(mood)를 고릅니다.
const TOPIC_RULES = [
  ['sel', /사회정서|SEL\b|마음|감정|관계|회복탄력|공감|정서/gi],
  ['counseling', /상담|위기|트라우마|심리|정신건강|웰빙|마음챙김/gi],
  ['ai', /\bAI\b|인공지능|생성형|챗GPT|ChatGPT|Gemini|제미나이|Claude|클로드|프롬프트|LLM|노트북LM|NotebookLM/gi],
  ['edutech', /에듀테크|디지털|태블릿|크롬북|구글 ?클래스룸|패들렛|Padlet|캔바|Canva|디지털교과서|AIDT|하이러닝/gi],
  ['coding', /코딩|프로그래밍|엔트리|스크래치|파이썬|Python|알고리즘|앱 ?인벤터|바이브 ?코딩/gi],
  ['maker', /메이커|피지컬|아두이노|마이크로비트|3D ?프린|로봇/gi],
  ['science', /과학|실험|탐구|천문|생명|물리|화학/gi],
  ['math', /수학|연산|도형|함수|통계|분수/gi],
  ['reading', /독서|책|문해력|그림책|읽기|글쓰기|도서관/gi],
  ['korean', /국어|문법|한글|맞춤법/gi],
  ['art', /미술|예술|디자인|그리기|드로잉|공예/gi],
  ['music', /음악|노래|작곡|합창|악기/gi],
  ['pe', /체육|스포츠|놀이|운동|신체활동/gi],
  ['english', /영어|English|원어민/gi],
  ['history', /역사|한국사|세계사|문화유산/gi],
  ['environment', /환경|생태|기후|탄소|지속가능|ESG/gi],
  ['career', /진로|직업|꿈|미래 ?역량/gi],
  ['safety', /안전|재난|응급|보건|감염/gi],
  ['policy', /교육과정|정책|설명회|고시|지침|개정/gi],
  ['admin', /업무|행정|나이스|NEIS|에듀파인|공문|학교 ?회계|업무 ?경감/gi],
  ['parent', /학부모|가정|보호자|부모/gi],
  ['elementary', /초등|저학년|고학년|1학년|2학년/gi],
  ['data', /데이터|스프레드시트|대시보드|차트|시각화|학습 ?분석|통계 ?자료/gi],
  ['conference', /컨퍼런스|콘퍼런스|포럼|심포지엄|한마당|박람회|발표회|성과 ?나눔/gi],
];

const TOPIC_MOOD = {
  sel: ['warm', 'emotional', 'calm'], counseling: ['calm', 'warm'], ai: ['tech', 'futuristic'], edutech: ['tech', 'playful'],
  coding: ['tech', 'minimal'], maker: ['tech', 'handmade'], science: ['tech', 'natural'], math: ['playful', 'bold'],
  reading: ['editorial', 'calm'], korean: ['editorial'], art: ['handmade', 'retro', 'playful'], music: ['energetic', 'retro'],
  pe: ['energetic', 'playful'], english: ['playful'], history: ['editorial', 'calm'], environment: ['natural', 'calm'],
  career: ['warm', 'futuristic'], safety: ['formal'], policy: ['formal', 'minimal'], admin: ['formal', 'minimal'],
  parent: ['warm', 'calm'], elementary: ['playful', 'warm'], data: ['tech', 'minimal'], conference: ['futuristic', 'bold'],
};

export function detectTopics(text, max = 3) {
  const t = String(text || '');
  const scores = [];
  for (const [id, re] of TOPIC_RULES) {
    const n = (t.match(re) || []).length;
    if (n) scores.push([id, n]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  return scores.slice(0, max).map(([id]) => id);
}

export function moodsForTopics(topics) {
  const out = [];
  for (const t of topics) for (const m of TOPIC_MOOD[t] || []) if (!out.includes(m)) out.push(m);
  return out.length ? out : ['warm', 'minimal'];
}

// 사용자가 고른 분위기 낱말(한국어) → 내부 mood 값
const MOOD_WORDS = [
  [/차분|잔잔|고요|편안/, 'calm'], [/따뜻|포근|다정/, 'warm'], [/감성|감동|울림/, 'emotional'], [/경쾌|발랄|귀여|재미|즐거/, 'playful'],
  [/역동|활기|신나|에너지/, 'energetic'], [/테크|기술|디지털/, 'tech'], [/미래|SF|우주/, 'futuristic'], [/잡지|에디토리얼|매거진|글 ?중심/, 'editorial'],
  [/공식|단정|정중|격식|신뢰/, 'formal'], [/자연|숲|초록|생태/, 'natural'], [/레트로|복고|Y2K/, 'retro'], [/미니멀|깔끔|심플|단순/, 'minimal'],
  [/강렬|대담|과감|임팩트/, 'bold'], [/손그림|수작업|아날로그|종이/, 'handmade'],
];
export function moodFromWords(words) {
  const out = [];
  for (const w of [].concat(words || [])) for (const [re, m] of MOOD_WORDS) if (re.test(w) && !out.includes(m)) out.push(m);
  return out;
}
