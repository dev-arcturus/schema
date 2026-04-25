"use client";

import { useStore } from "@/state/store";
import { CanvasShell } from "@/components/canvas/CanvasShell";
import { GraphCanvas } from "@/components/canvas/GraphCanvas";
import { TopBar } from "@/components/canvas/TopBar";
import { SidePanel } from "@/components/canvas/SidePanel";
import { EmptyState } from "@/components/canvas/EmptyState";
import { Shortcuts } from "@/components/canvas/Shortcuts";
import { StatusPill } from "@/components/canvas/StatusPill";
import { Toast } from "@/components/canvas/Toast";
import { CommandBar } from "@/components/canvas/CommandBar";
import { PlanPanel } from "@/components/canvas/PlanPanel";
import { PlanProgress } from "@/components/canvas/PlanProgress";
import { CheatSheet } from "@/components/canvas/CheatSheet";
import { LeftSidebar } from "@/components/canvas/LeftSidebar";
import { TopToolbar } from "@/components/canvas/TopToolbar";

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
      topBar={<TopBar status={<StatusPill />} subtitle={subtitle} />}
      rightPanel={<SidePanel />}
    >
      <Shortcuts />
      {graph ? (
        <>
          <GraphCanvas />
          <TopToolbar />
          <LeftSidebar />
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
