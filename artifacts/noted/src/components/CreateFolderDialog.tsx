import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateFolder, getListFoldersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const EMOJI_OPTIONS = ["📁", "📂", "🗂️", "💼", "🏠", "🌟", "🎯", "💡", "🎨", "📌"];

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFolderDialog({ open, onOpenChange }: CreateFolderDialogProps) {
  const queryClient = useQueryClient();
  const createFolder = useCreateFolder();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createFolder.mutate(
      { data: { name: name.trim(), emoji } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
          onOpenChange(false);
          setName("");
          setEmoji("📁");
        },
      }
    );
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName("");
      setEmoji("📁");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Organize your notebooks into folders.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-1">
          <div className="space-y-2">
            <Label>Emoji</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`h-10 w-10 rounded-md text-xl flex items-center justify-center transition-colors ${
                    emoji === e
                      ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                  onClick={() => setEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work, Personal, Projects"
              autoFocus
              maxLength={50}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || createFolder.isPending}>
              {createFolder.isPending ? "Creating…" : "Create Folder"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
