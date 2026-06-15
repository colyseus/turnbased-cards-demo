import express from "express";
import type { Application } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { logger } from "../logger.ts";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

export function applyMiddleware(app: Application): void {
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: "16kb" }));

  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, "request");
    next();
  });

  app.use("/metrics", apiRateLimiter);
  app.use("/healthz", apiRateLimiter);
}
