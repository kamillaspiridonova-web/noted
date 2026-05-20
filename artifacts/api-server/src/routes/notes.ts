import { Router, type IRouter } from "express";
import { eq, asc, desc, inArray, and, ilike } from "drizzle-orm";
import { db, notesTable, notebooksTable, attachmentsTable } from "@workspace/db";
import {
  ListNotesParams,
  ListNotesQueryParams,
  ListNotesResponse,
  CreateNoteParams,
  CreateNoteBody,
  UpdateNoteParams,
  UpdateNoteBody,
  DeleteNoteParams,
  GetRecentNotesResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

async function getNotesWithAttachments(noteIds: number[]) {
  if (noteIds.length === 0) return [];
  const attachments = await db
    .select()
    .from(attachmentsTable)
    .where(inArray(attachmentsTable.noteId, noteIds));

  return attachments;
}

router.get("/notebooks/:id/notes", async (req, res): Promise<void> => {
  const params = ListNotesParams.safeParse(req.params);
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

  const queryParams = ListNotesQueryParams.safeParse(req.query);
  const q = queryParams.success ? queryParams.data.q : undefined;

  const whereClause = q
    ? and(eq(notesTable.notebookId, params.data.id), ilike(notesTable.content, `%${q}%`))
    : eq(notesTable.notebookId, params.data.id);

  const notes = await db
    .select()
    .from(notesTable)
    .where(whereClause)
    .orderBy(asc(notesTable.createdAt));

  const noteIds = notes.map((n) => n.id);
  const attachments = await getNotesWithAttachments(noteIds);

  const notesWithAttachments = notes.map((note) => ({
    ...note,
    attachments: attachments.filter((a) => a.noteId === note.id),
  }));

  res.json(ListNotesResponse.parse(notesWithAttachments));
});

router.post("/notebooks/:id/notes", async (req, res): Promise<void> => {
  const params = CreateNoteParams.safeParse(req.params);
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

  const parsed = CreateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [note] = await db
    .insert(notesTable)
    .values({
      notebookId: params.data.id,
      content: parsed.data.content ?? "",
      type: parsed.data.type ?? "text",
      listItems: parsed.data.listItems ?? null,
    })
    .returning();

  let attachments: typeof attachmentsTable.$inferSelect[] = [];

  if (parsed.data.attachments && parsed.data.attachments.length > 0) {
    attachments = await db
      .insert(attachmentsTable)
      .values(
        parsed.data.attachments.map((a) => ({
          noteId: note.id,
          objectPath: a.objectPath,
          fileName: a.fileName,
          fileType: a.fileType,
          fileSize: a.fileSize,
        })),
      )
      .returning();
  }

  res.status(201).json({ ...note, attachments });
});

router.patch("/notes/:id", async (req, res): Promise<void> => {
  const params = UpdateNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateNoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [owned] = await db
    .select({ id: notesTable.id })
    .from(notesTable)
    .innerJoin(
      notebooksTable,
      and(eq(notesTable.notebookId, notebooksTable.id), eq(notebooksTable.userId, req.userId!)),
    )
    .where(eq(notesTable.id, params.data.id));

  if (!owned) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const updateFields: Record<string, unknown> = {};
  if (parsed.data.content !== undefined) updateFields.content = parsed.data.content;
  if (parsed.data.listItems !== undefined) updateFields.listItems = parsed.data.listItems;

  const [note] = await db
    .update(notesTable)
    .set(updateFields)
    .where(eq(notesTable.id, params.data.id))
    .returning();

  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const attachments = await getNotesWithAttachments([note.id]);
  res.json({ ...note, attachments });
});

router.delete("/notes/:id", async (req, res): Promise<void> => {
  const params = DeleteNoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [owned] = await db
    .select({ id: notesTable.id })
    .from(notesTable)
    .innerJoin(
      notebooksTable,
      and(eq(notesTable.notebookId, notebooksTable.id), eq(notebooksTable.userId, req.userId!)),
    )
    .where(eq(notesTable.id, params.data.id));

  if (!owned) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  await db.delete(notesTable).where(eq(notesTable.id, params.data.id));

  res.sendStatus(204);
});

router.get("/notes/search", async (req, res): Promise<void> => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) {
    res.json([]);
    return;
  }

  const notes = await db
    .select({
      id: notesTable.id,
      notebookId: notesTable.notebookId,
      notebookName: notebooksTable.name,
      notebookEmoji: notebooksTable.emoji,
      type: notesTable.type,
      content: notesTable.content,
      listItems: notesTable.listItems,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .innerJoin(
      notebooksTable,
      and(eq(notesTable.notebookId, notebooksTable.id), eq(notebooksTable.userId, req.userId!)),
    )
    .where(ilike(notesTable.content, `%${q}%`))
    .orderBy(desc(notesTable.createdAt))
    .limit(100);

  const noteIds = notes.map((n) => n.id);
  const attachments = await getNotesWithAttachments(noteIds);

  const result = notes.map((note) => ({
    ...note,
    attachments: attachments.filter((a) => a.noteId === note.id),
  }));

  res.json(GetRecentNotesResponse.parse(result));
});

router.get("/notes/recent", async (req, res): Promise<void> => {
  const notes = await db
    .select({
      id: notesTable.id,
      notebookId: notesTable.notebookId,
      notebookName: notebooksTable.name,
      notebookEmoji: notebooksTable.emoji,
      content: notesTable.content,
      type: notesTable.type,
      listItems: notesTable.listItems,
      createdAt: notesTable.createdAt,
      updatedAt: notesTable.updatedAt,
    })
    .from(notesTable)
    .innerJoin(
      notebooksTable,
      and(eq(notesTable.notebookId, notebooksTable.id), eq(notebooksTable.userId, req.userId!)),
    )
    .orderBy(desc(notesTable.createdAt))
    .limit(20);

  const noteIds = notes.map((n) => n.id);
  const attachments = await getNotesWithAttachments(noteIds);

  const notesWithAttachments = notes.map((note) => ({
    ...note,
    attachments: attachments.filter((a) => a.noteId === note.id),
  }));

  res.json(GetRecentNotesResponse.parse(notesWithAttachments));
});

export default router;
