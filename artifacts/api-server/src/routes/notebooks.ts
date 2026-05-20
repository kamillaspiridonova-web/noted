import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { eq, desc, count, and, ilike } from "drizzle-orm";
import { db, notebooksTable, notesTable, attachmentsTable } from "@workspace/db";
import {
  ListNotebooksResponse,
  CreateNotebookBody,
  GetNotebookParams,
  GetNotebookResponse,
  UpdateNotebookParams,
  UpdateNotebookBody,
  UpdateNotebookResponse,
  DeleteNotebookParams,
  GetNotebookStatsParams,
  GetNotebookStatsResponse,
  SearchDocumentsResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

/** Strip HTML tags and collapse whitespace for a plain-text snippet. */
function htmlToSnippet(html: string, maxLen = 200): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

const router: IRouter = Router();

router.use(requireAuth);

router.get("/notebooks", async (req, res): Promise<void> => {
  const notebooks = await db
    .select()
    .from(notebooksTable)
    .where(eq(notebooksTable.userId, req.userId!))
    .orderBy(desc(notebooksTable.updatedAt));
  res.json(ListNotebooksResponse.parse(notebooks));
});

router.post("/notebooks", async (req, res): Promise<void> => {
  const parsed = CreateNotebookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [notebook] = await db
    .insert(notebooksTable)
    .values({
      userId: req.userId!,
      name: parsed.data.name,
      emoji: parsed.data.emoji ?? "📓",
      type: parsed.data.type ?? "messenger",
      folderId: parsed.data.folderId ?? null,
    })
    .returning();

  res.status(201).json(GetNotebookResponse.parse(notebook));
});

router.get("/notebooks/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }

  const docs = await db
    .select({
      id: notebooksTable.id,
      name: notebooksTable.name,
      emoji: notebooksTable.emoji,
      documentContent: notebooksTable.documentContent,
      updatedAt: notebooksTable.updatedAt,
    })
    .from(notebooksTable)
    .where(
      and(
        eq(notebooksTable.userId, req.userId!),
        eq(notebooksTable.type, "document"),
        ilike(notebooksTable.documentContent, `%${q}%`),
      ),
    )
    .orderBy(desc(notebooksTable.updatedAt))
    .limit(50);

  const results = docs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    emoji: doc.emoji,
    contentSnippet: htmlToSnippet(doc.documentContent ?? ""),
    updatedAt: doc.updatedAt,
  }));

  res.json(SearchDocumentsResponse.parse(results));
});

router.get("/notebooks/:id", async (req, res): Promise<void> => {
  const params = GetNotebookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [notebook] = await db
    .select()
    .from(notebooksTable)
    .where(and(eq(notebooksTable.id, params.data.id), eq(notebooksTable.userId, req.userId!)));

  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  res.json(GetNotebookResponse.parse(notebook));
});

router.patch("/notebooks/:id", async (req, res): Promise<void> => {
  const params = UpdateNotebookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNotebookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.emoji !== undefined) updateData.emoji = parsed.data.emoji;
  if (parsed.data.documentContent !== undefined) updateData.documentContent = parsed.data.documentContent;
  if (parsed.data.folderId !== undefined) updateData.folderId = parsed.data.folderId ?? null;

  const [notebook] = await db
    .update(notebooksTable)
    .set(updateData)
    .where(and(eq(notebooksTable.id, params.data.id), eq(notebooksTable.userId, req.userId!)))
    .returning();

  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  res.json(UpdateNotebookResponse.parse(notebook));
});

router.delete("/notebooks/:id", async (req, res): Promise<void> => {
  const params = DeleteNotebookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [notebook] = await db
    .delete(notebooksTable)
    .where(and(eq(notebooksTable.id, params.data.id), eq(notebooksTable.userId, req.userId!)))
    .returning();

  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/notebooks/:id/stats", async (req, res): Promise<void> => {
  const params = GetNotebookStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [notebook] = await db
    .select({ id: notebooksTable.id })
    .from(notebooksTable)
    .where(and(eq(notebooksTable.id, params.data.id), eq(notebooksTable.userId, req.userId!)));

  if (!notebook) {
    res.status(404).json({ error: "Notebook not found" });
    return;
  }

  const [noteCountResult] = await db
    .select({ value: count() })
    .from(notesTable)
    .where(eq(notesTable.notebookId, params.data.id));

  const [attachmentCountResult] = await db
    .select({ value: count() })
    .from(attachmentsTable)
    .innerJoin(notesTable, eq(attachmentsTable.noteId, notesTable.id))
    .where(eq(notesTable.notebookId, params.data.id));

  const [lastNoteResult] = await db
    .select({ createdAt: notesTable.createdAt })
    .from(notesTable)
    .where(eq(notesTable.notebookId, params.data.id))
    .orderBy(desc(notesTable.createdAt))
    .limit(1);

  res.json(
    GetNotebookStatsResponse.parse({
      noteCount: noteCountResult?.value ?? 0,
      attachmentCount: attachmentCountResult?.value ?? 0,
      lastActivityAt: lastNoteResult?.createdAt?.toISOString() ?? null,
    }),
  );
});

/**
 * GET /notebooks/:id/images/*path
 *
 * Serve an image embedded in a document notebook.
 * Ownership is verified by checking that the notebook belongs to the
 * authenticated user — no content scan required, so timing-safe.
 */
const objectStorageService = new ObjectStorageService();

router.get(
  "/notebooks/:id/images/*path",
  requireAuth,
  async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const notebookId = parseInt(Array.isArray(rawId) ? rawId[0] : rawId, 10);
    if (isNaN(notebookId)) {
      res.status(400).json({ error: "Invalid notebook id" });
      return;
    }

    const [notebook] = await db
      .select({ id: notebooksTable.id })
      .from(notebooksTable)
      .where(and(eq(notebooksTable.id, notebookId), eq(notebooksTable.userId, req.userId!)))
      .limit(1);

    if (!notebook) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/${wildcardPath}`;

      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Image not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving document image");
      res.status(500).json({ error: "Failed to serve image" });
    }
  },
);

export default router;
