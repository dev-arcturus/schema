import type { EdgeRelation } from "@/extractor/types";

export const RELATION_STYLE: Record<
  EdgeRelation,
  { stroke: string; dash?: string; width: number; label?: string; hidden?: boolean }
> = {
  calls: { stroke: "hsl(220 8% 35%)", width: 1 },
  applies_middleware: {
    stroke: "hsl(280 70% 70%)",
    width: 1.5,
    dash: "4 3",
    label: "middleware",
  },
  registers_route: {
    stroke: "hsl(214 95% 67%)",
    width: 1.25,
    label: "registers",
  },
  imports: { stroke: "hsl(220 8% 22%)", width: 0.75, hidden: true },
};
