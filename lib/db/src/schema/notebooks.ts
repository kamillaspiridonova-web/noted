import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { foldersTable } from "./folders";

export const notebooksTable = pgTable("notebooks", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  folderId: integer("folder_id").references(() => foldersTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("📓"),
  type: text("type").notNull().default("messenger"),
  documentContent: text("document_content"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNotebookSchema = createInsertSchema(notebooksTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotebook = z.infer<typeof insertNotebookSchema>;
export type Notebook = typeof notebooksTable.$inferSelect;
