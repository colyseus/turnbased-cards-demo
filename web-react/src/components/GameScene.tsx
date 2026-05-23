import { Canvas, useThree, useFrame } from '@react-three/fiber';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  EffectComposer,
  Bloom,
  Vignette,
  SSAO,
  ToneMapping,
} from '@react-three/postprocessing';

import { Game } from './Game';
import { GameHud } from './game/GameHud';
import { TextureProvider } from './Preloader';
import { DevToolsProvider, DevToolsLogic, DevToolsUI } from './DevTools';
import { LongPressCard } from './LongPressCard';
import { createTimerClock } from '../threeTimerClock';

RectAreaLightUniformsLib.init();

export interface LastPlayedInfo {
  cardId: string;
  playerName: string;
  textureId: string;
}

interface LongPressInfo {
  textureId: string;
}


const SHAKE_INTENSITY = 0.08;

function CameraShake({
  shakeStart,
  showcaseCardId,
}: {
  shakeStart: React.RefObject<number>;
  showcaseCardId: string | null;
}) {
  const { camera } = useThree();
  const origPos = useRef(new THREE.Vector3());
  const initialized = useRef(false);

  // Spring physics state
  const springPos = useRef(new THREE.Vector3());
  const springVel = useRef(new THREE.Vector3());

  // Shake state
  const shakeAmp = useRef(0);
  const shakePhase = useRef(0);

  // Idle bob state
  const bobPhase = useRef(0);

  // Focus transition state
  const focusTarget = useRef(new THREE.Vector3());
  const prevShowcaseCardId = useRef<string | null>(null);

  // Mobile detection
  const isMobile = useRef(false);

  useEffect(() => {
    isMobile.current = window.innerWidth < 768;
  }, []);

  useFrame((_, delta) => {
    if (!initialized.current) {
      origPos.current.copy(camera.position);
      (camera as THREE.PerspectiveCamera).fov = isMobile.current ? 55 : 50;
      camera.updateProjectionMatrix();
      initialized.current = true;
    }

    const elapsed = (Date.now() - shakeStart.current) / 1000;

    // Trigger shake when shakeStart is set
    if (shakeStart.current > 0 && shakeAmp.current === 0) {
      origPos.current.copy(camera.position);
      springPos.current.set(0, 0, 0);
      springVel.current.set(0, 0, 0);
      shakeAmp.current = SHAKE_INTENSITY;
      shakePhase.current = 0;
    }

    // Spring-based shake with decay
    const shakeFreq = 15;
    const shakeDecay = 15;

    if (shakeAmp.current > 0.001) {
      // Decaying sinusoidal shake using spring physics
      const shakeOffset =
        Math.sin(shakePhase.current) *
        shakeAmp.current *
        Math.exp(-shakeDecay * elapsed);

      // Spring physics
      const stiffness = 50;
      const damping = 10;
      const springForce = springPos.current.clone().multiplyScalar(-stiffness);
      springForce.add(springVel.current.clone().multiplyScalar(-damping));
      springVel.current.add(springForce.multiplyScalar(delta));
      springPos.current.add(springVel.current.clone().multiplyScalar(delta));

      camera.position.x = origPos.current.x + springPos.current.x;
      camera.position.y = origPos.current.y + springPos.current.y + shakeOffset;

      shakePhase.current += shakeFreq * delta;
    } else if (initialized.current) {
      // Settled - return to original with smooth lerp
      shakeAmp.current = 0;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, origPos.current.x, 0.15);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, origPos.current.y, 0.15);
    }

    // Idle camera bob (subtle sinusoidal Y movement, period 4s, amplitude 0.02)
    if (shakeAmp.current < 0.001) {
      bobPhase.current += (2 * Math.PI) / 4 * delta;
      const bobOffset = Math.sin(bobPhase.current) * 0.02;
      camera.position.y += bobOffset;
    }

    // Focus transition - smooth lean toward discard pile when card is played
    if (showcaseCardId !== prevShowcaseCardId.current) {
      if (showcaseCardId) {
        // Card was played - focus on discard pile direction
        const pileWorldPos = new THREE.Vector3(1.42, 0, 0); // discard pile X position
        const targetDir = pileWorldPos.clone().sub(origPos.current).normalize();
        focusTarget.current.copy(targetDir.multiplyScalar(0.15));
      }
      prevShowcaseCardId.current = showcaseCardId;
    }

    // Apply focus transition with spring-eased lerp
    if (showcaseCardId) {
      camera.position.x += THREE.MathUtils.lerp(focusTarget.current.x, 0, 0.85) * delta;
      camera.position.y += THREE.MathUtils.lerp(focusTarget.current.y, 0, 0.9) * delta;
    } else {
      // Return to center when no showcase
      focusTarget.current.x = THREE.MathUtils.lerp(focusTarget.current.x, 0, 0.1);
      focusTarget.current.y = THREE.MathUtils.lerp(focusTarget.current.y, 0, 0.1);
    }
  });

  return null;
}

