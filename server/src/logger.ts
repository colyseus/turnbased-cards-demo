import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const transport = isDev
  ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
  : undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  ...(transport && { transport }),
});
