import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { analyzer } from "vite-bundle-analyzer";

const r3fTimerClockAdapter = `
class R3FTimerClock {
  constructor() {
    this.timer = new THREE.Timer();
    this.running = true;
    this.elapsedTime = 0;
    this.oldTime = 0;
    if (typeof document !== 'undefined') this.timer.connect(document);
    this.timer.reset();
  }
  start() {
    this.running = true;
    this.elapsedTime = 0;
    this.oldTime = 0;
    this.timer.reset();
  }
  stop() {
    this.running = false;
  }
  getDelta() {
    if (!this.running) return 0;
    this.timer.update();
    const delta = this.timer.getDelta();
    this.oldTime = this.elapsedTime;
    this.elapsedTime += delta;
    return delta;
  }
  getElapsedTime() {
    return this.elapsedTime;
  }
}
`;

function r3fTimerClockPlugin() {
  return {
    name: "r3f-timer-clock",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.includes("@react-three/fiber/dist/") || !code.includes("new THREE.Clock()")) {
        return null;
      }

      return {
        code: code
          .replace("var threeTypes =", `${r3fTimerClockAdapter}\nvar threeTypes =`)
          .replaceAll("new THREE.Clock()", "new R3FTimerClock()"),
        map: null,
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: process.env.BASE_URL || "/",
  plugins: [
    r3fTimerClockPlugin(),
    react({
      // React compiler disabled for debugging
    }),
    mode === "analyze" &&
      analyzer({
        analyzerMode: "server",
        openAnalyzer: false,
        reportTitle: "bundle-stats",
      }),
  ],
  build: {
    target: "esnext",
    minify: "esbuild",
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          "three-vendor": ["three"],
          "r3f-vendor": ["@react-three/fiber"],
          "colyseus-vendor": ["@colyseus/sdk", "@colyseus/react"],
        },
      },
    },
  },
}));
