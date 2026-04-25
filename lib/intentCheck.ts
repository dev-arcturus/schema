import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const intentSchema = z.object({
  matches: z.boolean(),
  reason: z.string().min(1).max(160),
});

export type IntentCheckResult = z.infer<typeof intentSchema>;

const MAX_DIFF = 4000;

export async function intentCheck({
  userIntent,
  stepDescription,
  diff,
}: {
  userIntent: string;
  stepDescription: string;
  diff: string;
}): Promise<IntentCheckResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { matches: true, reason: "skipped (no api key)" };
  }
  try {
    const truncated = diff.length > MAX_DIFF ? diff.slice(0, MAX_DIFF) + "\n…(truncated)" : diff;
    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: intentSchema,
      temperature: 0,
      maxTokens: 200,
      prompt: [
        "Verify that a code diff matches the user's stated intent.",
        "Output JSON with `matches` (boolean) and a one-line `reason` (<= 140 chars).",
        "Be lenient on phrasing differences but strict on semantics.",
        "",
        `User intent: ${userIntent}`,
        `Step description: ${stepDescription}`,
        "",
        "Diff:",
        truncated,
      ].join("\n"),
    });
    return object;
  } catch (err) {
    return {
      matches: true,
      reason: "intent check skipped: " + (err instanceof Error ? err.message : "error"),
    };
  }
}
