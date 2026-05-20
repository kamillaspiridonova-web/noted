import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  useUpdateNotebook, 
  useDeleteNotebook,
  useGetNotebookStats,
  getListNotebooksQueryKey,
  getGetNotebookQueryKey,
  getGetNotebookStatsQueryKey,
  Notebook
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Trash2 } from "lucide-react";

const EMOJI_OPTIONS = ["📓", "💭", "💡", "🎯", "❤️", "📅", "💪", "🌟", "📚", "✨", "🎵", "✈️"];

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  emoji: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface NotebookSettingsDialogProps {
  notebook: Notebook;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotebookSettingsDialog({ notebook, open, onOpenChange }: NotebookSettingsDialogProps) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const updateNotebook = useUpdateNotebook();
  const deleteNotebook = useDeleteNotebook();
  const { data: stats } = useGetNotebookStats(notebook.id, {
    query: { queryKey: getGetNotebookStatsQueryKey(notebook.id), enabled: open },
  });

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: notebook.name,
      emoji: notebook.emoji,
    },
  });

  const onSubmit = (data: FormValues) => {
    updateNotebook.mutate(
      { id: notebook.id, data: { name: data.name, emoji: data.emoji } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotebooksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetNotebookQueryKey(notebook.id) });
          onOpenChange(false);
        },
      }
    );
  };

  const handleDelete = () => {
    deleteNotebook.mutate(
      { id: notebook.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListNotebooksQueryKey() });
          onOpenChange(false);
          setLocation("/");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) setShowDeleteConfirm(false);
    }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Notebook Settings</DialogTitle>
          <DialogDescription>
            Manage settings for this notebook.
          </DialogDescription>
        </DialogHeader>

        {stats && (
          <div className="flex gap-4 py-2 text-sm text-muted-foreground border-y border-border mb-4">
            <div>
              <span className="font-semibold text-foreground">{stats.noteCount}</span> notes
            </div>
            <div>
              <span className="font-semibold text-foreground">{stats.attachmentCount}</span> attachments
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emoji</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className={`h-10 w-10 rounded-md text-xl flex items-center justify-center transition-colors ${
                            field.value === emoji 
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background" 
                              : "bg-muted hover:bg-muted/80 text-foreground"
                          }`}
                          onClick={() => field.onChange(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Daily Journal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-between pt-4 items-center">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive font-medium">Are you sure?</span>
                  <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleteNotebook.isPending}>
                    Yes, Delete
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Notebook
                </Button>
              )}
              
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateNotebook.isPending}
                >
                  {updateNotebook.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
