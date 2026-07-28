import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const exec = promisify(execFile);

/**
 * LLM 어댑터 — 지금은 비활성이 기본이다.
 *
 * 모델을 붙일 때 할 일은 환경변수 2개뿐이다.
 *   AX_LLM=claude            # 활성화
 *   AX_LLM_MODEL=sonnet      # 모델 (미지정 시 CLI 기본값)
 *
 * 비활성 상태에서는 call()이 null을 돌려주고, 호출부는 규칙 기반 폴백으로 진행한다.
 * 즉 모델이 없어도 선별 파이프라인·화면·큐는 전부 동작한다.
 *
 * CLI 호출 형태 (실측 검증됨):
 *   claude -p '<user>' --system-prompt '<system>' \
 *     --strict-mcp-config --mcp-config <빈 설정> \
 *     --model <model> --output-format json
 *
 * --strict-mcp-config로 MCP 서버를 떼지 않으면 도구 정의가 통째로 실려
 * 호출당 컨텍스트가 25k 토큰까지 불어난다. 반드시 유지할 것.
 */

export function llmMode() {
  return process.env.AX_LLM || "off";
}

export function isLlmEnabled() {
  return llmMode() !== "off";
}

export function llmLabel() {
  return isLlmEnabled() ? `${llmMode()}${process.env.AX_LLM_MODEL ? `/${process.env.AX_LLM_MODEL}` : ""}` : "off (규칙 기반)";
}

let emptyMcpPath = null;
async function ensureEmptyMcp() {
  if (emptyMcpPath) return emptyMcpPath;
  const dir = await mkdtemp(join(tmpdir(), "ax-mcp-"));
  emptyMcpPath = join(dir, "empty-mcp.json");
  await writeFile(emptyMcpPath, JSON.stringify({ mcpServers: {} }), "utf8");
  return emptyMcpPath;
}

/** 코드펜스·주변 텍스트를 관대하게 걷어내고 JSON을 꺼낸다. */
export function parseJsonLoose(raw) {
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : raw).trim();
  const start = body.search(/[[{]/);
  if (start < 0) return null;
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * JSON 응답을 요구하는 1회 호출. 비활성이면 null.
 * 실패해도 예외를 던지지 않고 null을 돌려준다 — 배치 하나가 실패해도 선별 전체가 멈추면 안 된다.
 */
export async function callJson(system, user, { timeoutMs = 180000 } = {}) {
  if (!isLlmEnabled()) return null;

  const mcp = await ensureEmptyMcp();
  const args = ["-p", user, "--system-prompt", system, "--strict-mcp-config", "--mcp-config", mcp, "--output-format", "json"];
  if (process.env.AX_LLM_MODEL) args.push("--model", process.env.AX_LLM_MODEL);

  try {
    const { stdout } = await exec("claude", args, { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 });
    const env = JSON.parse(stdout);
    if (env.is_error) return null;
    return parseJsonLoose(env.result);
  } catch (e) {
    process.stderr.write(`  ! LLM 호출 실패: ${e?.message ?? e}\n`);
    return null;
  }
}

export async function cleanupLlm() {
  if (emptyMcpPath) await rm(join(emptyMcpPath, ".."), { recursive: true, force: true }).catch(() => {});
}
