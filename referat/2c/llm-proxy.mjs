#!/usr/bin/env node
/**
 * VERSUCHSCODE (Referat 2C, Schritte 5.2/5.3) – kein Produktpfad.
 *
 * Aufzeichnender Loopback-Proxy zwischen Backend/Harness und der privaten
 * llama.cpp-Runtime. Grund: Der Produkt-Client wertet nur prompt/completion-
 * Tokens aus und verwirft `timings` (prompt_ms, predicted_ms). Der Proxy
 * leitet unverändert weiter und schreibt je POST /v1/chat/completions eine
 * JSONL-Zeile mit Zeitstempeln, Request-Body (Prompt, max_tokens, temperature)
 * und Response-Body (choices, usage, timings).
 *
 * Sicherheit: nur 127.0.0.1; der Authorization-Header wird weitergereicht,
 * aber nie protokolliert.
 *
 * Aufruf: node referat/2c/llm-proxy.mjs --listen 8081 --target 8080 --log <datei.jsonl>
 */
/* global process, Buffer */
import { appendFileSync } from 'node:fs';
import http from 'node:http';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const LISTEN = Number(arg('--listen', '8081'));
const TARGET = Number(arg('--target', '8080'));
const LOG = arg('--log', null);
if (!LOG) throw new Error('--log <datei.jsonl> fehlt');

let seq = 0;
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const startedAt = Date.now();
    const id = ++seq;
    const headers = { ...req.headers, host: `127.0.0.1:${TARGET}` };
    const upstream = http.request(
      { host: '127.0.0.1', port: TARGET, method: req.method, path: req.url, headers },
      (up) => {
        const out = [];
        up.on('data', (c) => out.push(c));
        up.on('end', () => {
          const responseBody = Buffer.concat(out);
          const endedAt = Date.now();
          res.writeHead(up.statusCode ?? 502, up.headers);
          res.end(responseBody);
          if (req.method === 'POST' && req.url?.startsWith('/v1/chat/completions')) {
            let request;
            let response;
            try {
              request = JSON.parse(body.toString('utf8'));
            } catch {
              request = { unparsable: true, bytes: body.length };
            }
            try {
              response = JSON.parse(responseBody.toString('utf8'));
            } catch {
              response = { unparsable: true, bytes: responseBody.length };
            }
            appendFileSync(
              LOG,
              `${JSON.stringify({ id, path: req.url, startedAt, endedAt, elapsedMs: endedAt - startedAt, status: up.statusCode, request, response })}\n`,
            );
          }
        });
      },
    );
    upstream.on('error', (error) => {
      res.writeHead(502);
      res.end();
      appendFileSync(
        LOG,
        `${JSON.stringify({ id, path: req.url, startedAt, endedAt: Date.now(), status: 'proxy-error', error: String(error.message) })}\n`,
      );
    });
    upstream.end(body);
  });
});
server.headersTimeout = 0;
server.requestTimeout = 0;
server.listen(LISTEN, '127.0.0.1', () => {
  process.stdout.write(`llm-proxy 127.0.0.1:${LISTEN} -> 127.0.0.1:${TARGET}, log ${LOG}\n`);
});
