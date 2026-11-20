// 그리기 전에 '글자 크게'를 적용(이 기기에서 켜 둔 경우)
try { if (window.localStorage.getItem('nuribom-big') === '1') document.documentElement.classList.add('is-big'); } catch (e) { /* 저장소가 막히면 보통 크기 */ }
