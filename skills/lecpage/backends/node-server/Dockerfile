# lecpage 실시간 서버 + 정적 사이트 (의존성 없음, Node 22.5+ 내장 node:sqlite)
# 기준: skills/lecpage/templates/deploy/server/Dockerfile.node-server
#
#   docker build -t lec-live .
#   docker run -p 8787:8787 -v "$PWD/data:/data" -v "$PWD/site:/site:ro" -e LEC_STATIC=/site lec-live
#   → LEC_ADMIN_KEY_HASH 를 주지 않으면 첫 실행 로그에 관리자 키가 한 번 나옵니다.
#
# 환경 변수 전체 목록은 server.mjs 머리말을 보세요(LEC_DATA, LEC_STATIC, LEC_ORIGINS, LEC_ADMIN_KEY_HASH, LEC_TRUST_PROXY …).
FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY lib ./lib
ENV PORT=8787 \
    LEC_HOST=0.0.0.0 \
    LEC_DATA=/data \
    TZ=Asia/Seoul \
    NODE_ENV=production
# 클라우드 볼륨은 root 소유로 붙는 경우가 많아 root로 실행합니다. compose 예시는 권한을 모두 내려놓고 읽기 전용으로 띄웁니다.
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null || exit 1
CMD ["node", "--experimental-sqlite", "--disable-warning=ExperimentalWarning", "server.mjs"]
