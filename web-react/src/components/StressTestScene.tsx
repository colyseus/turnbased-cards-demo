import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { InstancedCards, CardData } from './game/InstancedCards';
import { Table } from './game/Table';
import { DevToolsProvider, DevToolsUI, DevToolsLogic, useDevTools } from './DevTools';
import { TextureProvider } from './Preloader';

function StressTestCards() {
  const { stressTestCount } = useDevTools();

  const cards = useMemo(() => {
    const list: CardData[] = [];
    const count = Math.max(stressTestCount, 500); // minimum 500 for the "stress" feel
    const textureIds = [
      'red_0',
      'red_1',
      'red_2',
      'blue_0',
      'blue_1',
      'blue_2',
      'green_0',
      'green_1',
      'green_2',
      'yellow_0',
      'yellow_1',
      'yellow_2',
      'back',
    ];

    for (let i = 0; i < count; i++) {
      list.push({
        id: `stress-${i}`,
        textureId: textureIds[i % textureIds.length],
        position: [0, 0, 0], // will be updated in frame
        rotationZ: 0,
        faceUp: true,
        scale: 0.5,
      });
    }
    return list;
  }, [stressTestCount]);

  // Procedural movement logic for stress test
  const cardDataRef = useRef(cards);
  cardDataRef.current = cards;

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    cardDataRef.current.forEach((card, i) => {
      const angle = (i / cardDataRef.current.length) * Math.PI * 2 + time * 0.2;
      const r = 3 + Math.sin(time * 0.5 + i * 0.1) * 2;
      card.position[0] = Math.cos(angle) * r;
      card.position[1] = Math.sin(angle) * r;
      card.position[2] = Math.sin(time + i * 0.05) * 0.5;
      card.rotationZ = angle + Math.PI / 2;
    });
  });

  return <InstancedCards cards={cards} />;
}

function StressTestSceneInner({ onBack }: { onBack: () => void }) {
  return (
    <>
      <div className="stress-test-overlay">
        <button className="hud-btn back-btn" onClick={onBack}>
          ← Back to Lobby
        </button>
        <div className="stress-test-title">Rendering Stress Test</div>
      </div>

      <Canvas
        camera={{ position: [0, -2, 12], fov: 45 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={2.0} />
        <pointLight position={[10, 10, 10]} intensity={1.5} />
        <TextureProvider>
          <Table />
          <StressTestCards />
          <DevToolsLogic />
        </TextureProvider>
      </Canvas>

      <DevToolsUI />
    </>
  );
}

export default function StressTestScene(props: { onBack: () => void }) {
  return (
    <DevToolsProvider>
      <StressTestSceneInner {...props} />
    </DevToolsProvider>
  );
}
