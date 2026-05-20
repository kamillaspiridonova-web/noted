import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { NotebookIcon, MessageSquare, Clock, Search, X } from "lucide-react";
import {
  useListNotebooks,
  useGetRecentNotes,
  useSearchNotes,
  getSearchNotesQueryKey,
  useSearchDocuments,
  getSearchDocumentsQueryKey,
} from "@workspace/api-client-react";
import { formatRelativeTime } from "@/lib/date-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  if (!query) return <>{text}</>;
  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-300/70 text-inherit rounded-[2px] px-[1px]">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { data: notebooks, isLoading } = useListNotebooks();
  const { data: recentNotes, isLoading: recentLoading } = useGetRecentNotes();

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 400 ms debounce
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const isSearching = searchQuery.length > 0;

  const { data: searchResults, isLoading: searchLoading } = useSearchNotes(
    { q: searchQuery },
    {
      query: {
        enabled: isSearching,
        queryKey: getSearchNotesQueryKey({ q: searchQuery }),
      },
    },
  );

  const { data: docResults, isLoading: docLoading } = useSearchDocuments(
    { q: searchQuery },
    {
      query: {
        enabled: isSearching,
        queryKey: getSearchDocumentsQueryKey({ q: searchQuery }),
      },
    },
  );

  const anySearchLoading = searchLoading || docLoading;
  const totalResults = (searchResults?.length ?? 0) + (docResults?.length ?? 0);

  const clearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    searchInputRef.current?.focus();
  };

  return (
    <div className="flex h-dvh w-full bg-background overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col pt-14 md:pt-0 overflow-y-auto">
        <div className="max-w-4xl w-full mx-auto p-6 md:p-10">
          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Good to see you.</h1>
            <p className="text-muted-foreground text-lg mb-6">
              Your private space to think out loud.
            </p>

            {/* Global search bar */}
            <div className="relative flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && clearSearch()}
                placeholder="Search all notebooks…"
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-card border border-border text-[15px] outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition-all placeholder:text-muted-foreground"
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  className="absolute right-1.5 h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </header>

          {isSearching ? (
            /* ── Search results ── */
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Search className="w-4 h-4 text-primary" />
                <h2 className="text-base font-semibold">
                  {anySearchLoading
                    ? "Searching…"
                    : totalResults === 0
                      ? `No results for "${searchQuery}"`
                      : `${totalResults} result${totalResults !== 1 ? "s" : ""} for "${searchQuery}"`}
                </h2>
              </div>

              {anySearchLoading ? (
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : totalResults === 0 ? (
                <div className="text-center py-16 border border-dashed border-border rounded-xl text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Try a different keyword.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Document matches */}
                  {docResults?.map((doc) => (
                    <Link
                      key={`doc-${doc.id}`}
                      href={`/notebooks/${doc.id}`}
                      className="block p-4 rounded-xl bg-card border border-border hover:bg-accent hover:border-accent-border transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base">{doc.emoji}</span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {doc.name}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                          Document
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatRelativeTime(doc.updatedAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 line-clamp-3 leading-relaxed">
                        {doc.contentSnippet
                          ? highlightText(doc.contentSnippet, searchQuery)
                          : "Empty document"}
                      </p>
                    </Link>
                  ))}

                  {/* Note (messenger) matches */}
                  {searchResults?.map((note) => (
                    <Link
                      key={`note-${note.id}`}
                      href={`/notebooks/${note.notebookId}`}
                      className="block p-4 rounded-xl bg-card border border-border hover:bg-accent hover:border-accent-border transition-colors shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-base">{note.notebookEmoji}</span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {note.notebookName}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatRelativeTime(note.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 line-clamp-3 leading-relaxed">
                        {note.content
                          ? highlightText(note.content, searchQuery)
                          : note.attachments?.length
                            ? `[${note.attachments.length} attachment${note.attachments.length > 1 ? "s" : ""}]`
                            : "Empty note"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ) : (
            /* ── Normal home content ── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <section>
                <div className="flex items-center gap-2 mb-6">
                  <NotebookIcon className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Your Notebooks</h2>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[...Array(4)].map((_, i) => (
                      <Skeleton key={i} className="h-32 rounded-xl" />
                    ))}
                  </div>
                ) : notebooks?.length === 0 ? (
                  <div className="text-center py-12 bg-card border border-card-border rounded-xl">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <NotebookIcon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <h3 className="text-base font-medium mb-1">It's quiet in here</h3>
                    <p className="text-sm text-muted-foreground">Create your first notebook.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {notebooks?.map((notebook) => (
                      <Link
                        key={notebook.id}
                        href={`/notebooks/${notebook.id}`}
                        className="group bg-card hover:bg-accent border border-card-border hover:border-accent-border p-5 rounded-xl transition-all hover-elevate shadow-sm flex flex-col h-32"
                      >
                        <div className="flex items-start justify-between mb-auto">
                          <span className="text-3xl leading-none">{notebook.emoji}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(notebook.updatedAt)}
                          </span>
                        </div>
                        <div className="font-semibold truncate">{notebook.name}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-semibold">Recent Notes</h2>
                </div>

                {recentLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-xl" />
                    ))}
                  </div>
                ) : recentNotes?.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-border rounded-xl">
                    <MessageSquare className="w-6 h-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">No recent notes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentNotes?.slice(0, 5).map((note) => (
                      <Link
                        key={note.id}
                        href={`/notebooks/${note.notebookId}`}
                        className="block p-4 rounded-xl bg-card border border-card-border hover:bg-accent hover:border-accent-border transition-colors hover-elevate shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-base">{note.notebookEmoji}</span>
                          <span className="text-xs font-medium text-muted-foreground">
                            {note.notebookName}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatRelativeTime(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2 text-foreground/90">
                          {note.content ||
                            (note.attachments?.length
                              ? `[${note.attachments.length} attachment${note.attachments.length > 1 ? "s" : ""}]`
                              : "Empty note")}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
