import { useState, useCallback, useRef, useEffect } from "react";
import { useParams } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { NotebookSettingsDialog } from "@/components/NotebookSettingsDialog";
import {
  useGetNotebook,
  useUpdateNotebook,
  getListNotebooksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Indent } from "@/lib/tiptap-indent";
import Link from "@tiptap/extension-link";
import { ResizableImage } from "@/extensions/ResizableImage";
import { FontSize } from "@/extensions/FontSize";
import { LineHeight } from "@/extensions/LineHeight";
import { TableRowControls } from "@/components/TableRowControls";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  IndentIncrease,
  IndentDecrease,
  Highlighter,
  CaseSensitive,
  X,
  Download,
  FileText,
  FileCode,
  File,
  BookOpen,
  Printer,
  Table as TableIcon,
  Rows3,
  Columns3,
  Trash2,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportAsHtml,
  exportAsTxt,
  exportAsDocx,
  exportAsPdf,
  exportAsEpub,
} from "@/lib/documentExport";
import { useUpload } from "@workspace/object-storage-web";

const TEXT_COLORS = [
  { label: "Default",  color: "" },
  { label: "Red",      color: "#DC2626" },
  { label: "Orange",   color: "#EA580C" },
  { label: "Amber",    color: "#D97706" },
  { label: "Green",    color: "#16A34A" },
  { label: "Teal",     color: "#0D9488" },
  { label: "Blue",     color: "#2563EB" },
  { label: "Violet",   color: "#7C3AED" },
  { label: "Pink",     color: "#DB2777" },
  { label: "Gray",     color: "#6B7280" },
];

const HIGHLIGHT_COLORS = [
  { label: "Yellow",  color: "#FEF08A" },
  { label: "Orange",  color: "#FED7AA" },
  { label: "Pink",    color: "#FBCFE8" },
  { label: "Red",     color: "#FECACA" },
  { label: "Green",   color: "#BBF7D0" },
  { label: "Teal",    color: "#99F6E4" },
  { label: "Blue",    color: "#BFDBFE" },
  { label: "Purple",  color: "#E9D5FF" },
  { label: "Gray",    color: "#E5E7EB" },
];

const TABLE_GRID_COLS = 8;
const TABLE_GRID_ROWS = 8;

