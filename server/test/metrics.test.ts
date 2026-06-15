import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQuery = vi.fn().mockResolvedValue([{ roomId: "1" }, { roomId: "2" }]);
const mockGetGlobalCCU = vi.fn().mockResolvedValue(5);

vi.mock("@colyseus/core", () => ({
  matchMaker: {
    query: mockQuery,
    stats: {
      getGlobalCCU: mockGetGlobalCCU,
    },
  },
}));

let metricsOutput = "";

vi.mock("prom-client", () => {
  const registered: Array<{ type: string; name: string; help: string; value?: number; observations?: number[] }> = [];

  class MockGauge {
    name: string;
    help: string;
    collectFn?: () => void;
    value = 0;

    constructor(opts: any) {
      this.name = opts.name;
      this.help = opts.help;
      this.collectFn = opts.collect;
      registered.push({ type: "gauge", name: opts.name, help: opts.help });
    }

    set(val: number) {
      this.value = val;
      const entry = registered.find((e) => e.name === this.name);
      if (entry) entry.value = val;
    }

    async doCollect() {
      this.collectFn?.();
    }
  }

  class MockHistogram {
    name: string;
    help: string;
    buckets: number[];
    observations: number[] = [];

    constructor(opts: any) {
      this.name = opts.name;
      this.help = opts.help;
      this.buckets = opts.buckets;
      registered.push({ type: "histogram", name: opts.name, help: opts.help, observations: [] });
    }

    observe(val: number) {
      this.observations.push(val);
      const entry = registered.find((e) => e.name === this.name);
      if (entry) entry.observations!.push(val);
    }
  }

  class MockRegistry {
    contentType = "text/plain; version=0.0.4; charset=utf-8";

    async metrics() {
      const lines: string[] = [];
      for (const entry of registered) {
        lines.push(`# HELP ${entry.name} ${entry.help}`);
        lines.push(`# TYPE ${entry.name} ${entry.type}`);
        if (entry.type === "gauge") {
          lines.push(`${entry.name} ${entry.value ?? 0}`);
        } else if (entry.type === "histogram") {
          lines.push(`${entry.name}_count ${(entry.observations ?? []).length}`);
        }
      }
      const output = lines.join("\n");
      metricsOutput = output;
      return output;
    }
  }

  return {
    Registry: MockRegistry,
    Gauge: MockGauge,
    Histogram: MockHistogram,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("metrics", () => {
  it("exports a prom-client Registry", async () => {
    const { register } = await import("../src/metrics.ts");
    expect(register).toBeDefined();
    expect(typeof register.metrics).toBe("function");
  });

  it("exposes colyseus_room_count gauge", async () => {
    const { register } = await import("../src/metrics.ts");
    const output = await register.metrics();
    expect(output).toContain("colyseus_room_count");
    expect(output).toContain("gauge");
  });

  it("exposes colyseus_active_users gauge", async () => {
    const { register } = await import("../src/metrics.ts");
    const output = await register.metrics();
    expect(output).toContain("colyseus_active_users");
  });

  it("exposes process_memory_usage_bytes gauge", async () => {
    const { register } = await import("../src/metrics.ts");
    const output = await register.metrics();
    expect(output).toContain("process_memory_usage_bytes");
  });

  it("exposes game_duration_seconds histogram", async () => {
    const { register } = await import("../src/metrics.ts");
    const output = await register.metrics();
    expect(output).toContain("game_duration_seconds");
    expect(output).toContain("histogram");
  });

  it("roomCount collects from matchMaker.query", async () => {
    const { roomCount } = await import("../src/metrics.ts");
    await (roomCount as any).doCollect();
    expect((roomCount as any).value).toBe(2);
    expect(mockQuery).toHaveBeenCalled();
  });

  it("activeUsers collects from matchMaker.stats.getGlobalCCU", async () => {
    const { activeUsers } = await import("../src/metrics.ts");
    await (activeUsers as any).doCollect();
    expect((activeUsers as any).value).toBe(5);
    expect(mockGetGlobalCCU).toHaveBeenCalled();
  });

  it("memoryUsage collects from process.memoryUsage", async () => {
    const { memoryUsage } = await import("../src/metrics.ts");
    await (memoryUsage as any).doCollect();
    expect((memoryUsage as any).value).toBeGreaterThan(0);
  });

  it("recordGameDuration adds observation to histogram", async () => {
    const { recordGameDuration, gameDuration } = await import("../src/metrics.ts");
    recordGameDuration(45);
    recordGameDuration(120);
    expect((gameDuration as any).observations).toEqual([45, 120]);
  });

  it("returns metrics in prometheus format", async () => {
    const { register } = await import("../src/metrics.ts");
    const output = await register.metrics();
    expect(output).toContain("# HELP");
    expect(output).toContain("# TYPE");
  });
});
