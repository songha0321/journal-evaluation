import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const exec = promisify(execFile);

/**
 * remote D1 접근. wrangler를 거치므로 API 토큰을 따로 두지 않는다
 * (ETL 스크립트들과 같은 인증 경로를 쓴다).
 *
 * 읽기와 쓰기가 서로 다른 경로를 쓴다 — 이유가 있다.
 *   query() → --command : --file 모드는 결과 행을 돌려주지 않고 실행 통계
 *                         ("Total queries executed" 등)만 반환한다. SELECT는 반드시 --command.
 *   exec()  → --file    : 대량 INSERT는 argv 길이 제한(ARG_MAX)에 걸리므로 파일로 넘긴다.
 *
 * execFile은 셸을 거치지 않고 argv를 그대로 전달하므로, --command에 한국어·따옴표가
 * 섞여도 인용이 깨지지 않는다.
 */

const MAX_BUFFER = 64 * 1024 * 1024;

/** SQL 문자열 리터럴. NULL은 그대로 NULL로 쓴다. */
export function q(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** wrangler는 JSON 앞에 배너를 섞어 출력한다. 첫 '[' 부터 파싱한다. */
function parseWranglerJson(stdout) {
  const start = stdout.indexOf("[");
  if (start < 0) throw new Error(`wrangler 응답을 해석할 수 없습니다:\n${stdout.slice(0, 400)}`);
  return JSON.parse(stdout.slice(start));
}

async function runWrangler(argsTail, cwd) {
  const { stdout } = await exec("npx", ["wrangler", "d1", "execute", "DB", "--remote", "--json", ...argsTail], {
    cwd,
    maxBuffer: MAX_BUFFER,
  });
  return parseWranglerJson(stdout);
}

export function makeD1(cwd) {
  return {
    /** SELECT. 결과 행이 필요하므로 --command 경로를 쓴다. */
    async query(sql) {
      const out = await runWrangler(["--command", sql], cwd);
      return out[out.length - 1]?.results ?? [];
    },

    /** INSERT/UPDATE/DDL. 길이 제한이 없도록 임시 파일로 넘긴다. */
    async exec(sql) {
      const dir = await mkdtemp(join(tmpdir(), "ax-runner-"));
      const file = join(dir, "q.sql");
      await writeFile(file, sql, "utf8");
      try {
        await runWrangler(["--file", file], cwd);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },

    q,
  };
}
