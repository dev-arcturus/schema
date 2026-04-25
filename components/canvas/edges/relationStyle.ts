import type { EdgeRelation } from "@/extractor/types";

export const RELATION_STYLE: Record<
  EdgeRelation,
  { stroke: string; dash?: string; width: number; label?: string; hidden?: boolean }
> = {
  calls: { stroke: "hsl(220 8% 45%)", width: 1.25 },
  applies_middleware: {
    stroke: "hsl(280 75% 72%)",
    width: 1.75,
    dash: "5 4",
    label: "middleware",
  },
  registers_route: {
    stroke: "hsl(214 95% 67%)",
    width: 1.5,
    label: "registers",
  },
  imports: { stroke: "hsl(220 8% 22%)", width: 0.75, hidden: true },
};
