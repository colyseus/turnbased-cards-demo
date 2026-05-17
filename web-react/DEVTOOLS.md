# DevTools Usage Guide: Benchmarking & Debugging

The **DevTools Dashboard** is a unified internal tool for monitoring performance, stress-testing rendering logic, and debugging the 3D scene in real-time.

## 🚀 Getting Started

### Accessing the Dashboard
- **Click:** Use the small **[DEBUG]** trigger button in the bottom-right corner of the screen.
- **Shortcut:** Press the **`` ` ``** (backtick) key on your keyboard to toggle the panel instantly.

---

## 📊 Performance Monitor

Track the real-time health of the rendering engine.

- **FPS:** Standard Frames Per Second. Turns **red** if performance dips below 30 FPS.
- **Draw Calls:** Shows how many separate commands are sent to the GPU. 
  - *Target:* Should remain extremely low (6-12) due to our `InstancedMesh` implementation.
- **Triangles:** Total polygon count currently being rendered.
- **Frame Time:** The duration (in milliseconds) it takes the CPU/GPU to process a single frame.

### Running a Benchmark
1. Click **Start Benchmark**. The tool will begin recording metrics in the background.
2. Play the game or move the camera to capture varied load.
3. Click **Stop & Record** to finish.
4. Click **Export JSON** to download a detailed report of the session's performance data.

---

## 🧪 Stress Testing

Validate the efficiency of our `InstancedMesh` system by artificially increasing the rendering load.

- **Extra Cards Slider:** Spawns up to **5,000 additional cards** into the scene.
- **Verification:** Notice that while the **Triangle** count increases significantly, the **Draw Calls** remain static. This proves the scalability of the instancing system.
- **Visuals:** The stress-test cards will orbit the center of the table with procedural animations to test matrix update performance.

---

## 🛠️ Debug Toggles

Tools to inspect the underlying structure of the 3D environment.

- **Wireframe Mode:**
  - Toggles the `wireframe` property on all materials in the scene.
  - Use this to verify that **InstancedMesh** objects are correctly positioned and that no unintended geometry is being rendered.
  - Useful for checking Z-fighting and geometry overlap.

---

## 📝 Performance Baseline (Production)

| Metric | Expected Value (Game Idle) | Expected Value (Max Stress) |
| :--- | :--- | :--- |
| **Draw Calls** | 6 - 8 | 6 - 8 |
| **Triangles** | ~2,000 | ~40,000+ |
| **JS Heap** | ~15MB - 30MB | ~40MB - 60MB |

---

## 💡 Pro-Tips
- **Exporting for QA:** If you encounter a performance bug, run a 10-second benchmark and attach the exported `.json` file to the bug report.
- **Mobile Testing:** Use the **Stress Test** to find the "breaking point" of lower-end mobile devices by seeing at what card count the FPS turns red.
