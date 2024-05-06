import "./index.css";
import { createRoot } from 'react-dom/client'
import { Canvas, useFrame } from '@react-three/fiber'
import { Card } from "./components/Card";

createRoot(document.getElementById('root') as HTMLElement).render(
  <Canvas>
    <ambientLight intensity={Math.PI / 2} />
    {/* <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} /> */}
    {/* <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} /> */}

    <Card />
  </Canvas>
)
