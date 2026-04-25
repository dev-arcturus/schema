import { z } from "zod";

const RISK = z.enum(["low", "medium", "high"]);

export const opStepSchema = z.object({
  kind: z.literal("op"),
  description: z
    .string()
    .min(4)
    .describe(
      "One sentence describing what this step does in plain English (e.g. 'apply requireAuth to GET /todos').",
    ),
  opName: z
    .enum([
      "addMiddleware",
      "addCaching",
      "wrapTransformation",
      "extractModule",
    ])
    .describe("Name of an op from the registered ops registry."),
  targetId: z
    .string()
    .min(1)
    .describe(
      "ID of the graph node this op targets. Must match an existing node id verbatim.",
    ),
  params: z
    .record(z.string(), z.unknown())
    .describe(
      "Object matching the op's paramsSchema. Use real values; do not include placeholders.",
    ),
  risk: RISK,
  rationale: z.string().min(4),
});

export const freeformStepSchema = z.object({
  kind: z.literal("freeform"),
  description: z.string().min(4),
  files: z
    .array(
      z.object({
        path: z
          .string()
          .min(1)
          .describe("Path relative to repoRoot. Use forward slashes."),
        content: z
          .string()
          .default("")
          .describe(
            "Can be empty — the executor will generate content by reading the actual file and applying the step description via LLM. If provided, used as a hint.",
          ),
      }),
    )
    .min(1)
    .max(8),
  risk: RISK,
  rationale: z.string().min(4),
});

export const stepSchema = z.discriminatedUnion("kind", [
  opStepSchema,
  freeformStepSchema,
]);

export const planSchema = z.object({
  intent: z.string().min(1).describe("One-line restatement of user intent."),
  steps: z.array(stepSchema).min(1).max(12),
  notes: z.string().optional(),
});

export type Step = z.infer<typeof stepSchema>;
export type OpStep = z.infer<typeof opStepSchema>;
export type FreeformStep = z.infer<typeof freeformStepSchema>;
export type Plan = z.infer<typeof planSchema>;

export type StepStatus =
  | "pending"
  | "running"
  | "success"
  | "failure"
  | "skipped";

export type StepResult = {
  status: StepStatus;
  description: string;
  diff?: string;
  filesChanged?: string[];
  testOutput?: string;
  testOutputLive?: string;
  phase?: "applying" | "testing" | "verifying_intent" | "done";
  error?: string;
  explanation?: string;
  intentCheck?: { matches: boolean; reason: string };
};
