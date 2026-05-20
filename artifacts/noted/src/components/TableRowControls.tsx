import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";

interface RowState {
  top: number;
  left: number;
  height: number;
  element: HTMLElement;
}

interface Props {
  editor: Editor | null;
}

export function TableRowControls({ editor }: Props) {
  const [row, setRow] = useState<RowState | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    const onMove = (e: MouseEvent) => {
      clearTimeout(hideTimer.current);
      const tr = (e.target as HTMLElement).closest("tr");
      if (!tr?.closest("table")) {
        hideTimer.current = setTimeout(() => setRow(null), 150);
        return;
      }
      const r = tr.getBoundingClientRect();
      setRow({ top: r.top, left: r.left, height: r.height, element: tr as HTMLElement });
    };

    const onLeave = () => {
      hideTimer.current = setTimeout(() => setRow(null), 200);
    };

    dom.addEventListener("mousemove", onMove);
    dom.addEventListener("mouseleave", onLeave);
    return () => {
      dom.removeEventListener("mousemove", onMove);
      dom.removeEventListener("mouseleave", onLeave);
      clearTimeout(hideTimer.current);
    };
  }, [editor]);

  const run = (cmd: "addRowBefore" | "addRowAfter" | "deleteRow") => {
    if (!editor || !row) return;
    const cell = row.element.querySelector("td, th");
    if (!cell) return;
    try {
      const pos = editor.view.posAtDOM(cell, 0);
      editor.chain().setTextSelection(pos)[cmd]().run();
    } catch {
      editor.chain().focus()[cmd]().run();
    }
  };

  if (!row) return null;

  const CONTROL_W = 76;
  const GAP = 6;
  const left = row.left - CONTROL_W - GAP;

  if (left < 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: row.top,
        left,
        height: row.height,
        width: CONTROL_W,
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 3,
        zIndex: 50,
        pointerEvents: "auto",
      }}
      onMouseEnter={() => clearTimeout(hideTimer.current)}
      onMouseLeave={() => {
        hideTimer.current = setTimeout(() => setRow(null), 200);
      }}
    >
      <RowButton
        title="Insert row above"
        onClick={() => run("addRowBefore")}
        variant="add"
      >
        <ArrowUp className="w-3 h-3" />
      </RowButton>
      <RowButton
        title="Insert row below"
        onClick={() => run("addRowAfter")}
        variant="add"
      >
        <ArrowDown className="w-3 h-3" />
      </RowButton>
      <RowButton
        title="Delete row"
        onClick={() => run("deleteRow")}
        variant="delete"
      >
        <Trash2 className="w-3 h-3" />
      </RowButton>
    </div>
  );
}

function RowButton({
  children,
  title,
  onClick,
  variant,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  variant: "add" | "delete";
}) {
  const [hovered, setHovered] = useState(false);
  const color = variant === "delete" ? "#ef4444" : "#10b981";
  const bg = hovered ? (variant === "delete" ? "#fef2f2" : "#f0fdf4") : "white";

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        border: `1px solid ${hovered ? color : "#e2e8f0"}`,
        background: bg,
        color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.1s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
