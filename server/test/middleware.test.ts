import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mockHelmet = vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Test-Helmet", "applied");
  next();
});

const mockCors = vi.fn(() => (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Test-Cors", "applied");
  next();
});

const mockJsonParser = vi.fn(() => (req: Request, res: Response, next: NextFunction) => next());
const mockJsonParserCalls: Array<{ limit: string }> = [];

vi.mock("../src/logger.ts", () => ({
  logger: { info: vi.fn() },
}));

vi.mock("helmet", () => ({ default: mockHelmet }));
vi.mock("cors", () => ({ default: mockCors }));
vi.mock("express-rate-limit", () => ({
  rateLimit: vi.fn((opts: { windowMs: number; max: number }) => {
    return (req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-Test-RateLimit", `${opts.max}`);
      next();
    };
  }),
}));

vi.mock("express", () => {
  const expressModule = vi.fn(() => ({
    get: vi.fn(),
    post: vi.fn(),
    use: vi.fn(),
  }));
  (expressModule as any).json = vi.fn((opts: any) => {
    mockJsonParserCalls.push(opts);
    return (req: Request, res: Response, next: NextFunction) => next();
  });
  return { default: expressModule, __esModule: true };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockJsonParserCalls.length = 0;
});

function makeFakeApp() {
  const globalMiddlewares: any[] = [];
  const routes: Record<string, any[]> = {};

  const fakeApp = {
    use: vi.fn((...args: any[]) => {
      if (typeof args[0] === "string") {
        routes[args[0]] = routes[args[0]] || [];
        routes[args[0]].push(args[1]);
      } else {
        globalMiddlewares.push(args[0]);
      }
    }),
    get: vi.fn((path: string, ...handlers: any[]) => {
      routes[path] = handlers;
    }),
    post: vi.fn((path: string, ...handlers: any[]) => {
      routes[path] = handlers;
    }),
  };

  return { fakeApp, globalMiddlewares, routes };
}

describe("middleware", () => {
  it("applies helmet middleware", async () => {
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    expect(mockHelmet).toHaveBeenCalled();
  });

  it("applies cors middleware", async () => {
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    expect(mockCors).toHaveBeenCalled();
  });

  it("registers rate limiter on /metrics endpoint", async () => {
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp, routes } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    expect(routes["/metrics"]).toBeDefined();
    expect(routes["/metrics"].length).toBe(1);
  });

  it("registers rate limiter on /healthz endpoint", async () => {
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp, routes } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    expect(routes["/healthz"]).toBeDefined();
    expect(routes["/healthz"].length).toBe(1);
  });

  it("configures body size limit to 16kb via express.json", async () => {
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    expect(mockJsonParserCalls).toEqual(
      expect.arrayContaining([expect.objectContaining({ limit: "16kb" })])
    );
  });

  it("registers 4 global middleware (helmet, cors, json parser, logger)", async () => {
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp, globalMiddlewares } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    expect(globalMiddlewares.length).toBe(4);
  });

  it("logger middleware logs method and url then calls next", async () => {
    const { logger } = await import("../src/logger.ts");
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp, globalMiddlewares } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    const logMiddleware = globalMiddlewares[globalMiddlewares.length - 1];
    const mockReq = { method: "POST", url: "/api/games" };
    const mockRes = {};
    const mockNext = vi.fn();

    logMiddleware(mockReq, mockRes, mockNext);

    expect(logger.info).toHaveBeenCalledWith(
      { method: "POST", url: "/api/games" },
      "request"
    );
    expect(mockNext).toHaveBeenCalled();
  });

  it("rate limiter middleware passes through to next", async () => {
    const { applyMiddleware } = await import("../src/middleware/index.ts");
    const { fakeApp, routes } = makeFakeApp();
    applyMiddleware(fakeApp as any);

    const limiter = routes["/metrics"][0];
    const mockReq = {};
    const mockRes = { setHeader: vi.fn() };
    const mockNext = vi.fn();

    limiter(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Test-RateLimit", expect.any(String));
  });
});
