import fs from "node:fs";
import path from "node:path";
import { ruleSchema, type Rule } from "./rules";

const RULES_FILE = ".schema-rules.json";

export function readRules(repoPath: string): Rule[] {
  const file = path.join(repoPath, RULES_FILE);
  if (!fs.existsSync(file)) return defaultRules();
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!Array.isArray(raw)) return defaultRules();
    const out: Rule[] = [];
    for (const r of raw) {
      const parsed = ruleSchema.safeParse(r);
      if (parsed.success) out.push(parsed.data);
    }
    return out;
  } catch {
    return defaultRules();
  }
}

export function writeRules(repoPath: string, rules: Rule[]): void {
  const file = path.join(repoPath, RULES_FILE);
  fs.writeFileSync(file, JSON.stringify(rules, null, 2));
}

export function addRule(repoPath: string, rule: Rule): void {
  const rules = readRules(repoPath).filter((r) => r.id !== rule.id);
  rules.push(rule);
  writeRules(repoPath, rules);
}

export function removeRule(repoPath: string, id: string): void {
  const rules = readRules(repoPath).filter((r) => r.id !== id);
  writeRules(repoPath, rules);
}

export function setRuleEnabled(
  repoPath: string,
  id: string,
  enabled: boolean,
): void {
  const rules = readRules(repoPath).map((r) =>
    r.id === id ? { ...r, enabled } : r,
  );
  writeRules(repoPath, rules);
}

function defaultRules(): Rule[] {
  return [];
}
