import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * 생성형 AI 호출 (탈고 · comment · 소제목). OpenAI Chat Completions 호환.
 * Worker secret `OPENAI_API_KEY`가 있으면 라이브 호출, 없으면 규칙 기반 폴백을 반환한다.
 * 키/모델은 env로 주입: OPENAI_API_KEY, (선택) OPENAI_MODEL, OPENAI_BASE_URL.
 */
async function getEnv(): Promise<Record<string, string | undefined>> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env as unknown as Record<string, string | undefined>;
  } catch {
    return process.env as Record<string, string | undefined>;
  }
}

export async function aiEnabled(): Promise<boolean> {
  const env = await getEnv();
  return Boolean(env.OPENAI_API_KEY);
}

async function chat(system: string, user: string, maxTokens = 700): Promise<string | null> {
  const env = await getEnv();
  const key = env.OPENAI_API_KEY;
  if (!key) return null;
  const base = env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content?.trim() ?? null;
}

const REVISE_SYS =
  "당신은 시대인재 <항해일지> 편집국의 탈고 에이전트다. REVISE.md 원칙에 따라 원문의 의미·경험·문체를 최대한 보존하면서 오탈자·띄어쓰기·문법·용어·흐름만 정리한다. 창의적 재작성 금지, 원문에 없는 사실 추가 금지. 결과는 탈고된 본문 텍스트만 출력한다.";

const COMMENT_SYS =
  "당신은 <항해일지> comment 큐레이터다. 수기를 읽고 2~3줄의 담담하고 차분한 격식체 안내문을 쓴다. '살펴봅시다·확인해봅시다·점검해봅시다·참고해봅시다' 계열 종결을 우선 쓰고, 과장·압박·원문에 없는 성과는 금지한다. comment 본문만 출력한다.";

const SUBTITLE_SYS =
  "당신은 <항해일지> 편집자다. 수기 핵심을 담은 소제목을 만든다. 반드시 25자 이내, 흥미를 끌되 과장하지 않는다. 소제목 텍스트만 한 줄로 출력한다.";

export async function reviseText(text: string): Promise<{ result: string; ai: boolean }> {
  const out = await chat(REVISE_SYS, text, 1400).catch(() => null);
  if (out) return { result: out, ai: true };
  // 폴백: 원문 보존 + 최소 정리(연속 공백/줄바꿈 정돈).
  const cleaned = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { result: cleaned, ai: false };
}

export async function makeComment(text: string, name: string, univ: string): Promise<{ result: string; ai: boolean }> {
  const out = await chat(COMMENT_SYS, `학생: ${name} (${univ})\n\n수기:\n${text.slice(0, 4000)}`).catch(() => null);
  if (out) return { result: out, ai: true };
  const uni = univ && univ !== "-" ? `${univ}에 진학한 ` : "";
  return {
    result: `${uni}${name} 학생의 수기입니다. 수험 생활의 고민과 그 해결 과정을 담담하게 풀어낸 이야기를 함께 살펴봅시다.`,
    ai: false,
  };
}

export async function makeSubtitle(text: string): Promise<{ result: string; ai: boolean }> {
  const out = await chat(SUBTITLE_SYS, text.slice(0, 3000), 60).catch(() => null);
  if (out) return { result: out.replace(/\n/g, " ").slice(0, 25), ai: true };
  const first = (text.split(/[.\n]/).find((s) => s.trim().length > 4) || "나의 항해 이야기").trim();
  return { result: first.slice(0, 25), ai: false };
}
