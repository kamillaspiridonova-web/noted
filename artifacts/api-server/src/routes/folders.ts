import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, foldersTable } from "@workspace/db";
import {
  ListFoldersResponse,
  CreateFolderBody,
  UpdateFolderParams,
  UpdateFolderBody,
  UpdateFolderResponse,
  DeleteFolderParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/folders", async (req, res): Promise<void> => {
  const folders = await db
    .select()
    .from(foldersTable)
    .where(eq(foldersTable.userId, req.userId!))
    .orderBy(desc(foldersTable.updatedAt));
  res.json(ListFoldersResponse.parse(folders));
});

router.post("/folders", async (req, res): Promise<void> => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [folder] = await db
    .insert(foldersTable)
    .values({
      userId: req.userId!,
      name: parsed.data.name,
      emoji: parsed.data.emoji ?? "📁",
    })
    .returning();

  res.status(201).json(folder);
});

router.patch("/folders/:id", async (req, res): Promise<void> => {
  const params = UpdateFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.emoji !== undefined) updateData.emoji = parsed.data.emoji;

  const [folder] = await db
    .update(foldersTable)
    .set(updateData)
    .where(and(eq(foldersTable.id, params.data.id), eq(foldersTable.userId, req.userId!)))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.json(UpdateFolderResponse.parse(folder));
});

router.delete("/folders/:id", async (req, res): Promise<void> => {
  const params = DeleteFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [folder] = await db
    .delete(foldersTable)
    .where(and(eq(foldersTable.id, params.data.id), eq(foldersTable.userId, req.userId!)))
    .returning();

  if (!folder) {
    res.status(404).json({ error: "Folder not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
