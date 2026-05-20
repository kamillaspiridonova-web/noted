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
import { useCreateNotebook, getListNotebooksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { MessageSquare, FileText } from "lucide-react";

const EMOJI_OPTIONS = ["📓", "💭", "💡", "🎯", "❤️", "📅", "💪", "🌟", "📚", "✨"];

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  emoji: z.string().optional(),
  type: z.enum(["messenger", "document"]),
});

type FormValues = z.infer<typeof formSchema>;

interface CreateNotebookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFolderId?: number | null;
}

export function CreateNotebookDialog({ open, onOpenChange, initialFolderId }: CreateNotebookDialogProps) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const createNotebook = useCreateNotebook();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      emoji: "📓",
      type: "messenger",
    },
  });

  const onSubmit = (data: FormValues) => {
    createNotebook.mutate(
      { data: { name: data.name, emoji: data.emoji, type: data.type, folderId: initialFolderId ?? null } },
      {
        onSuccess: (notebook) => {
          queryClient.invalidateQueries({ queryKey: getListNotebooksQueryKey() });
          onOpenChange(false);
          form.reset();
          setLocation(`/notebooks/${notebook.id}`);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Notebook</DialogTitle>
          <DialogDescription>
            Create a new space for your notes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* Type selector */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => field.onChange("messenger")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                          field.value === "messenger"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-border/80 hover:bg-muted/50"
                        }`}
                      >
                        <MessageSquare className={`w-6 h-6 ${field.value === "messenger" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${field.value === "messenger" ? "text-primary" : "text-muted-foreground"}`}>
                          Messenger
                        </span>
                        <span className="text-[11px] text-muted-foreground text-center leading-tight">
                          Chat-style notes
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => field.onChange("document")}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                          field.value === "document"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-border/80 hover:bg-muted/50"
                        }`}
                      >
                        <FileText className={`w-6 h-6 ${field.value === "document" ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-sm font-medium ${field.value === "document" ? "text-primary" : "text-muted-foreground"}`}>
                          Document
                        </span>
                        <span className="text-[11px] text-muted-foreground text-center leading-tight">
                          Rich text editor
                        </span>
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <Input placeholder="e.g. Daily Journal" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createNotebook.isPending}
              >
                {createNotebook.isPending ? "Creating..." : "Create Notebook"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
