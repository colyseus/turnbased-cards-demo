import { useMemo, useEffect } from "react";
import * as THREE from "three";

// Static shapes moved outside to avoid re-allocation
const ARROW_SHAPE = new THREE.Shape();
ARROW_SHAPE.moveTo(0, 0.4);
ARROW_SHAPE.lineTo(0.3, 0);
ARROW_SHAPE.lineTo(0.1, 0);
ARROW_SHAPE.lineTo(0.1, -0.4);
ARROW_SHAPE.lineTo(-0.1, -0.4);
ARROW_SHAPE.lineTo(-0.1, 0);
ARROW_SHAPE.lineTo(-0.3, 0);
ARROW_SHAPE.closePath();

const DIR_SHAPE = new THREE.Shape();
DIR_SHAPE.absarc(0, 0, 1.2, 0, Math.PI * 0.4, false);
DIR_SHAPE.lineTo(1.1, 1.1);

export function TurnIndicator({
  activePlayerIndex,
  reverse,
}: {
  activePlayerIndex: number;
  reverse: boolean;
}) {
  const rotation = (activePlayerIndex / 4) * Math.PI * 2;
  const directionRotation = reverse ? Math.PI : 0;

  // Memoize geometries
  const arrowGeo = useMemo(() => new THREE.ShapeGeometry(ARROW_SHAPE), []);
  const dirGeo = useMemo(() => new THREE.ShapeGeometry(DIR_SHAPE), []);

  // Cleanup
  useEffect(() => {
    return () => {
      arrowGeo.dispose();
      dirGeo.dispose();
    };
  }, [arrowGeo, dirGeo]);

  return (
    <group position={[0, 0, 0.01]}>
      {/* Player Arrow */}
      <mesh
        rotation={[0, 0, -rotation]}
        position={[
          Math.sin(rotation) * 2.5,
          Math.cos(rotation) * 2.5,
          0.1,
        ]}
        geometry={arrowGeo}
      >
        <meshBasicMaterial color="#ffcc00" />
      </mesh>

      {/* Direction Ring */}
      <group rotation={[0, 0, directionRotation]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={`dir-${i}`}
            rotation={[0, 0, (i / 4) * Math.PI * 2]}
            geometry={dirGeo}
          >
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
