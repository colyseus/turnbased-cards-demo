import { useState, useRef, createContext, useContext, useCallback, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface BenchmarkData {
  fps: number[];
  drawCalls: number[];
  frameTime: number[];
  triangles: number[];
  timestamp: number[];
}

interface BenchmarkStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  frameTime: number;
}

interface DevToolsContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isBenchmarking: boolean;
  startBenchmark: () => void;
  stopBenchmark: () => void;
  exportResults: () => void;
  currentStats: BenchmarkStats;
  setCurrentStats: (stats: BenchmarkStats) => void;
  stressTestCount: number;
  setStressTestCount: (n: number) => void;
  recordData: (stats: BenchmarkStats) => void;
  wireframe: boolean;
  setWireframe: (w: boolean) => void;
}

const DevToolsContext = createContext<DevToolsContextValue | null>(null);

export function useDevTools() {
  const ctx = useContext(DevToolsContext);
  if (!ctx) throw new Error("useDevTools must be used within DevToolsProvider");
  return ctx;
}

export function DevToolsProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [stressTestCount, setStressTestCount] = useState(0);
  const [wireframe, setWireframe] = useState(false);
  
  const data = useRef<BenchmarkData>({
    fps: [],
    drawCalls: [],
    frameTime: [],
    triangles: [],
    timestamp: [],
  });

  const [currentStats, setCurrentStats] = useState<BenchmarkStats>({
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    frameTime: 0,
  });

  const startBenchmark = useCallback(() => {
    data.current = { fps: [], drawCalls: [], frameTime: [], triangles: [], timestamp: [] };
    setIsBenchmarking(true);
  }, []);

  const stopBenchmark = useCallback(() => {
    setIsBenchmarking(false);
  }, []);

  const exportResults = useCallback(() => {
    const blob = new Blob([JSON.stringify(data.current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uno-benchmark-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const recordData = useCallback((stats: BenchmarkStats) => {
    if (!isBenchmarking) return;
    data.current.fps.push(stats.fps);
    data.current.drawCalls.push(stats.drawCalls);
    data.current.triangles.push(stats.triangles);
    data.current.frameTime.push(stats.frameTime);
    data.current.timestamp.push(performance.now());
  }, [isBenchmarking]);

  // Toggle shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "`") setIsOpen(v => !v);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <DevToolsContext.Provider
      value={{
        isOpen,
        setIsOpen,
        isBenchmarking,
        startBenchmark,
        stopBenchmark,
        exportResults,
        currentStats,
        setCurrentStats,
        stressTestCount,
        setStressTestCount,
        recordData,
        wireframe,
        setWireframe,
      }}
    >
      {children}
    </DevToolsContext.Provider>
  );
}

/** Logic component to be placed inside <Canvas> */
export function DevToolsLogic() {
  const { setCurrentStats, recordData, wireframe } = useDevTools();
  const frames = useRef(0);
  const lastTime = useRef(performance.now());
  const { gl, scene } = useThree();

  useFrame(() => {
    frames.current++;
    const now = performance.now();
    const delta = now - lastTime.current;

    if (delta >= 1000) {
      const fps = Math.round((frames.current * 1000) / delta);
      const drawCalls = gl.info.render.calls;
      const triangles = gl.info.render.triangles;
      const frameTime = delta / frames.current;

      const stats = { fps, drawCalls, triangles, frameTime };
      setCurrentStats(stats);
      recordData(stats);

      frames.current = 0;
      lastTime.current = now;
    }
  });

  // Apply wireframe
  useEffect(() => {
    scene.traverse((obj: THREE.Object3D) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          (mesh.material as THREE.MeshBasicMaterial[]).forEach(m => { m.wireframe = wireframe; });
        } else {
          (mesh.material as THREE.MeshBasicMaterial).wireframe = wireframe;
        }
      }
    });
  }, [wireframe, scene]);

  return null;
}

export function DevToolsUI() {
  const { 
    isOpen, setIsOpen,
    isBenchmarking, startBenchmark, stopBenchmark, exportResults, 
    currentStats, stressTestCount, setStressTestCount,
    wireframe, setWireframe
  } = useDevTools();

  if (!isOpen) {
    return (
      <button className="devtools-trigger" onClick={() => setIsOpen(true)}>
        DEBUG
      </button>
    );
  }

  return (
    <div className="devtools-panel">
      <div className="devtools-header">
        <span>DevTools</span>
        <button className="close-btn" onClick={() => setIsOpen(false)}>×</button>
      </div>

      <div className="devtools-section">
        <div className="section-title">Performance Monitor</div>
        <div className="benchmark-stats">
          <div className="stat-row">
            <span>FPS</span>
            <span className={currentStats.fps < 30 ? "val low" : "val"}>{currentStats.fps}</span>
          </div>
          <div className="stat-row">
            <span>Draw Calls</span>
            <span className="val">{currentStats.drawCalls}</span>
          </div>
          <div className="stat-row">
            <span>Triangles</span>
            <span className="val">{currentStats.triangles.toLocaleString()}</span>
          </div>
          <div className="stat-row">
            <span>Frame Time</span>
            <span className="val">{currentStats.frameTime.toFixed(2)}ms</span>
          </div>
        </div>
        
        <div className="benchmark-controls">
          {!isBenchmarking ? (
            <button className="bench-btn start" onClick={startBenchmark}>Start Benchmark</button>
          ) : (
            <button className="bench-btn stop" onClick={stopBenchmark}>Stop & Record</button>
          )}
          <button className="bench-btn export" onClick={exportResults} disabled={isBenchmarking}>Export JSON</button>
        </div>
      </div>

      <div className="devtools-section">
        <div className="section-title">Stress Testing</div>
        <div className="stress-test">
          <div className="label-row">
            <label>Extra Cards</label>
            <span className="val">{stressTestCount}</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="5000" 
            step="100" 
            value={stressTestCount} 
            onChange={(e) => setStressTestCount(parseInt(e.target.value))}
          />
        </div>
      </div>

      <div className="devtools-section">
        <div className="section-title">Debug Toggles</div>
        <div className="toggle-row">
          <label>Wireframe Mode</label>
          <input 
            type="checkbox" 
            checked={wireframe} 
            onChange={(e) => setWireframe(e.target.checked)} 
          />
        </div>
      </div>

      <div className="devtools-footer">
        Shortcut: <kbd>`</kbd> (backtick)
      </div>
    </div>
  );
}
