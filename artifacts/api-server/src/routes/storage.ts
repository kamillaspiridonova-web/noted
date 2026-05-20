import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { eq, and, like } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, attachmentsTable, notesTable, notebooksTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Requires authentication — only signed-in users may upload files.
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities from PRIVATE_OBJECT_DIR.
 * Requires authentication. Verifies the requesting user owns the attachment
 * (notebook.userId must match req.userId) before streaming the file.
 */
router.get(
  "/storage/objects/*path",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;

      // Ownership check 1: file is a messenger-notebook attachment belonging to this user
      const [attachment] = await db
        .select({ id: attachmentsTable.id })
        .from(attachmentsTable)
        .innerJoin(notesTable, eq(notesTable.id, attachmentsTable.noteId))
        .innerJoin(notebooksTable, eq(notebooksTable.id, notesTable.notebookId))
        .where(
          and(
            eq(attachmentsTable.objectPath, objectPath),
            eq(notebooksTable.userId, req.userId!),
          ),
        )
        .limit(1);

      if (!attachment) {
        // Ownership check 2: file is embedded in a document notebook owned by this user
        const [docNotebook] = await db
          .select({ id: notebooksTable.id })
          .from(notebooksTable)
          .where(
            and(
              eq(notebooksTable.userId, req.userId!),
              like(notebooksTable.documentContent, `%${objectPath}%`),
            ),
          )
          .limit(1);

        if (!docNotebook) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
      }

      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      const response = await objectStorageService.downloadObject(objectFile);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      // Force download with the original filename when ?filename= is provided
      const filename = req.query["filename"];
      if (typeof filename === "string" && filename.length > 0) {
        const safe = filename.replace(/[^\w.\-() ]/g, "_");
        res.setHeader("Content-Disposition", `attachment; filename="${safe}"`);
      }

      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;
