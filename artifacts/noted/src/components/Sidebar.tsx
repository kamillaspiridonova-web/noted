import { useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Plus, Notebook as NotebookIcon, Menu, MoreHorizontal, Pencil, Trash2,
  User, LogOut, ShieldCheck, UserPlus, Check, ArrowLeftRight, Loader2,
  ChevronRight, ChevronDown, Folder as FolderIcon, FolderPlus, FolderX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useListNotebooks,
  useListFolders,
  useDeleteFolder,
  useUpdateFolder,
  useUpdateNotebook,
  getListFoldersQueryKey,
  getListNotebooksQueryKey,
  Notebook,
  Folder,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateNotebookDialog } from "./CreateNotebookDialog";
import { CreateFolderDialog } from "./CreateFolderDialog";
import { NotebookSettingsDialog } from "./NotebookSettingsDialog";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useUser, useClerk, useSessionList, useSession } from "@clerk/react";
import { toast } from "sonner";
import { ThemePicker } from "./ThemePicker";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function NotebookItem({
  notebook,
  onManage,
  onMoveToFolder,
  folders,
  indent = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: {
  notebook: Notebook;
  onManage: (nb: Notebook) => void;
  onMoveToFolder: (notebookId: number, folderId: number | null) => void;
  folders: Folder[];
  indent?: boolean;
  isDragging?: boolean;
  onDragStart?: (notebookId: number) => void;
  onDragEnd?: () => void;
}) {
  const [location] = useLocation();
  const isActive = location === `/notebooks/${notebook.id}`;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("notebookId", String(notebook.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(notebook.id);
      }}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-1 rounded-lg transition-all cursor-grab active:cursor-grabbing ${
        indent ? "px-1" : "px-2"
      } py-1 ${isDragging ? "opacity-40 scale-[0.97]" : ""} ${
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      }`}
      data-testid={`notebook-item-${notebook.id}`}
    >
      <Link
        href={`/notebooks/${notebook.id}`}
        className="flex items-center gap-3 flex-1 min-w-0 px-1 py-1.5"
      >
        <span className="text-xl leading-none shrink-0">{notebook.emoji}</span>
        <div className="flex-1 truncate text-sm">{notebook.name}</div>
      </Link>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={(e) => e.stopPropagation()}
            data-testid={`notebook-menu-${notebook.id}`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="w-48">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onManage(notebook);
            }}
            data-testid={`rename-notebook-${notebook.id}`}
          >
            <Pencil className="w-4 h-4 mr-2" />
            Rename
          </DropdownMenuItem>

          {folders.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FolderIcon className="w-4 h-4 mr-2" />
                  Move to folder
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-44">
                  {folders.map((folder) => (
                    <DropdownMenuItem
                      key={folder.id}
                      onClick={() => onMoveToFolder(notebook.id, folder.id)}
                    >
                      <span className="mr-2 text-base leading-none">{folder.emoji}</span>
                      <span className="flex-1 truncate">{folder.name}</span>
                      {notebook.folderId === folder.id && (
                        <Check className="w-3.5 h-3.5 ml-2 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                  {notebook.folderId != null && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onMoveToFolder(notebook.id, null)}>
                        <FolderX className="w-4 h-4 mr-2" />
                        Remove from folder
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onManage(notebook);
            }}
            className="text-destructive focus:text-destructive"
            data-testid={`delete-notebook-${notebook.id}`}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function FolderGroup({
  folder,
  notebooks,
  isCollapsed,
  onToggle,
  onManageNotebook,
  onMoveToFolder,
  onAddNotebook,
  onRename,
  onDelete,
  allFolders,
  isDragOver = false,
  draggingNotebookId,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragStartNotebook,
  onDragEndNotebook,
}: {
  folder: Folder;
  notebooks: Notebook[];
  isCollapsed: boolean;
  onToggle: () => void;
  onManageNotebook: (nb: Notebook) => void;
  onMoveToFolder: (notebookId: number, folderId: number | null) => void;
  onAddNotebook: (folderId: number) => void;
  onRename: (folder: Folder) => void;
  onDelete: (folder: Folder) => void;
  allFolders: Folder[];
  isDragOver?: boolean;
  draggingNotebookId?: number | null;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDrop?: (notebookId: number) => void;
  onDragStartNotebook?: (notebookId: number) => void;
  onDragEndNotebook?: () => void;
}) {
  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter?.();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave?.();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        const notebookId = parseInt(e.dataTransfer.getData("notebookId"));
        if (!isNaN(notebookId)) onDrop?.(notebookId);
      }}
      className={`rounded-lg transition-all duration-150 ${
        isDragOver ? "ring-2 ring-primary/50 bg-primary/5" : ""
      }`}
    >
      <div
        className="group flex items-center gap-1 px-2 py-1 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
      >
        <button
          className="flex items-center gap-1.5 flex-1 min-w-0 py-1 text-left"
          onClick={onToggle}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/40" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-sidebar-foreground/40" />
          )}
          <span className="text-base leading-none shrink-0">{folder.emoji}</span>
          <span className="flex-1 truncate text-sm font-medium">{folder.name}</span>
          <span className="text-xs text-sidebar-foreground/35 shrink-0 tabular-nums">
            {notebooks.length}
          </span>
        </button>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            title="Add notebook to folder"
            onClick={(e) => {
              e.stopPropagation();
              onAddNotebook(folder.id);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-44">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(folder);
                }}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!isCollapsed && (
        <div className="pl-2 space-y-0.5 mt-0.5">
          {notebooks.length === 0 ? (
            <div className="px-4 py-2 text-xs text-sidebar-foreground/40 italic">
              No notebooks yet
            </div>
          ) : (
            notebooks.map((nb) => (
              <NotebookItem
                key={nb.id}
                notebook={nb}
                onManage={onManageNotebook}
                onMoveToFolder={onMoveToFolder}
                folders={allFolders}
                indent
                isDragging={draggingNotebookId === nb.id}
                onDragStart={onDragStartNotebook}
                onDragEnd={onDragEndNotebook}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NotebookList({
  onManage,
  onAddNotebook,
  onCreate,
}: {
  onManage: (nb: Notebook) => void;
  onAddNotebook: (folderId?: number) => void;
  onCreate: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: notebooks, isLoading: notebooksLoading } = useListNotebooks();
  const { data: folders, isLoading: foldersLoading } = useListFolders();

  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("noted-collapsed-folders");
      return saved ? new Set<number>(JSON.parse(saved) as number[]) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  });

  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<Folder | null>(null);
  const [draggingNotebookId, setDraggingNotebookId] = useState<number | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<number | "root" | null>(null);

  const deleteFolder = useDeleteFolder();
  const updateFolder = useUpdateFolder();
  const updateNotebook = useUpdateNotebook();

  const toggleFolder = useCallback((folderId: number) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      try {
        localStorage.setItem("noted-collapsed-folders", JSON.stringify([...next]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  const handleMoveToFolder = useCallback(
    (notebookId: number, folderId: number | null) => {
      updateNotebook.mutate(
        { id: notebookId, data: { folderId } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListNotebooksQueryKey() });
          },
          onError: () => {
            toast.error("Failed to move notebook");
          },
        }
      );
    },
    [updateNotebook, queryClient]
  );

  const handleRenameFolder = () => {
    if (!editFolder || !renameName.trim()) return;
    updateFolder.mutate(
      { id: editFolder.id, data: { name: renameName.trim() } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
          setEditFolder(null);
        },
        onError: () => {
          toast.error("Failed to rename folder");
        },
      }
    );
  };

  const handleDeleteFolder = () => {
    if (!deleteFolderTarget) return;
    deleteFolder.mutate(
      { id: deleteFolderTarget.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListNotebooksQueryKey() });
          setDeleteFolderTarget(null);
        },
        onError: () => {
          toast.error("Failed to delete folder");
        },
      }
    );
  };

  const handleDragStart = useCallback((notebookId: number) => {
    setDraggingNotebookId(notebookId);
    setDragOverTarget(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingNotebookId(null);
    setDragOverTarget(null);
  }, []);

  if (notebooksLoading || foldersLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-sidebar-accent/50" />
        ))}
      </div>
    );
  }

  const allFolders = folders ?? [];
  const allNotebooks = notebooks ?? [];
  const rootNotebooks = allNotebooks.filter((nb) => nb.folderId == null);
  const folderNotebooks = (folderId: number) =>
    allNotebooks.filter((nb) => nb.folderId === folderId);

  if (allFolders.length === 0 && allNotebooks.length === 0) {
    return (
      <div className="px-2 py-4 text-sm text-sidebar-foreground/60 text-center">
        No notebooks yet.{" "}
        <Button variant="link" className="px-1 py-0 h-auto" onClick={onCreate}>
          Create one
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-0.5">
        {allFolders.map((folder) => (
          <FolderGroup
            key={folder.id}
            folder={folder}
            notebooks={folderNotebooks(folder.id)}
            isCollapsed={collapsedFolders.has(folder.id)}
            onToggle={() => toggleFolder(folder.id)}
            onManageNotebook={onManage}
            onMoveToFolder={handleMoveToFolder}
            onAddNotebook={(folderId) => onAddNotebook(folderId)}
            onRename={(f) => {
              setRenameName(f.name);
              setEditFolder(f);
            }}
            onDelete={setDeleteFolderTarget}
            allFolders={allFolders}
            isDragOver={dragOverTarget === folder.id}
            draggingNotebookId={draggingNotebookId}
            onDragEnter={() => setDragOverTarget(folder.id)}
            onDragLeave={() => setDragOverTarget((prev) => (prev === folder.id ? null : prev))}
            onDrop={(notebookId) => {
              handleMoveToFolder(notebookId, folder.id);
              setDragOverTarget(null);
            }}
            onDragStartNotebook={handleDragStart}
            onDragEndNotebook={handleDragEnd}
          />
        ))}

        {allFolders.length > 0 ? (
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOverTarget("root");
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverTarget((prev) => (prev === "root" ? null : prev));
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDrop={(e) => {
              e.preventDefault();
              const notebookId = parseInt(e.dataTransfer.getData("notebookId"));
              if (!isNaN(notebookId)) handleMoveToFolder(notebookId, null);
              setDragOverTarget(null);
            }}
            className={`rounded-lg transition-all duration-150 ${
              dragOverTarget === "root" ? "ring-2 ring-primary/50 bg-primary/5" : ""
            }`}
          >
            {(rootNotebooks.length > 0 || draggingNotebookId != null) && (
              <div className="pt-2 pb-1">
                <div className="px-3 text-[11px] font-semibold text-sidebar-foreground/35 uppercase tracking-wider">
                  No folder
                </div>
              </div>
            )}
            {rootNotebooks.length === 0 && draggingNotebookId != null && (
              <div className="px-4 py-2.5 text-xs text-sidebar-foreground/40 italic text-center">
                Drop here to remove from folder
              </div>
            )}
            {rootNotebooks.map((nb) => (
              <NotebookItem
                key={nb.id}
                notebook={nb}
                onManage={onManage}
                onMoveToFolder={handleMoveToFolder}
                folders={allFolders}
                isDragging={draggingNotebookId === nb.id}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        ) : (
          rootNotebooks.map((nb) => (
            <NotebookItem
              key={nb.id}
              notebook={nb}
              onManage={onManage}
              onMoveToFolder={handleMoveToFolder}
              folders={allFolders}
              isDragging={draggingNotebookId === nb.id}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>

      {/* Rename folder dialog */}
      <Dialog
        open={!!editFolder}
        onOpenChange={(open) => {
          if (!open) setEditFolder(null);
        }}
      >
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameFolder();
            }}
            autoFocus
            maxLength={50}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditFolder(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameFolder}
              disabled={!renameName.trim() || updateFolder.isPending}
            >
              {updateFolder.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete folder confirmation */}
      <AlertDialog
        open={!!deleteFolderTarget}
        onOpenChange={(open) => {
          if (!open && !deleteFolder.isPending) setDeleteFolderTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteFolderTarget?.emoji} {deleteFolderTarget?.name}</strong> will be deleted.
              Notebooks inside it will move to the root level. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFolder.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteFolder}
              disabled={deleteFolder.isPending}
            >
              {deleteFolder.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</>
              ) : (
                "Delete folder"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function avatarInitials(firstName: string | null, lastName: string | null, identifier: string) {
  return (
    [firstName, lastName]
      .filter(Boolean)
      .map((n) => n![0].toUpperCase())
      .join("") || identifier[0]?.toUpperCase() || "?"
  );
}

function AccountSection() {
  const { user, isLoaded } = useUser();
  const { signOut, openSignIn, setActive } = useClerk();
  const { sessions } = useSessionList();
  const { session: currentSession } = useSession();
  const [, navigate] = useLocation();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isDev = import.meta.env.DEV;

  if (isDev || !isLoaded || !user) {
    return (
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg text-sidebar-foreground/50 text-sm">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0 text-sm">Your account</div>
        </div>
      </div>
    );
  }

  const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? "";
  const initials = avatarInitials(user.firstName, user.lastName, email);

  const otherSessions = sessions?.filter(
    (s) => s.id !== currentSession?.id && s.status === "active" && s.user != null
  ) ?? [];

  const handleSwitch = async (sessionId: string) => {
    setSwitchingId(sessionId);
    try {
      await setActive({ session: sessionId });
      navigate("/");
    } catch {
      toast.error("Failed to switch account");
      setSwitchingId(null);
    }
  };

  const handleSwitchAccount = () => {
    signOut({ redirectUrl: `${basePath}/sign-in` });
  };

  const handleDeleteAccount = async () => {
    if (!user.deleteSelfEnabled) {
      toast.error("Account deletion is not enabled. Contact support to delete your account.");
      setShowDeleteConfirm(false);
      return;
    }
    setDeleting(true);
    try {
      await user.delete();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete account";
      toast.error(msg);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="p-3 border-t border-sidebar-border shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground w-full text-left transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={user.fullName ?? email}
                  className="w-8 h-8 rounded-full shrink-0 object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate leading-tight">
                  {user.fullName || email}
                </div>
                {user.fullName && (
                  <div className="text-xs text-sidebar-foreground/50 truncate leading-tight mt-0.5">
                    {email}
                  </div>
                )}
              </div>
              <MoreHorizontal className="w-4 h-4 shrink-0 text-sidebar-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64 mb-1">
            <DropdownMenuLabel className="font-normal py-2">
              <div className="flex items-center gap-2.5">
                {user.imageUrl ? (
                  <img src={user.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate leading-tight">{user.fullName || email}</p>
                  <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{email}</p>
                </div>
                <Check className="w-3.5 h-3.5 text-primary shrink-0" />
              </div>
            </DropdownMenuLabel>

            {otherSessions.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
                  Other accounts
                </DropdownMenuLabel>
                {otherSessions.map((s) => {
                  const u = s.user!;
                  const sEmail = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? s.publicUserData.identifier;
                  const sInitials = avatarInitials(u.firstName, u.lastName, sEmail);
                  const isSwitching = switchingId === s.id;
                  return (
                    <DropdownMenuItem
                      key={s.id}
                      onClick={() => handleSwitch(s.id)}
                      disabled={isSwitching}
                      className="gap-2.5 py-2"
                    >
                      {u.imageUrl ? (
                        <img src={u.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {sInitials}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate leading-tight">{u.fullName || sEmail}</p>
                        <p className="text-xs text-muted-foreground truncate leading-tight mt-0.5">{sEmail}</p>
                      </div>
                      {isSwitching ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-muted-foreground" />
                      ) : (
                        <ArrowLeftRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSwitchAccount} className="gap-2">
              <ArrowLeftRight className="w-4 h-4" />
              Switch account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSignIn()} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add account
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/account")}>
              <User className="w-4 h-4 mr-2" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/account#/security")}>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Security
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut()}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteConfirm(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={(open) => { if (!open && !deleting) setShowDeleteConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{email}</strong> and all your notebooks and notes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</>
              ) : (
                "Delete account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SidebarContent({
  onManage,
  onCreate,
  onAddNotebook,
  onCreateFolder,
}: {
  onManage: (nb: Notebook) => void;
  onCreate: () => void;
  onAddNotebook: (folderId?: number) => void;
  onCreateFolder: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border w-full">
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-lg hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
            <NotebookIcon className="w-4 h-4" />
          </div>
          Noted
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              data-testid="create-notebook-button"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onCreate}>
              <NotebookIcon className="w-4 h-4 mr-2" />
              New Notebook
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onCreateFolder}>
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        <div className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-3 px-2 pt-2">
          Your Notebooks
        </div>
        <NotebookList onManage={onManage} onAddNotebook={onAddNotebook} onCreate={onCreate} />
      </div>

      <ThemePicker />
      <AccountSection />
    </div>
  );
}

export function Sidebar() {
  const [location] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [createInFolder, setCreateInFolder] = useState<number | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [settingsNotebook, setSettingsNotebook] = useState<Notebook | null>(null);

  const isHome = location === "/";

  const handleAddNotebook = (folderId?: number) => {
    setCreateInFolder(folderId ?? null);
    setCreateOpen(true);
  };

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block w-72 h-dvh shrink-0">
        <SidebarContent
          onManage={setSettingsNotebook}
          onCreate={() => handleAddNotebook()}
          onAddNotebook={handleAddNotebook}
          onCreateFolder={() => setCreateFolderOpen(true)}
        />
      </div>

      {/* Mobile top bar + drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-10 flex items-center px-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="mr-2 -ml-2">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r-0">
            <SidebarContent
              onManage={setSettingsNotebook}
              onCreate={() => handleAddNotebook()}
              onAddNotebook={handleAddNotebook}
              onCreateFolder={() => setCreateFolderOpen(true)}
            />
          </SheetContent>
        </Sheet>
        <span className="font-semibold">{isHome ? "Noted" : "Notebook"}</span>
      </div>

      <CreateNotebookDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateInFolder(null);
        }}
        initialFolderId={createInFolder}
      />

      <CreateFolderDialog open={createFolderOpen} onOpenChange={setCreateFolderOpen} />

      {settingsNotebook && (
        <NotebookSettingsDialog
          notebook={settingsNotebook}
          open={!!settingsNotebook}
          onOpenChange={(open) => {
            if (!open) setSettingsNotebook(null);
          }}
        />
      )}
    </>
  );
}
