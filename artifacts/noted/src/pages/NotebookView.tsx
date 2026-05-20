import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { NotebookSettingsDialog } from "@/components/NotebookSettingsDialog";
import {
  useGetNotebook,
  useListNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  getListNotesQueryKey,
  getGetRecentNotesQueryKey,
  getGetNotebookQueryKey,
  useRequestUploadUrl,
  AttachmentInput,
  ListItem,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { formatMessageTime, formatMessageDate, formatFileSize } from "@/lib/date-utils";
import {
  Paperclip,
  Send,
  X,
  File as FileIcon,
  Loader2,
  Settings,
  Trash2,
  Copy,
  Pencil,
  Check,
  Search,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  List,
  Square,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
}

interface PendingNote {
  id: string;
  content: string;
  files: PendingFile[];
  progress: Record<string, number>; // fileId -> 0-100
}

/**
 * Trigger a file download via a temporary anchor tag.
 * The server sets Content-Disposition: attachment when ?filename= is present,
 * so the browser streams the file directly from the server — nothing is loaded
 * into browser RAM, which makes this safe for arbitrarily large files.
 */
function triggerDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = `${url}?filename=${encodeURIComponent(fileName)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const FILES_PER_MESSAGE = 10;

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

/**
 * Splits `text` around URLs, returning plain strings and clickable <a> elements.
 * Used when no search query is active.
 */
function linkify(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(new RegExp(URL_REGEX.source, "gi"))) {
    const url = match[0];
    const start = match.index!;
    if (start > last) nodes.push(text.slice(last, start));
    nodes.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="underline underline-offset-2 opacity-90 hover:opacity-100 break-all"
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/**
 * Splits `text` around case-insensitive matches of `query`.
 * Each match is wrapped in a <mark> with a global 1-based index stored in
 * data-match-idx. The active match (activeIdx) gets an orange accent.
 * `startIdx` is the 1-based global index of the first match in this note.
 */
function highlightText(
  text: string,
  query: string,
  startIdx: number,
  activeIdx: number,
): React.ReactNode[] {
  if (!query) return [text];
  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(regex);
  let localCount = 0;
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      const globalIdx = startIdx + localCount;
      localCount++;
      const isActive = globalIdx === activeIdx;
      return (
        <mark
          key={i}
          data-match-idx={globalIdx}
          className={
            isActive
              ? "bg-orange-400/80 text-inherit rounded-[2px] px-[1px] ring-1 ring-orange-500"
              : "bg-yellow-300/60 text-inherit rounded-[2px] px-[1px]"
          }
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

export default function NotebookView() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();

  const { data: notebook, isLoading: notebookLoading } = useGetNotebook(id, {
    query: { queryKey: getGetNotebookQueryKey(id), enabled: !!id },
  });

  // Search state — declared before useListNotes so searchQuery is in scope
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: notes, isLoading: notesLoading } = useListNotes(id, undefined, {
    query: { enabled: !!id, queryKey: getListNotesQueryKey(id) },
  });

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const requestUploadUrl = useRequestUploadUrl();

  const [content, setContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [pendingNotes, setPendingNotes] = useState<PendingNote[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Edit state
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete confirmation
  const [deleteConfirmNoteId, setDeleteConfirmNoteId] = useState<number | null>(null);

  // List compose state
  const [isListMode, setIsListMode] = useState(false);
  const [listDraftItems, setListDraftItems] = useState<{ id: string; text: string; checked: boolean }[]>([
    { id: crypto.randomUUID(), text: "", checked: false },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Tracks active XHR instances per pending note so we can abort them on cancel
  const xhrMapRef = useRef<Map<string, XMLHttpRequest[]>>(new Map());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [notes]);

  // Debounce search input → searchQuery (300 ms)
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Auto-focus search input when search opens
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [isSearchOpen]);

  // Auto-focus edit textarea when editing starts
  useEffect(() => {
    if (editingNoteId !== null && editTextareaRef.current) {
      editTextareaRef.current.focus();
      editTextareaRef.current.selectionStart = editTextareaRef.current.value.length;
    }
  }, [editingNoteId]);

  // --- Match navigation ---
  const [activeMatchIdx, setActiveMatchIdx] = useState(1);

  // Per-note match counts (client-side, from the flat notes array)
  const matchCounts = useMemo(() => {
    if (!searchQuery || !notes) return [] as number[];
    const regex = new RegExp(escapeRegex(searchQuery), "gi");
    return notes.map((note) =>
      note.content ? (note.content.match(regex) ?? []).length : 0,
    );
  }, [notes, searchQuery]);

  const totalMatches = useMemo(
    () => matchCounts.reduce((a, b) => a + b, 0),
    [matchCounts],
  );

  // 1-based starting global match index for each note in the flat array
  const matchOffsets = useMemo(() => {
    const offsets: number[] = [];
    let running = 1;
    matchCounts.forEach((count) => {
      offsets.push(running);
      running += count;
    });
    return offsets;
  }, [matchCounts]);

  // Map note id → index in the flat notes array (for grouped rendering)
  const noteIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    notes?.forEach((note, i) => map.set(note.id, i));
    return map;
  }, [notes]);

  // Reset to first match whenever the query changes
  useEffect(() => {
    setActiveMatchIdx(1);
  }, [searchQuery]);

  // Scroll active match into view
  useEffect(() => {
    if (!searchQuery || totalMatches === 0) return;
    const el = document.querySelector(`[data-match-idx="${activeMatchIdx}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeMatchIdx, searchQuery, totalMatches]);

  const goToPrevMatch = () =>
    setActiveMatchIdx((i) => (i <= 1 ? totalMatches : i - 1));
  const goToNextMatch = () =>
    setActiveMatchIdx((i) => (i >= totalMatches ? 1 : i + 1));

  const openSearch = () => setIsSearchOpen(true);
  const closeSearch = () => {
    setIsSearchOpen(false);
    setSearchInput("");
    setSearchQuery("");
    setActiveMatchIdx(1);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file) => {
        const isImage = file.type.startsWith("image/");
        return {
          id: Math.random().toString(36).substring(7),
          file,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        };
      });
      setPendingFiles((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const uploadFileWithProgress = async (
    pendingFile: PendingFile,
    noteId: string,
  ): Promise<AttachmentInput> => {
    const { file } = pendingFile;
    const { uploadURL, objectPath } = await requestUploadUrl.mutateAsync({
      data: {
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      },
    });

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Register so cancelPendingNote can abort this XHR
      const xhrList = xhrMapRef.current.get(noteId) ?? [];
      xhrList.push(xhr);
      xhrMapRef.current.set(noteId, xhrList);

      const cleanup = () => {
        const list = xhrMapRef.current.get(noteId);
        if (list) {
          const idx = list.indexOf(xhr);
          if (idx !== -1) list.splice(idx, 1);
        }
      };

      xhr.open("PUT", uploadURL);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setPendingNotes((prev) =>
            prev.map((n) =>
              n.id === noteId
                ? { ...n, progress: { ...n.progress, [pendingFile.id]: pct } }
                : n,
            ),
          );
        }
      });
      xhr.addEventListener("load", () => {
        cleanup();
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Upload failed (${xhr.status})`));
      });
      xhr.addEventListener("error", () => { cleanup(); reject(new Error("Network error during upload")); });
      xhr.addEventListener("abort", () => { cleanup(); reject(new Error("Upload cancelled")); });
      xhr.send(file);
    });

    return {
      objectPath,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
    };
  };

  const cancelPendingNote = (noteId: string) => {
    // Abort all in-flight XHRs for this note
    const xhrList = xhrMapRef.current.get(noteId) ?? [];
    xhrList.forEach((xhr) => xhr.abort());
    xhrMapRef.current.delete(noteId);
    // Remove the optimistic bubble immediately
    setPendingNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleSend = async () => {
    if (!content.trim() && pendingFiles.length === 0) return;

    const snapshot = { content: content.trim(), files: [...pendingFiles] };

    // Split files into chunks of FILES_PER_MESSAGE; always at least one chunk
    const chunks: PendingFile[][] = [];
    if (snapshot.files.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < snapshot.files.length; i += FILES_PER_MESSAGE) {
        chunks.push(snapshot.files.slice(i, i + FILES_PER_MESSAGE));
      }
    }

    // Create all optimistic bubbles at once and clear compose immediately
    const chunkIds = chunks.map(() => Math.random().toString(36).slice(2));
    setPendingNotes((prev) => [
      ...prev,
      ...chunks.map((chunkFiles, idx) => ({
        id: chunkIds[idx],
        content: idx === 0 ? snapshot.content : "",
        files: chunkFiles,
        progress: {},
      })),
    ]);
    setContent("");
    setPendingFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.focus();
    }

    // Upload and save all chunks concurrently
    await Promise.allSettled(
      chunks.map(async (chunkFiles, idx) => {
        const optimisticId = chunkIds[idx];
        try {
          const attachments: AttachmentInput[] = [];
          if (chunkFiles.length > 0) {
            const results = await Promise.all(
              chunkFiles.map((pf) => uploadFileWithProgress(pf, optimisticId)),
            );
            attachments.push(...results);
          }

          await createNote.mutateAsync({
            id,
            data: {
              content: idx === 0 ? snapshot.content : "",
              attachments: attachments.length > 0 ? attachments : undefined,
            },
          });

          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetRecentNotesQueryKey() });
        } catch {
          toast.error(
            chunks.length > 1
              ? `Failed to send batch ${idx + 1} of ${chunks.length}`
              : "Failed to send message",
          );
        } finally {
          setPendingNotes((prev) => prev.filter((n) => n.id !== optimisticId));
        }
      }),
    );
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const startEditing = (noteId: number, currentContent: string) => {
    setEditingNoteId(noteId);
    setEditContent(currentContent);
  };

  const cancelEditing = () => {
    setEditingNoteId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (noteId: number) => {
    if (!editContent.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateNote.mutateAsync({ id: noteId, data: { content: editContent.trim() } });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetRecentNotesQueryKey() });
      setEditingNoteId(null);
      setEditContent("");
    } catch {
      toast.error("Failed to save edit");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, noteId: number) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit(noteId);
    }
    if (e.key === "Escape") {
      cancelEditing();
    }
  };

  const handleDeleteNote = (noteId: number) => {
    deleteNote.mutate(
      { id: noteId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetRecentNotesQueryKey() });
        },
      },
    );
  };

  // List compose handlers
  const toggleListMode = () => {
    setIsListMode((prev) => {
      if (!prev) setListDraftItems([{ id: crypto.randomUUID(), text: "", checked: false }]);
      return !prev;
    });
  };

  const addListItem = () => {
    setListDraftItems((prev) => [...prev, { id: crypto.randomUUID(), text: "", checked: false }]);
  };

  const removeListItem = (itemId: string) => {
    setListDraftItems((prev) => {
      if (prev.length <= 1) return [{ id: crypto.randomUUID(), text: "", checked: false }];
      return prev.filter((item) => item.id !== itemId);
    });
  };

  const updateListItemText = (itemId: string, text: string) => {
    setListDraftItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, text } : item)));
  };

  const toggleListItem = (noteId: number, items: ListItem[], idx: number) => {
    const newItems = items.map((item, i) => (i === idx ? { ...item, checked: !item.checked } : item));
    updateNote.mutate(
      { id: noteId, data: { listItems: newItems } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(id) }); } },
    );
  };

  const handleListSend = async () => {
    const items = listDraftItems.filter((i) => i.text.trim());
    if (items.length === 0) return;
    try {
      await createNote.mutateAsync({
        id,
        data: { type: "list", listItems: items.map(({ text, checked }) => ({ text, checked })) },
      });
      queryClient.invalidateQueries({ queryKey: getListNotesQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetRecentNotesQueryKey() });
      setListDraftItems([{ id: crypto.randomUUID(), text: "", checked: false }]);
      scrollToBottom();
    } catch {
      toast.error("Failed to send list");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const next = el.value.slice(0, start) + "\n" + el.value.slice(end);
      setContent(next);
      requestAnimationFrame(() => {
        el.selectionStart = start + 1;
        el.selectionEnd = start + 1;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
      });
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleEditTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  // Group notes by date
  const groupedNotes =
    notes?.reduce(
      (acc, note) => {
        const dateStr = formatMessageDate(note.createdAt);
        if (!acc[dateStr]) acc[dateStr] = [];
        acc[dateStr].push(note);
        return acc;
      },
      {} as Record<string, typeof notes>,
    ) || {};

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-14 md:pt-0 relative max-w-3xl mx-auto w-full border-x border-border/40 shadow-sm bg-card/30">
        {/* Header */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 flex-1">
              <Search className="w-4 h-4 text-muted-foreground shrink-0 mr-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeSearch();
                  else if (e.key === "Enter")
                    e.shiftKey ? goToPrevMatch() : goToNextMatch();
                }}
                placeholder="Search messages…"
                className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground min-w-0"
              />
              {searchQuery && totalMatches > 0 && (
                <>
                  <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums px-1">
                    {activeMatchIdx} of {totalMatches}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPrevMatch}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                    title="Previous match (Shift+Enter)"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNextMatch}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                    title="Next match (Enter)"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </>
              )}
              {searchQuery && totalMatches === 0 && (
                <span className="text-[11px] text-muted-foreground shrink-0 px-1">
                  No results
                </span>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={closeSearch}
                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                title="Close search (Esc)"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              {notebookLoading ? (
                <Skeleton className="h-8 w-48" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{notebook?.emoji}</span>
                  <h2 className="font-semibold text-lg leading-tight">{notebook?.name}</h2>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={openSearch}
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  title="Search messages"
                >
                  <Search className="w-5 h-5" />
                </Button>
                {notebook && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSettingsOpen(true)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </>
          )}
        </header>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
          {notesLoading ? (
            <div className="flex flex-col gap-4 items-end">
              <Skeleton className="h-16 w-64 rounded-2xl rounded-tr-sm" />
              <Skeleton className="h-12 w-48 rounded-2xl rounded-tr-sm" />
              <Skeleton className="h-24 w-72 rounded-2xl rounded-tr-sm" />
            </div>
          ) : notes?.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-3xl">
                {notebook?.emoji || "💭"}
              </div>
              <p>This is the start of your notebook.</p>
              <p className="text-sm opacity-80 mt-1">Write your first note below.</p>
            </div>
          ) : searchQuery && totalMatches === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center h-full text-center text-muted-foreground pt-20">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-3xl">
                🔍
              </div>
              <p>No messages matched "{searchQuery}".</p>
              <p className="text-sm opacity-80 mt-1">Try a different keyword.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 justify-end min-h-full">
              {Object.entries(groupedNotes).map(([dateStr, dateNotes]) => (
                <div key={dateStr} className="flex flex-col gap-px">
                  <div className="flex justify-center sticky top-4 z-10 my-4">
                    <span className="text-[11px] font-medium uppercase tracking-wider bg-muted/80 backdrop-blur-sm text-muted-foreground px-3 py-1 rounded-full border border-border/50 shadow-sm">
                      {dateStr}
                    </span>
                  </div>

                  {dateNotes.map((note) => (
                    <div key={note.id} className="flex items-end gap-2 group justify-end" data-testid={`note-${note.id}`}>

                      {/* ⋯ menu — appears on hover, sits to the left of the bubble */}
                      {editingNoteId !== note.id && (
                        <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0 mb-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                                data-testid={`note-menu-${note.id}`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="left" align="end" className="w-36">
                              {note.content && (
                                <DropdownMenuItem
                                  onClick={() => handleCopy(note.content)}
                                  data-testid={`copy-note-${note.id}`}
                                >
                                  <Copy className="w-3.5 h-3.5 mr-2" />
                                  Copy text
                                </DropdownMenuItem>
                              )}
                              {note.content && (
                                <DropdownMenuItem
                                  onClick={() => startEditing(note.id, note.content)}
                                  data-testid={`edit-note-${note.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirmNoteId(note.id)}
                                className="text-destructive focus:text-destructive"
                                data-testid={`delete-note-${note.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}

                      <div className="flex flex-col items-end">

                      <div className="max-w-full bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm w-full">
                        {/* Attachments */}
                        {note.attachments && note.attachments.length > 0 && (
                          <div className="flex flex-col gap-2 mb-2">
                            {note.attachments.map((att) => {
                              const isImage = att.fileType.startsWith("image/");
                              const isAudio = att.fileType.startsWith("audio/");
                              const isVideo = att.fileType.startsWith("video/");
                              const url = `/api/storage${att.objectPath}`;

                              if (isImage) {
                                return (
                                  <img
                                    key={att.id}
                                    src={url}
                                    alt={att.fileName}
                                    className="rounded-lg max-h-64 object-cover border border-primary-foreground/20"
                                  />
                                );
                              }
                              if (isAudio) {
                                return (
                                  <audio
                                    key={att.id}
                                    controls
                                    src={url}
                                    className="w-full max-w-[240px] h-10 rounded-full"
                                  />
                                );
                              }
                              if (isVideo) {
                                return (
                                  <video
                                    key={att.id}
                                    controls
                                    src={url}
                                    className="rounded-lg max-h-64 border border-primary-foreground/20"
                                  />
                                );
                              }

                              return (
                                <button
                                  key={att.id}
                                  type="button"
                                  onClick={() => triggerDownload(url, att.fileName)}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/20 active:opacity-70 transition-colors border border-primary-foreground/20 text-left w-full cursor-pointer"
                                >
                                  <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center shrink-0">
                                    <FileIcon className="w-5 h-5 text-primary-foreground" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate text-primary-foreground">
                                      {att.fileName}
                                    </p>
                                    <p className="text-xs text-primary-foreground/70">
                                      {formatFileSize(att.fileSize)}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Text content — inline edit or display */}
                        {editingNoteId === note.id ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              ref={editTextareaRef}
                              value={editContent}
                              onChange={handleEditTextareaChange}
                              onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                              className="w-full bg-primary-foreground/10 text-primary-foreground placeholder:text-primary-foreground/50 rounded-lg px-3 py-2 resize-none outline-none text-[15px] leading-relaxed border border-primary-foreground/20 focus:border-primary-foreground/50 min-h-[60px]"
                              rows={1}
                              data-testid={`edit-textarea-${note.id}`}
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <span className="text-[11px] text-primary-foreground/60">
                                Enter to save · Esc to cancel
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                                onClick={cancelEditing}
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                                onClick={() => handleSaveEdit(note.id)}
                                disabled={isSavingEdit}
                                title="Save"
                                data-testid={`save-edit-${note.id}`}
                              >
                                {isSavingEdit ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : note.type === "list" && note.listItems && note.listItems.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            {note.listItems.map((item, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => toggleListItem(note.id, note.listItems!, idx)}
                                className="flex items-start gap-2 text-left w-full"
                              >
                                <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${item.checked ? "bg-primary-foreground/80 border-primary-foreground/60" : "border-primary-foreground/40"}`}>
                                  {item.checked && <Check className="w-2.5 h-2.5 text-primary" />}
                                </div>
                                <span className={`text-[15px] leading-relaxed ${item.checked ? "line-through opacity-50" : ""}`}>
                                  {item.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          note.content && (
                            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                              {searchQuery
                                ? highlightText(
                                    note.content,
                                    searchQuery,
                                    matchOffsets[noteIndexMap.get(note.id) ?? 0] ?? 1,
                                    activeMatchIdx,
                                  )
                                : linkify(note.content)}
                            </p>
                          )
                        )}
                      </div>

                      <span className="text-[11px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
                        {formatMessageTime(note.createdAt)}
                        {note.updatedAt !== note.createdAt && (
                          <span className="ml-1 italic">· edited</span>
                        )}
                      </span>
                    </div>
                    </div>
                  ))}
                </div>
              ))}
              {/* Optimistic / uploading notes */}
              {pendingNotes.map((pn) => (
                <div key={pn.id} className="flex flex-col items-end opacity-80">
                  <div className="max-w-full bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 shadow-sm w-full">
                    {pn.files.length > 0 && (
                      <div className="flex flex-col gap-2 mb-2">
                        {pn.files.map((pf) => {
                          const pct = pn.progress[pf.id] ?? 0;
                          const isImage = pf.file.type.startsWith("image/");

                          if (isImage && pf.previewUrl) {
                            return (
                              <div key={pf.id} className="relative">
                                <img
                                  src={pf.previewUrl}
                                  alt={pf.file.name}
                                  className="rounded-lg max-h-64 object-cover border border-primary-foreground/20 w-full"
                                />
                                {pct < 100 && (
                                  <div className="absolute bottom-2 left-2 right-2 h-1 bg-black/30 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-white rounded-full transition-all duration-200"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div
                              key={pf.id}
                              className="flex flex-col gap-2 p-3 rounded-xl bg-primary-foreground/10 border border-primary-foreground/20"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center shrink-0">
                                  <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate text-primary-foreground">
                                    {pf.file.name}
                                  </p>
                                  <p className="text-xs text-primary-foreground/70">
                                    {formatFileSize(pf.file.size)}
                                  </p>
                                </div>
                                <span className="text-xs text-primary-foreground/60 shrink-0">
                                  {pct}%
                                </span>
                              </div>
                              <div className="w-full h-1 bg-primary-foreground/20 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary-foreground rounded-full transition-all duration-200"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {pn.content && (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                        {pn.content}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 mr-1">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Sending…
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelPendingNote(pn.id)}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                      title="Cancel upload"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </button>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} className="h-1" />
            </div>
          )}
        </div>

        {/* Compose Area — hidden in search mode */}
        <div
          className={`px-4 pt-4 pb-4 bg-background border-t border-border shrink-0 ${isSearchOpen ? "hidden" : ""}`}
          style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {pendingFiles.length > FILES_PER_MESSAGE && (
            <div className="flex items-center gap-1.5 mb-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1 bg-muted border border-border rounded-full px-2 py-0.5">
                <Loader2 className="w-3 h-3" />
                {pendingFiles.length} files → will be split into{" "}
                {Math.ceil(pendingFiles.length / FILES_PER_MESSAGE)} messages
              </span>
            </div>
          )}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {pendingFiles.map((pf) => (
                <div
                  key={pf.id}
                  className="flex items-center gap-2 bg-muted border border-border rounded-lg pl-2 pr-1 py-1 max-w-[200px]"
                >
                  {pf.previewUrl ? (
                    <div className="w-6 h-6 rounded bg-black/10 shrink-0 overflow-hidden">
                      <img src={pf.previewUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                  ) : (
                    <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs truncate flex-1">{pf.file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 shrink-0 rounded-full hover:bg-background"
                    onClick={() => removePendingFile(pf.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2 bg-card border border-input rounded-2xl p-1 shadow-sm focus-within:ring-1 focus-within:ring-ring transition-shadow">
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />

            {/* Attach file — only in text mode */}
            {!isListMode && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full shrink-0 text-muted-foreground hover:text-foreground h-10 w-10 mb-0.5"
                onClick={() => fileInputRef.current?.click()}
                data-testid="attach-file-button"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
            )}

            {/* List mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full shrink-0 h-10 w-10 mb-0.5 transition-colors ${isListMode ? "text-primary bg-primary/10 hover:bg-primary/20" : "text-muted-foreground hover:text-foreground"}`}
              onClick={toggleListMode}
              title={isListMode ? "Switch to text" : "Switch to list"}
              data-testid="toggle-list-mode"
            >
              <List className="w-5 h-5" />
            </Button>

            {/* Input area — list or text */}
            {isListMode ? (
              <div className="flex-1 py-2 px-1 flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
                {listDraftItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Square className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                    <input
                      autoFocus={idx === listDraftItems.length - 1}
                      value={item.text}
                      onChange={(e) => updateListItemText(item.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addListItem(); }
                        if (e.key === "Backspace" && item.text === "") { e.preventDefault(); removeListItem(item.id); }
                        if (e.key === "Escape") toggleListMode();
                      }}
                      placeholder={idx === 0 ? "List item..." : ""}
                      className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                      data-testid={`list-item-input-${idx}`}
                    />
                    {listDraftItems.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 rounded-full opacity-50 hover:opacity-100" onClick={() => removeListItem(item.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addListItem}
                  className="text-[12px] text-muted-foreground hover:text-foreground text-left pl-5 mt-0.5 transition-colors"
                >
                  + Add item
                </button>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                placeholder="Message yourself..."
                className="flex-1 max-h-[200px] min-h-[44px] bg-transparent py-3 px-2 resize-none outline-none placeholder:text-muted-foreground text-[15px]"
                rows={1}
                data-testid="compose-textarea"
              />
            )}

            <Button
              size="icon"
              onClick={isListMode ? handleListSend : handleSend}
              disabled={isListMode ? listDraftItems.every((i) => !i.text.trim()) : (!content.trim() && pendingFiles.length === 0)}
              className="rounded-full shrink-0 h-10 w-10 mb-0.5"
              data-testid="send-button"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </Button>
          </div>
          <div className="text-center mt-2 text-[11px] text-muted-foreground">
            {isListMode ? (
              <>
                <span className="hidden md:inline">Enter for new item · Backspace on empty to remove · Esc to cancel</span>
                <span className="md:hidden">Enter for new item · Backspace on empty to delete</span>
              </>
            ) : (
              <>
                <span className="hidden md:inline">Press Enter to send, Ctrl + Enter for new line</span>
                <span className="md:hidden">Tap ↑ to send · Shift + Enter for new line</span>
              </>
            )}
          </div>
        </div>
      </main>

      {notebook && (
        <NotebookSettingsDialog notebook={notebook} open={settingsOpen} onOpenChange={setSettingsOpen} />
      )}

      <AlertDialog
        open={deleteConfirmNoteId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmNoteId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this message?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmNoteId !== null) {
                  handleDeleteNote(deleteConfirmNoteId);
                  setDeleteConfirmNoteId(null);
                }
              }}
              data-testid="confirm-delete-button"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
