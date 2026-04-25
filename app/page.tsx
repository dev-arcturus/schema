"use client";

import { useStore } from "@/state/store";
import { CanvasShell } from "@/components/canvas/CanvasShell";
import { GraphCanvas } from "@/components/canvas/GraphCanvas";
import { TopBar } from "@/components/canvas/TopBar";
import { SidePanel } from "@/components/canvas/SidePanel";
import { EmptyState } from "@/components/canvas/EmptyState";
import { Shortcuts } from "@/components/canvas/Shortcuts";
import { Toast } from "@/components/canvas/Toast";
import { CommandBar } from "@/components/canvas/CommandBar";
import { PlanPanel } from "@/components/canvas/PlanPanel";
import { PlanProgress } from "@/components/canvas/PlanProgress";
import { CheatSheet } from "@/components/canvas/CheatSheet";
import { BlurOverlay } from "@/components/canvas/BlurOverlay";

export default function Page() {
  const graph = useStore((s) => s.graph);
  const origin = useStore((s) => s.origin);

  const subtitle =
    origin?.kind === "github"
      ? `${origin.owner}/${origin.repo}`
      : graph
        ? "local"
        : "";

  return (
    <CanvasShell
      topBar={<TopBar subtitle={subtitle} />}
      rightPanel={<SidePanel />}
    >
      <Shortcuts />
      {graph ? (
        <>
          <GraphCanvas />
          <BlurOverlay />
          <CommandBar />
          <PlanPanel />
          <PlanProgress />
          <CheatSheet />
          <Toast />
        </>
      ) : (
        <EmptyState />
      )}
    </CanvasShell>
  );
}