function TableSizePicker({ onSelect }: { onSelect: (rows: number, cols: number) => void }) {
  const [hovered, setHovered] = useState<{ rows: number; cols: number } | null>(null);
  return (
    <div className="p-2 select-none" onMouseLeave={() => setHovered(null)}>
      <p className="text-[11px] text-muted-foreground mb-2 min-h-[16px]">
        {hovered ? `${hovered.rows} × ${hovered.cols} table` : "Select table size"}
      </p>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${TABLE_GRID_COLS}, 1fr)` }}
      >
        {Array.from({ length: TABLE_GRID_ROWS * TABLE_GRID_COLS }, (_, i) => {
          const r = Math.floor(i / TABLE_GRID_COLS) + 1;
          const c = (i % TABLE_GRID_COLS) + 1;
          const active = hovered && r <= hovered.rows && c <= hovered.cols;
          return (
            <button
              key={i}
              type="button"
              className={`w-5 h-5 rounded-[2px] border transition-colors ${
                active
                  ? "bg-primary/25 border-primary/50"
                  : "bg-muted/50 border-border hover:bg-muted"
              }`}
              onMouseEnter={() => setHovered({ rows: r, cols: c })}
              onClick={() => onSelect(r, c)}
            />
          );
        })}
      </div>
    </div>
  );
}

const editorExtensions = [
  StarterKit,
  Underline,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Placeholder.configure({ placeholder: "Start writing…" }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Indent,
  Link.configure({
    openOnClick: true,
    autolink: true,
    linkOnPaste: true,
    HTMLAttributes: {
      target: "_blank",
      rel: "noopener noreferrer",
      class: "underline underline-offset-2 cursor-pointer",
    },
  }),
  Table.configure({ resizable: true }),
  TableRow,
  TableHeader,
  TableCell,
  FontSize,
  LineHeight,
  ResizableImage.configure({ inline: false, allowBase64: false }),
];

export default function DocumentView() {
  const { id: rawId } = useParams<{ id: string }>();
  const id = parseInt(rawId ?? "0", 10);
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [exporting, setExporting] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const initialContentSet = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading: isImageUploading } = useUpload({
    onError: () => toast.error("Failed to upload image"),
  });

  const { data: notebook, isLoading } = useGetNotebook(id);
  const updateNotebook = useUpdateNotebook();

  const debouncedSave = useCallback(
    (html: string) => {
      setSaveStatus("unsaved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await updateNotebook.mutateAsync({ id, data: { documentContent: html } });
          queryClient.invalidateQueries({ queryKey: getListNotebooksQueryKey() });
          setSaveStatus("saved");
        } catch {
          toast.error("Failed to save document");
          setSaveStatus("unsaved");
        }
      }, 1000);
    },
    [id, updateNotebook, queryClient],
  );

  const editor = useEditor({
    extensions: editorExtensions,
    immediatelyRender: false,
    content: "",
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "outline-none min-h-[60vh]",
      },
    },
  });

  useEffect(() => {
    if (editor && notebook && !initialContentSet.current) {
      initialContentSet.current = true;
      if (notebook.documentContent) {
        editor.commands.setContent(notebook.documentContent);
      }
    }
  }, [editor, notebook]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const getHtml = () => editor?.getHTML() ?? "";
  const title = notebook?.name ?? "Document";

  const handleExport = async (format: string) => {
    setExporting(format);
    try {
      const html = getHtml();
      if (format === "html") await exportAsHtml(html, title);
      else if (format === "txt") await exportAsTxt(html, title);
      else if (format === "docx") await exportAsDocx(html, title);
      else if (format === "pdf") exportAsPdf(html, title);
      else if (format === "epub") await exportAsEpub(html, title);
    } catch {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
          <div className="h-14 border-b border-border px-6 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex-1 p-8 max-w-3xl mx-auto w-full space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-4/6" />
          </div>
        </main>
      </div>
    );
  }

  if (!notebook) return null;

  const ToolbarButton = ({
    active,
    onClick,
    title: btnTitle,
    children,
  }: {
    active?: boolean;
    onClick: () => void;
    title: string;
    children: React.ReactNode;
  }) => (
    <Button
      variant="ghost"
      size="icon"
      className={`h-8 w-8 rounded-md ${active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      onClick={onClick}
      title={btnTitle}
      type="button"
    >
      {children}
    </Button>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden pt-14 md:pt-0">
        {/* Header */}
        <div className="h-14 border-b border-border px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xl leading-none">{notebook.emoji}</span>
            <span className="font-semibold">{notebook.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[12px] transition-colors ${
                saveStatus === "saving" ? "text-amber-500" : "text-muted-foreground/60"
              }`}
            >
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "unsaved"
                  ? "Unsaved"
                  : "Saved"}
            </span>

            {/* Export dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:text-foreground"
                  disabled={!!exporting}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="text-sm">{exporting ? `Exporting…` : "Export"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  Save as…
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("docx")}>
                  <File className="w-4 h-4 mr-2 text-blue-500" />
                  Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <Printer className="w-4 h-4 mr-2 text-red-500" />
                  PDF (.pdf)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("epub")}>
                  <BookOpen className="w-4 h-4 mr-2 text-green-600" />
                  E-book (.epub)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("html")}>
                  <FileCode className="w-4 h-4 mr-2 text-orange-500" />
                  HTML (.html)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("txt")}>
                  <FileText className="w-4 h-4 mr-2 text-muted-foreground" />
                  Plain text (.txt)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="border-b border-border px-3 py-1 flex items-center gap-0.5 shrink-0 bg-muted/20 overflow-x-auto scrollbar-none md:flex-wrap">
          <ToolbarButton
            active={editor?.isActive("heading", { level: 1 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            <Heading1 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            <Heading2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            title="Heading 3"
          >
            <Heading3 className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1 shrink-0" />

          {/* Font size selector */}
          <select
            title="Font size"
            value={editor?.getAttributes("textStyle").fontSize?.replace("px", "") ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                editor?.chain().focus().unsetFontSize().run();
              } else {
                editor?.chain().focus().setFontSize(`${val}px`).run();
              }
            }}
            className="h-8 w-16 rounded-md border border-border bg-background px-1.5 text-sm text-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer shrink-0"
          >
            <option value="">—</option>
            {[10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          {/* Line height selector */}
          <select
            title="Line spacing"
            value={
              editor?.getAttributes("paragraph").lineHeight ??
              editor?.getAttributes("heading").lineHeight ??
              ""
            }
            onChange={(e) => {
              const val = e.target.value;
              if (!val) {
                editor?.chain().focus().unsetLineHeight().run();
              } else {
                editor?.chain().focus().setLineHeight(val).run();
              }
            }}
            className="h-8 w-16 rounded-md border border-border bg-background px-1.5 text-sm text-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer shrink-0"
          >
            <option value="">↕ —</option>
            {[
              { label: "1", value: "1" },
              { label: "1.15", value: "1.15" },
              { label: "1.5", value: "1.5" },
              { label: "2", value: "2" },
              { label: "2.5", value: "2.5" },
              { label: "3", value: "3" },
            ].map(({ label, value }) => (
              <option key={value} value={value}>
                ↕ {label}
              </option>
            ))}
          </select>

          <div className="w-px h-5 bg-border mx-1 shrink-0" />

          <ToolbarButton
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("underline")}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            title="Underline (Ctrl+U)"
          >
            <UnderlineIcon className="w-4 h-4" />
          </ToolbarButton>

          {/* Text color picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Text color"
                className="h-8 w-8 rounded-md flex items-center justify-center relative transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <CaseSensitive className="w-4 h-4" />
                {/* Active color indicator bar */}
                <span
                  className="absolute bottom-1 left-1.5 right-1.5 h-[3px] rounded-full"
                  style={{
                    background: (() => {
                      const attrs = editor?.getAttributes("textStyle");
                      return attrs?.color || "#1a1a1a";
                    })(),
                  }}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="p-2 w-auto">
              <p className="text-[11px] text-muted-foreground mb-2 px-1">Text color</p>
              <div className="grid grid-cols-5 gap-1">
                {TEXT_COLORS.map(({ label, color }) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    onClick={() => {
                      if (!color) {
                        editor?.chain().focus().unsetColor().run();
                      } else {
                        editor?.chain().focus().setColor(color).run();
                      }
                    }}
                    className="w-8 h-8 rounded-md border border-border/60 hover:scale-110 transition-transform flex items-center justify-center font-bold text-sm"
                    style={
                      color
                        ? { color, borderColor: color + "40" }
                        : { color: "#1a1a1a", borderColor: "#e5e7eb" }
                    }
                  >
                    A
                  </button>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Highlight color picker */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Highlight color"
                className={`h-8 w-8 rounded-md flex items-center justify-center relative transition-colors ${
                  editor?.isActive("highlight")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <Highlighter className="w-4 h-4" />
                {/* Active color indicator bar */}
                <span
                  className="absolute bottom-1 left-1.5 right-1.5 h-[3px] rounded-full"
                  style={{
                    background: (() => {
                      const attrs = editor?.getAttributes("highlight");
                      return attrs?.color ?? "#FEF08A";
                    })(),
                    opacity: editor?.isActive("highlight") ? 1 : 0.5,
                  }}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="p-2 w-auto">
              <p className="text-[11px] text-muted-foreground mb-2 px-1">Highlight color</p>
              <div className="grid grid-cols-3 gap-1">
                {HIGHLIGHT_COLORS.map(({ label, color }) => (
                  <button
                    key={color}
                    type="button"
                    title={label}
                    onClick={() =>
                      editor?.chain().focus().setHighlight({ color }).run()
                    }
                    className="w-8 h-8 rounded-md border border-border/60 hover:scale-110 transition-transform flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => editor?.chain().focus().unsetHighlight().run()}
                className="mt-2 w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="w-3 h-3" />
                Remove highlight
              </button>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-border mx-1 shrink-0" />

          <ToolbarButton
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            title="Bullet list"
          >
            <List className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            title="Numbered list"
          >
            <ListOrdered className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive("horizontalRule")}
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            title="Horizontal line"
          >
            <Minus className="w-4 h-4" />
          </ToolbarButton>

          {/* Table */}
          <DropdownMenu open={tableMenuOpen} onOpenChange={setTableMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Table"
                className={`h-8 w-8 rounded-md flex items-center justify-center transition-colors ${
                  editor?.isActive("table")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-auto min-w-48">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                Insert table
              </DropdownMenuLabel>
              <TableSizePicker
                onSelect={(rows, cols) => {
                  editor
                    ?.chain()
                    .focus()
                    .insertTable({ rows, cols, withHeaderRow: true })
                    .run();
                  setTableMenuOpen(false);
                }}
              />
              {editor?.isActive("table") && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Rows
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      editor?.chain().focus().addRowBefore().run()
                    }
                  >
                    <Rows3 className="w-4 h-4 mr-2 text-muted-foreground" />
                    Add row above
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      editor?.chain().focus().addRowAfter().run()
                    }
                  >
                    <Rows3 className="w-4 h-4 mr-2 text-muted-foreground" />
                    Add row below
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      editor?.chain().focus().deleteRow().run()
                    }
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete row
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                    Columns
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      editor?.chain().focus().addColumnBefore().run()
                    }
                  >
                    <Columns3 className="w-4 h-4 mr-2 text-muted-foreground" />
                    Add column before
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      editor?.chain().focus().addColumnAfter().run()
                    }
                  >
                    <Columns3 className="w-4 h-4 mr-2 text-muted-foreground" />
                    Add column after
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      editor?.chain().focus().deleteColumn().run()
                    }
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete column
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() =>
                      editor?.chain().focus().deleteTable().run()
                    }
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete table
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-5 bg-border mx-1 shrink-0" />

          <ToolbarButton
            onClick={() => editor?.chain().focus().decreaseIndent().run()}
            title="Decrease indent (Shift+Tab)"
          >
            <IndentDecrease className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor?.chain().focus().increaseIndent().run()}
            title="Increase indent (Tab)"
          >
            <IndentIncrease className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1 shrink-0" />

          <ToolbarButton
            active={editor?.isActive({ textAlign: "left" })}
            onClick={() => editor?.chain().focus().setTextAlign("left").run()}
            title="Align left"
          >
            <AlignLeft className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive({ textAlign: "center" })}
            onClick={() => editor?.chain().focus().setTextAlign("center").run()}
            title="Align center"
          >
            <AlignCenter className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor?.isActive({ textAlign: "right" })}
            onClick={() => editor?.chain().focus().setTextAlign("right").run()}
            title="Align right"
          >
            <AlignRight className="w-4 h-4" />
          </ToolbarButton>

          <div className="w-px h-5 bg-border mx-1 shrink-0" />

          {/* Image upload */}
          <ToolbarButton
            onClick={() => imageInputRef.current?.click()}
            title="Insert image"
          >
            {isImageUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImageIcon className="w-4 h-4" />
            )}
          </ToolbarButton>
        </div>

        {/* Hidden image file input */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !editor) return;
            e.target.value = "";
            const result = await uploadFile(file);
            if (result) {
              const src = `/api/notebooks/${id}/images${result.objectPath}`;
              editor.chain().focus().setImage({ src, alt: file.name }).run();
            }
          }}
        />

        {/* Editor content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-10">
            <EditorContent editor={editor} className="document-editor" />
          </div>
        </div>
        <TableRowControls editor={editor} />
      </main>

      {notebook && (
        <NotebookSettingsDialog
          notebook={notebook}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </div>
  );
}
