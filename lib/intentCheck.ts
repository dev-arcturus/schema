import crypto from "node:crypto";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";

const intentSchema = z.object({
  matches: z.boolean(),
  reason: z.string().min(1).max(160),
});

export type IntentCheckResult = z.infer<typeof intentSchema>;

const MAX_DIFF = 4000;

// In-memory cache for intent checks within a single dev-server session.
// Keyed by hash(intent + diff[:1500]). Avoids re-paying Haiku for identical
// step results during repeated demos.
const intentCache = new Map<string, IntentCheckResult>();
function intentKey(intent: string, diff: string): string {
  return crypto
    .createHash("sha256")
    .update(intent + "|" + diff.slice(0, 1500))
    .digest("hex")
    .slice(0, 16);
}

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
  const key = intentKey(userIntent, diff);
  const cached = intentCache.get(key);
  if (cached) return cached;
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
    intentCache.set(key, object);
    return object;
  } catch (err) {
    return {
      matches: true,
      reason: "intent check skipped: " + (err instanceof Error ? err.message : "error"),
    };
  }
}
