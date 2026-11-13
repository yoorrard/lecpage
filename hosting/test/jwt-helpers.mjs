// 시험용 가짜 Cloudflare Access: RSA 열쇠를 만들어 JWT에 서명하고, 공개 열쇠 목록(JWKS)을 내줌
import { webcrypto, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';

const b64u = (buf) => Buffer.from(buf).toString('base64url');

export async function makeIssuer() {
  const pair = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const kid = randomBytes(8).toString('hex');
  const pub = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
  const jwks = { keys: [{ kty: 'RSA', kid, alg: 'RS256', use: 'sig', n: pub.n, e: pub.e }], public_cert: { kid, cert: '' } };
  /** 클레임에 서명. undefined 값은 빼고 넣음 */
  async function sign(claims, { kid: k = kid, alg = 'RS256' } = {}) {
    const head = b64u(JSON.stringify({ alg, kid: k, typ: 'JWT' }));
    const clean = Object.fromEntries(Object.entries(claims).filter(([, v]) => v !== undefined));
    const body = b64u(JSON.stringify(clean));
    const sig = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
    return `${head}.${body}.${b64u(sig)}`;
  }
  return { kid, jwks, sign };
}

/** http://127.0.0.1:<포트>/cdn-cgi/access/certs 를 내주는 작은 서버(통합 시험·화면 찍기용) */
export async function startJwks(issuer) {
  const server = createServer((req, res) => {
    if (req.url === '/cdn-cgi/access/certs') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(issuer.jwks)); return; }
    res.writeHead(404); res.end();
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const team = `http://127.0.0.1:${server.address().port}`;
  return { team, stop: () => new Promise((r) => server.close(r)) };
}
