# lecpage 실시간 서버 + 정적 사이트 (의존성 없음, Node 22.5+ 내장 node:sqlite)
# 기준: skills/lecpage/templates/deploy/server/Dockerfile.node-server
#
#   docker build -t lec-live .
#   docker run -p 127.0.0.1:8787:8787 -v lec-data:/data -v "$PWD/site:/site:ro" -e LEC_STATIC=/site lec-live
#   → LEC_ADMIN_KEY_HASH 를 주지 않으면 첫 실행 때 관리자 키를 만들어 /data/admin-key.txt 에 둡니다(로그에는 안 남김).
#     보기: docker run --rm -v lec-data:/data alpine cat /data/admin-key.txt
#
# 환경 변수 전체 목록은 server.mjs 머리말을 보세요(LEC_DATA, LEC_STATIC, LEC_ORIGINS, LEC_ADMIN_KEY_HASH, LEC_TRUSTED_PROXIES …).
FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs ./
COPY lib ./lib
ENV PORT=8787 \
    LEC_HOST=0.0.0.0 \
    LEC_DATA=/data \
    TZ=Asia/Seoul \
    NODE_ENV=production
# root가 아닌 node 사용자(uid 1000)로 실행합니다. /data 는 이미지 안에서 node 소유로 만들어 두므로
# 이름 있는 볼륨(-v lec-data:/data)은 따로 할 일이 없습니다. 호스트 폴더를 붙일 때는 그 폴더를 uid 1000 소유로 해 주세요.
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -qO- http://127.0.0.1:8787/api/health >/dev/null || exit 1
CMD ["node", "--experimental-sqlite", "--disable-warning=ExperimentalWarning", "server.mjs"]
