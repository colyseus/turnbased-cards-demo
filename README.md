# "UNO" Playing Cards Demo

A 3D interactive Uno card game built with R3F (React + Three.js). Single-player against 3 AI opponents.

(This project is going to be used as multiplayer demo for [Colyseus](https://colyseus.io/), but the single-player version is looking okay, so I decided to share it!)

https://github.com/user-attachments/assets/c569cb71-a366-4a22-8e40-79bcdb281ca3

## Features

- Full 108-card Uno deck with standard rules (Skip, Reverse, Draw 2, Wild, Wild Draw 4)
- 3D card rendering with spring physics animations
- Lobby screen with name entry
- Turn-based play against 3 AI players
- Color picker for wild cards
- Winner screen with restart

## Dependencies

### Runtime

| Package | Description |
|---------|-------------|
| [react](https://react.dev/) | UI framework |
| [react-dom](https://react.dev/) | React DOM renderer |
| [three](https://threejs.org/) | 3D graphics library |
| [@react-three/fiber](https://r3f.docs.pmnd.rs/) | React renderer for Three.js |

## Getting Started

```bash
npm install
npm run dev
```
