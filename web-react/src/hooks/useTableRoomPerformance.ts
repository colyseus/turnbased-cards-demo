import { useEffect, useRef } from "react";

export interface RenderMetrics {
  renderCount: number;
  lastRenderTime: number;
  avgRenderTime: number;
}

export function useTableRoomPerformance(componentName: string): RenderMetrics {
  const metricsRef = useRef<RenderMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0,
  });

  useEffect(() => {
    const start = performance.now();
    metricsRef.current.renderCount += 1;

    return () => {
      const duration = performance.now() - start;
      metricsRef.current.lastRenderTime = duration;
      metricsRef.current.avgRenderTime =
        (metricsRef.current.avgRenderTime * (metricsRef.current.renderCount - 1) + duration) /
        metricsRef.current.renderCount;

      if (import.meta.env.DEV && metricsRef.current.renderCount % 50 === 0) {
        console.log(
          `[Perf] ${componentName}: ${metricsRef.current.renderCount} renders, ` +
            `avg ${metricsRef.current.avgRenderTime.toFixed(2)}ms, ` +
            `last ${duration.toFixed(2)}ms`,
        );
      }
    };
  });

  return metricsRef.current;
}
