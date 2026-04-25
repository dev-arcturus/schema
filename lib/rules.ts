import { z } from "zod";

const NODE_KIND = z.enum([
  "route_handler",
  "service",
  "data_access",
  "middleware",
  "model",
  "external",
  "utility",
]);

const EDGE_RELATION = z.enum([
  "imports",
  "calls",
  "registers_route",
  "applies_middleware",
]);

export const nodeMatcherSchema = z
  .object({
    kind: NODE_KIND.optional(),
    name: z.string().optional(),
    nameContains: z.string().optional(),
    file: z.string().optional(),
    fileContains: z.string().optional(),
    httpMethod: z.string().optional(),
    httpPathContains: z.string().optional(),
    cluster: z.string().optional(),
  })
  .refine((m) => Object.values(m).some((v) => v !== undefined), {
    message: "matcher must have at least one criterion",
  });

export type NodeMatcher = z.infer<typeof nodeMatcherSchema>;

export const predicateSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("no_edge"),
    source: nodeMatcherSchema,
    target: nodeMatcherSchema,
    relation: EDGE_RELATION.optional(),
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("must_have_edge"),
    source: nodeMatcherSchema,
    target: nodeMatcherSchema,
    relation: EDGE_RELATION,
    note: z.string().optional(),
  }),
  z.object({
    type: z.literal("must_not_exist"),
    matcher: nodeMatcherSchema,
    note: z.string().optional(),
  }),
]);

export type Predicate = z.infer<typeof predicateSchema>;

export const ruleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(120),
  prompt: z.string().min(2).max(280),
  predicate: predicateSchema,
  severity: z.enum(["info", "warn", "error"]).default("warn"),
  createdAt: z.number().int(),
  enabled: z.boolean().default(true),
});

export type Rule = z.infer<typeof ruleSchema>;

export type Violation = {
  ruleId: string;
  ruleTitle: string;
  severity: Rule["severity"];
  nodeIds: string[];
  message: string;
  suggestedPrompt?: string;
};
