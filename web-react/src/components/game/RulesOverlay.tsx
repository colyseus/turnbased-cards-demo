export default function RulesOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="rules-overlay">
      <div className="rules-card">
        <div className="rules-header">
          <h2>UNO Rules</h2>
          <button className="rules-close" onClick={onClose}>✕</button>
        </div>
        <div className="rules-body">
          <section>
            <h3>Objective</h3>
            <p>Be the first to play all your cards. When you have one card left, you must call &ldquo;UNO&rdquo;.</p>
          </section>
          <section>
            <h3>Playing Cards</h3>
            <p>Play a card that matches the top card on the discard pile by color or value. Wild cards can be played on any card.</p>
          </section>
          <section>
            <h3>Special Cards</h3>
            <ul>
              <li><strong>Skip:</strong> Next player loses their turn.</li>
              <li><strong>Reverse:</strong> Changes the direction of play.</li>
              <li><strong>Draw 2:</strong> Next player draws two cards and loses their turn.</li>
              <li><strong>Wild:</strong> Player chooses the next color.</li>
              <li><strong>Wild Draw 4:</strong> Player chooses color, next player draws four cards and loses turn. Can be played anytime.</li>
            </ul>
          </section>
          <section>
            <h3>UNO!</h3>
            <p>If you don&apos;t call &ldquo;UNO&rdquo; before playing your second-to-last card, and someone catches you, you must draw 2 cards.</p>
          </section>
          <section>
            <h3>Keyboard Shortcuts</h3>
            <div className="shortcuts-grid">
              <span><strong>← / →</strong> Select card</span>
              <span><strong>Enter / Space</strong> Play selected</span>
              <span><strong>D</strong> Draw card</span>
              <span><strong>U</strong> Call UNO</span>
              <span><strong>S</strong> Sort hand</span>
              <span><strong>Q</strong> Quit to lobby</span>
              <span><strong>?</strong> Show rules</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
