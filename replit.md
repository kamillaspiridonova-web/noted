# Noted

A private local notes app where you write notes to yourself in a WhatsApp/Telegram-style message format, organized into notebooks, with support for file attachments (images, docs, Excel, MP4, MP3).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/noted run dev` — run the frontend (port assigned by workflow)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR` — object storage

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, shadcn/ui, TanStack Query, wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- File storage: Replit Object Storage (GCS-backed, presigned URL uploads)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all API contracts)
- `lib/db/src/schema/` — Drizzle schema files: `notebooks.ts`, `notes.ts`, `attachments.ts`
- `artifacts/api-server/src/routes/` — API route handlers: `notebooks.ts`, `notes.ts`, `storage.ts`
- `artifacts/api-server/src/lib/` — `objectStorage.ts`, `objectAcl.ts` — GCS wrapper and ACL
- `artifacts/noted/src/` — React frontend
- `lib/object-storage-web/` — Client-side upload utilities (ObjectUploader, useUpload)

## Architecture decisions

- Chat-bubble UI: notes appear as message bubbles, newest at bottom — same mental model as WhatsApp/Telegram
- Notebooks as "chats": each notebook is a separate thread/channel for a topic area
- Presigned URL upload flow: frontend requests a signed URL from the API, then uploads directly to GCS — server never proxies file bytes
- objectPath stored in DB: attachments store the `/objects/...` path, served via `/api/storage/objects${objectPath}`
- Authentication: Clerk email/password auth; each user's notebooks are isolated by `userId` in the DB
  - In production: Clerk proxy mode via `clerkProxyMiddleware` (proxies `/clerk/` → Clerk CDN) + `publishableKeyFromHost`
  - In dev preview: Clerk can't reach `clerk.localhost` through Replit's iframe proxy — `IS_DEV_BUILD` (Vite's `import.meta.env.DEV`) skips the loading wait and shows the landing page immediately; `/sign-in` and `/sign-up` show a "publish to try auth" placeholder
  - `requireAuth` middleware sets `req.userId` from the Clerk session token; all notebook/note routes are scoped by this userId

## Product

- Home screen: list of all notebooks + recent notes feed across all notebooks
- Notebook view: scrollable message thread with compose area at the bottom
- Attach files: click the paperclip icon to attach images, docs, Excel, MP4, MP3
- Attachment display: images inline, audio/video with native player, docs as downloadable file cards
- Create/manage notebooks with custom emoji icons

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After changing `openapi.yaml`, always run codegen before updating routes or frontend
- File uploads use presigned URLs — the file goes directly to GCS, not through the Express server
- The `useListNotes` hook takes params as first arg: `useListNotes({ id: notebookId }, options)`
- `pnpm --filter @workspace/db run push-force` if push fails with column conflicts

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
