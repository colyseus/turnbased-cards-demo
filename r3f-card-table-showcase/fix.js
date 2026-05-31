const fs = require('fs');
const code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `  return (
    <div className="game-board theme-emerald" id="game-board" style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      
      {/* BACKGROUND LAYER (zIndex: 0) */}
      <div className="felt-base" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        <div className="felt-texture"></div>
        <div className="felt-gradient"></div>
        <div className="felt-decorations" />
      </div>

      {/* RAILS LAYER (zIndex: 1) */}
      <div className="table-rail top" style={{ zIndex: 1 }}></div>
      <div className="table-rail bottom" style={{ zIndex: 1 }}></div>
      <div className="table-rail left" style={{ zIndex: 1 }}></div>
      <div className="table-rail right" style={{ zIndex: 1 }}></div>

      {/* HAND CONTAINER (zIndex: 2) */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', zIndex: 2, pointerEvents: 'none' }}>
        <div className="player-hand-container" id="player-hand" style={{ width: '544px', height: '200px', marginBottom: '24px', pointerEvents: 'auto' }} />
      </div>

      {/* WEBGL CANVAS (zIndex: 5) */}
      <ErrorBoundary>
        <Canvas
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 5, pointerEvents: 'auto' }}
          camera={{ position: [0, 0, 10], zoom: 60 }} // Camera exactly center
          orthographic
          shadows={{ type: THREE.PCFShadowMap }} // Fix PCFSoftShadowMap deprecation warning
          gl={{ alpha: true }}
        >
          {/* Ambient Background Particles */}
          <Sparkles count={50} scale={20} size={4} speed={0.2} opacity={0.1} color="#ffffff" />
          
          <ambientLight intensity={1.5} />
          <directionalLight position={[0, 10, 0]} intensity={1} />
          <ContactShadows position={[0, 0, -0.05]} opacity={0.4} scale={10} blur={2} far={2} />

          {/* Draw Deck Visual Target */}
          <pointLight position={[-2.5, 0, 0.5]} distance={5} intensity={1.5} color="#4ade80" />
          <group position={[-2.5, 0, 0]}>
            <Html transform center zIndexRange={[100, 10]} style={{ pointerEvents: 'none' }}>
              <div className="luxury-deck-stack" id="deck-draw" style={{ position: 'relative', margin: 0 }}>
                <div className="luxury-deck-layer layer-6"></div>
                <div className="luxury-deck-layer layer-5"></div>
                <div className="luxury-deck-layer layer-4"></div>
                <div className="luxury-deck-layer layer-3"></div>
                <div className="luxury-deck-layer layer-2"></div>
                <div className="luxury-deck-layer layer-1"></div>
                <div className="luxury-deck-top-card">
                  <div className="luxury-card-back-emblem"></div>
                </div>
              </div>
            </Html>
            <Html position={[0, -1.8, 0]} center zIndexRange={[100, 10]}>
              <div className="deck-label" style={{ whiteSpace: 'nowrap' }}>DRAW DECK ({cards.filter(c => c.location === 'deck').length})</div>
            </Html>
          </group>

          {/* Empty Discard Pile Visual Target */}
          <group position={[2.5, 0, 0]}>
            <Html transform center zIndexRange={[100, 10]} style={{ pointerEvents: 'none' }}>
              <div className="card-component" id="discard-pile" style={{ cursor: 'default', margin: 0 }}>
                <div className="card-component-inner">
                  <div className="card-face-front" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(255,255,255,0.15)' }}>
                    <span style={{ fontSize: '32px', color: 'rgba(255,255,255,0.15)' }}>+</span>
                  </div>
                  <div className="card-face-back"></div>
                </div>
              </div>
            </Html>
            <Html position={[0, -1.8, 0]} center zIndexRange={[100, 10]}>
              <div className="deck-label" style={{ whiteSpace: 'nowrap' }}>DISCARD PILE</div>
            </Html>
          </group>

          {/* Cards */}
          <Suspense fallback={null}>
            {cards.map(card => {
              const target = getCardTarget(card, cards);
              return (
                <Card3D 
                  key={card.id}
                  id={card.id}
                  suit={card.suit}
                  rank={card.rank}
                  symbol={card.symbol}
                  targetPosition={target.pos}
                  targetRotation={target.rot}
                  zIndex={target.zIndex}
                  location={card.location}
                />
              );
            })}
          </Suspense>
        </Canvas>
      </ErrorBoundary>

      {/* UI LAYER (zIndex: 10) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 10 }}>
        {/* Title and details overlay */}
        <div className="showcase-header" style={{ pointerEvents: 'auto' }}>
          <div className="showcase-tag">SYSTEM PROTOTYPE v2.2</div>
          <h1>Wild Table Design</h1>
          <p>Interactive playing card template showcase. Explore the premium 3D animations and responsive glassmorphic containers.</p>
          
          <div className="specs-panel">
            <h3>Design System Specs</h3>
            <div className="spec-row">
              <span className="spec-label">Board Felt:</span>
              <span className="spec-value">hsl(158, 55%, 26%)</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Wood Rails:</span>
              <span className="spec-value">hsl(18, 48%, 15%)</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Brand Accent:</span>
              <span className="spec-value highlight">#f0c66f (Gold)</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Font Family:</span>
              <span className="spec-value">Outfit / Inter</span>
            </div>
            <div className="spec-row">
              <span className="spec-label">Card Size:</span>
              <span className="spec-value">120px × 168px</span>
            </div>
          </div>
        </div>

        {/* Top Right Controls Hub */}
        <div className="control-hub" style={{ pointerEvents: 'auto' }}>
          {/* Glassmorphic Audio Control HUD */}
          <div className="audio-control-hud" id="audio-hud">
            <button className="opt-btn" id="audio-mute-btn" title="Toggle Sound Mute" aria-label="Mute Sound" onClick={() => audio.setMute(!audio.isMuted)}>
              <svg id="svg-speaker" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" className="sound-wave-lines"></path>
              </svg>
            </button>
            <div className="audio-slider-container">
              <input type="range" id="audio-vol-slider" min="0" max="1" step="0.05" defaultValue="0.5" title="Volume Slider" aria-label="Volume Slider" onChange={(e) => audio.setVolume(parseFloat(e.target.value))} />
            </div>
            <div className="sound-wave-visualizer">
              <div className="sound-wave-bar"></div>
              <div className="sound-wave-bar"></div>
              <div className="sound-wave-bar"></div>
            </div>
          </div>
          <button className="action-button" id="btn-flip" onClick={flipHand}>Flip Hand <kbd className="key-badge">F</kbd></button>
          <button className="action-button" id="btn-draw" onClick={drawCard}>Draw Card <kbd className="key-badge">D</kbd></button>
          <button className="action-button" id="btn-shuffle" onClick={shuffleDeck}>Shuffle Deck <kbd className="key-badge">S</kbd></button>
          <button className="action-button" id="btn-reset" onClick={resetTable}>Reset Board <kbd className="key-badge">R</kbd></button>
        </div>

        {/* Active Specs Inspector Legend */}
        <div className="spec-legend" style={{ pointerEvents: 'auto' }}>
          <h3>Design System Specs</h3>
          <div className="spec-item">
            <span className="spec-label">Board Felt:</span>
            <span className="spec-val">hsl(158, 55%, 26%)</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Wood Rails:</span>
            <span className="spec-val">hsl(18, 48%, 15%)</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Brand Accent:</span>
            <span className="spec-val" style={{ color: "var(--gold, #f0c66f)" }}>#f0c66f (Gold)</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Font Family:</span>
            <span className="spec-val">Outfit / Inter</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Card Size:</span>
            <span className="spec-val">120px × 168px</span>
          </div>
        </div>

        {/* Premium Theme Customizer HUD */}
        <div className="customizer-hud" style={{ pointerEvents: 'auto' }}>
          <div className="customizer-header">
            <span>Table Customizer</span>
          </div>
          <div className="customizer-section">
            <label>Felt Theme</label>
            <div className="customizer-options">
              <button className="opt-btn felt-opt active" style={{ background: 'hsl(158, 60%, 14%)', borderColor: 'var(--gold, #f0c66f)' }}></button>
              <button className="opt-btn felt-opt" style={{ background: 'hsl(215, 55%, 16%)' }}></button>
              <button className="opt-btn felt-opt" style={{ background: 'hsl(355, 45%, 15%)' }}></button>
              <button className="opt-btn felt-opt" style={{ background: 'hsl(220, 8%, 18%)' }}></button>
            </div>
          </div>
        </div>

        {/* Card Minting Lab HUD */}
        <div className="customizer-hud creator-hud" style={{ pointerEvents: 'auto' }}>
          <div className="customizer-header">
            <span>Card Minting Lab</span>
          </div>
          <div className="customizer-section">
            <label htmlFor="create-color">Select Theme</label>
            <select id="create-color" className="action-select">
              <option value="hearts">Hearts (Red)</option>
              <option value="diamonds">Diamonds (Orange-Red)</option>
              <option value="spades">Spades (Midnight)</option>
              <option value="clubs">Clubs (Ebony)</option>
            </select>
          </div>
          <div className="customizer-section">
            <label htmlFor="create-rank">Card Rank / Symbol</label>
            <input type="text" id="create-rank" className="action-input" defaultValue="7" />
          </div>
          <button className="action-button" id="btn-mint" style={{ width: '100%', marginTop: '4px' }}>Mint Card ✨</button>
        </div>
      </div>
    </div>
  );
}`;

const idx = code.indexOf('  return (\n');
if (idx !== -1) {
  const newCode = code.substring(0, idx) + replacement + '\n}\n';
  fs.writeFileSync('src/App.tsx', newCode);
  console.log('App.tsx updated successfully');
} else {
  console.log('Could not find return statement');
}