function LightingSetup() {
  const { gl } = useThree();

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl]);

  return (
    <>
      {/* 3-Point Lighting Rig */}
      {/* Key Light - warm directional light, main shadow caster */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={2}
        color={0xffeedd}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={30}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-bias={-0.001}
      />
      {/* Fill Light - cool hemisphere light, lifts shadows softly */}
      <hemisphereLight
        color={0x88ccff}
        groundColor={0x222244}
        intensity={0.6}
      />
      {/* Rim/Back Light - magenta point light behind table for edge definition */}
      <pointLight
        position={[0, 3, -6]}
        intensity={1.2}
        color={0xff00ff}
        distance={15}
        decay={2}
      />
      {/* RectAreaLight - soft ambient fill from above */}
      <rectAreaLight
        position={[0, 6, 0]}
        width={12}
        height={8}
        intensity={1.5}
        color={0x00e5ff}
        rotation={[-Math.PI / 2.5, 0, 0]}
      />
    </>
  );
}

function PostProcessingSetup({ qualityLevel }: { qualityLevel: QualityLevel }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;
  }, [gl]);
  const effects: React.ReactElement[] = [
    <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.4} intensity={0.5} />,
    <Vignette offset={1.2} darkness={1.0} />,
    <ToneMapping />,
  ];
  if (qualityLevel === 'high') {
    effects.unshift(<SSAO radius={0.4} intensity={1} />);
  }
  return <EffectComposer>{effects}</EffectComposer>;
}

export type QualityLevel = 'low' | 'medium' | 'high';

const QUALITY_PRESETS: Record<
  QualityLevel,
  { dpr: number | [number, number]; antialias: boolean }
> = {
  low: { dpr: 1, antialias: false },
  medium: { dpr: 1.5, antialias: true },
  high: { dpr: [1, 2], antialias: true },
};

export default function GameScene() {
  const [sortByColor, setSortByColor] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [qualityLevel, setQualityLevel] = useState<QualityLevel>('medium');
  const [lastPlayed, setLastPlayed] = useState<LastPlayedInfo | null>(null);
  const [longPressCard, setLongPressCard] = useState<LongPressInfo | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(-1);
  const [showcaseCardId, setShowcaseCardId] = useState<string | null>(null);
  const shakeStart = useRef(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const SWIPE_THRESHOLD = 50;

  const triggerShake = useCallback(() => {
    shakeStart.current = Date.now();
  }, []);

  const handleShowcaseChange = useCallback((id: string | null) => {
    setShowcaseCardId(id);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case 'm':
          setSoundEnabled((v) => !v);
          break;
        case 's':
          setSortByColor((v) => !v);
          break;
        case 'q':
          setQualityLevel((v) => (v === 'low' ? 'medium' : v === 'medium' ? 'high' : 'low'));
          break;
        case 'f':
          if (document.fullscreenElement) document.exitFullscreen();
          else document.documentElement.requestFullscreen();
          break;
        case '?':
        case '/':
          setShowRules((v) => !v);
          break;
        case 'c':
          setShowChat((v) => !v);
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Swipe gestures for mobile card navigation
  useEffect(() => {
    function onTouchStart(e: globalThis.TouchEvent) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
    function onTouchEnd(e: globalThis.TouchEvent) {
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx)) return;

      // Dispatch arrow key events for swipe
      const event = new KeyboardEvent('keydown', {
        key: dx > 0 ? 'ArrowRight' : 'ArrowLeft',
        bubbles: true,
      });
      window.dispatchEvent(event);
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return (
    <DevToolsProvider>
      <Canvas
        camera={{ position: [0, -0.5, 10], fov: 50 }}
        dpr={QUALITY_PRESETS[qualityLevel].dpr}
        gl={{
          antialias: QUALITY_PRESETS[qualityLevel].antialias,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        onCreated={(state) => {
          state.clock = createTimerClock() as typeof state.clock;
        }}
      >
        <PostProcessingSetup qualityLevel={qualityLevel} />
        <LightingSetup />
        <CameraShake shakeStart={shakeStart} showcaseCardId={showcaseCardId} />
        <DevToolsLogic />
        <TextureProvider>
          <Game
            sortByColor={sortByColor}
            qualityLevel={qualityLevel}
            onLastPlayed={setLastPlayed}
            onShake={triggerShake}
            onLongPress={(textureId) => setLongPressCard({ textureId })}
            onShowcaseChange={handleShowcaseChange}
            selectedCardIndex={selectedCardIndex}
            onSelectCard={setSelectedCardIndex}
          />
        </TextureProvider>
      </Canvas>
      <DevToolsUI />
      {longPressCard && (
        <LongPressCard textureId={longPressCard.textureId} onClose={() => setLongPressCard(null)} />
      )}
      <GameHud
        sortByColor={sortByColor}
        onSortToggle={() => setSortByColor((v) => !v)}
        showRules={showRules}
        onShowRules={() => setShowRules(true)}
        onCloseRules={() => setShowRules(false)}
        showOptions={showOptions}
        onShowOptions={() => setShowOptions(true)}
        onCloseOptions={() => setShowOptions(false)}
        soundEnabled={soundEnabled}
        onSoundToggle={() => setSoundEnabled((v) => !v)}
        qualityLevel={qualityLevel}
        onQualityToggle={() =>
          setQualityLevel((v) => (v === 'low' ? 'medium' : v === 'medium' ? 'high' : 'low'))
        }
        lastPlayed={lastPlayed}
        showChat={showChat}
        onShowChat={() => setShowChat(true)}
        onCloseChat={() => setShowChat(false)}
      />
    </DevToolsProvider>
  );
}
