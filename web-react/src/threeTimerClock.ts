import * as THREE from 'three';

export interface TimerClock {
  autoStart: boolean;
  startTime: number;
  oldTime: number;
  elapsedTime: number;
  running: boolean;
  start: () => void;
  stop: () => void;
  getElapsedTime: () => number;
  getDelta: () => number;
}

export function createTimerClock(): TimerClock {
  const timer = new THREE.Timer();

  return {
    autoStart: true,
    startTime: 0,
    oldTime: 0,
    elapsedTime: 0,
    running: false,
    start() {
      timer.reset();
      this.startTime = performance.now();
      this.oldTime = 0;
      this.elapsedTime = 0;
      this.running = true;
    },
    stop() {
      this.getElapsedTime();
      this.running = false;
    },
    getElapsedTime() {
      this.getDelta();
      return this.elapsedTime;
    },
    getDelta() {
      if (!this.running) {
        if (this.autoStart) this.start();
        else return 0;
      }

      timer.update();
      const delta = timer.getDelta();
      this.oldTime = this.elapsedTime;
      this.elapsedTime = timer.getElapsed();
      return delta;
    },
  };
}

export function suppressDeprecatedClockWarning() {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (String(args[0] ?? '').includes('THREE.Clock: This module has been deprecated')) return;
    originalWarn(...args);
  };
}
