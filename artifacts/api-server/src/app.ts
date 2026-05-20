import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the Replit reverse proxy so that req.ip / req.ips reflect the real
// client IP from X-Forwarded-For, rather than the container's loopback address.
app.set("trust proxy", true);

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    // Allow inline scripts/styles only for the Clerk proxy iframes
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ── Clerk proxy (production only) ─────────────────────────────────────────────
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── CORS ──────────────────────────────────────────────────────────────────────
// Only allow requests that originate from our own Replit domains.
// REPLIT_DOMAINS is a comma-separated list supplied by the platform in production;
// in dev it is undefined, so we fall back to same-origin only.
const allowedOrigins = new Set<string>(
  (process.env.REPLIT_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .flatMap((d) => [`https://${d}`, `http://${d}`]),
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      // Same-origin requests have no Origin header → always allow
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Dev: allow localhost and Replit dev domains
      if (
        process.env.NODE_ENV !== "production" ||
        /^https?:\/\/([a-z0-9-]+\.)?replit\.dev(:\d+)?$/.test(origin) ||
        /^https?:\/\/localhost(:\d+)?$/.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// General: 200 requests per minute per IP
const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
  skip: (req) => req.path === "/api/healthz",
});

// Stricter: 30 upload-URL requests per minute (protects storage costs)
const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Upload rate limit reached, please wait." },
});

app.use(generalLimiter);
app.use("/api/storage/uploads", uploadLimiter);

// ── Clerk session middleware ───────────────────────────────────────────────────
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── 404 catch-all ─────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
