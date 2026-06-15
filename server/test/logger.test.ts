import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInfo = vi.fn();
const mockError = vi.fn();
const mockWarn = vi.fn();
const mockDebug = vi.fn();
const mockChild = vi.fn(() => ({
  info: mockInfo,
  error: mockError,
  warn: mockWarn,
  debug: mockDebug,
  child: mockChild,
}));

vi.mock("pino", () => ({
  default: vi.fn(() => ({
    info: mockInfo,
    error: mockError,
    warn: mockWarn,
    debug: mockDebug,
    child: mockChild,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("logger", () => {
  it("exports a pino logger instance", async () => {
    const { logger } = await import("../src/logger.ts");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("creates pino with correct options", async () => {
    const pino = (await import("pino")).default as ReturnType<typeof vi.fn>;
    await import("../src/logger.ts");
    expect(pino).toHaveBeenCalled();
    const opts = pino.mock.calls[0][0];
    expect(opts.level).toBe("info");
  });

  it("respects LOG_LEVEL environment variable", async () => {
    const original = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = "warn";
    vi.resetModules();

    const pino = (await import("pino")).default as ReturnType<typeof vi.fn>;
    await import("../src/logger.ts");
    const opts = pino.mock.calls[0][0];
    expect(opts.level).toBe("warn");

    process.env.LOG_LEVEL = original || "";
  });

  it("child loggers are created with namespace", async () => {
    const { logger } = await import("../src/logger.ts");
    const child = logger.child({ ns: "TestRoom" });
    expect(mockChild).toHaveBeenCalledWith({ ns: "TestRoom" });
    expect(child).toBeDefined();
    expect(typeof child.info).toBe("function");
  });

  it("child logger passes metadata to info", async () => {
    const { logger } = await import("../src/logger.ts");
    const child = logger.child({ ns: "UnoRoom" });
    child.info({ sessionId: "abc", seatIndex: 2 }, "Player joined");

    expect(mockInfo).toHaveBeenCalledWith(
      { sessionId: "abc", seatIndex: 2 },
      "Player joined",
    );
  });

  it("child logger passes error objects", async () => {
    const { logger } = await import("../src/logger.ts");
    const child = logger.child({ ns: "UnoRoom" });
    const error = new Error("test error");
    child.error({ err: error }, "something failed");

    expect(mockError).toHaveBeenCalledWith(
      { err: error },
      "something failed",
    );
  });

  it("child logger passes string-only messages", async () => {
    const { logger } = await import("../src/logger.ts");
    const child = logger.child({ ns: "DemoRoom" });
    child.info("Game started");

    expect(mockInfo).toHaveBeenCalledWith("Game started");
  });
});
