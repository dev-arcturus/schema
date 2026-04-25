import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

const MAX_LEN = 80;

export async function explainFailure(
  error: string,
  testOutput: string | undefined,
): Promise<string> {
  const fallback = condense(error);
  if (!process.env.ANTHROPIC_API_KEY) return fallback;
  try {
    const { text } = await generateText({
      model: anthropic("claude-haiku-4-5-20251001"),
      temperature: 0,
      maxTokens: 60,
      prompt: [
        "You are summarizing a failed test run for a developer.",
        "Output ONE short sentence (max 80 chars) explaining what broke.",
        "No preamble, no quotes, no markdown.",
        "",
        "Error: " + error,
        testOutput ? "\nTest output (tail):\n" + tail(testOutput, 1500) : "",
      ].join("\n"),
    });
    return condense(text);
  } catch {
    return fallback;
  }
}

function condense(s: string): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length > MAX_LEN ? oneLine.slice(0, MAX_LEN - 1) + "…" : oneLine;
}

function tail(s: string, n: number): string {
  return s.length > n ? s.slice(-n) : s;
}
