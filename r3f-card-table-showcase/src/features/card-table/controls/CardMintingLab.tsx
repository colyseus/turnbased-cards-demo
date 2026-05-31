import React, { useState } from 'react';

interface CardMintingLabProps {
  onMint: (theme: string, rank: string) => void;
}

export const CardMintingLab = React.memo(function CardMintingLab({ onMint }: CardMintingLabProps) {
  const [mintTheme, setMintTheme] = useState('hearts');
  const [mintRank, setMintRank] = useState('7');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onMint(mintTheme, mintRank);
  };

  return (
    <div className="customizer-hud creator-hud">
      <div className="customizer-header">
        <span>Card Minting Lab</span>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="customizer-section">
          <label htmlFor="create-color">Select Theme</label>
          <select id="create-color" className="action-select" value={mintTheme} onChange={(e) => setMintTheme(e.target.value)}>
            <option value="hearts">Hearts (Red)</option>
            <option value="diamonds">Diamonds (Orange-Red)</option>
            <option value="spades">Spades (Midnight)</option>
            <option value="clubs">Clubs (Ebony)</option>
          </select>
        </div>
        <div className="customizer-section">
          <label htmlFor="create-rank">Card Rank / Symbol</label>
          <input type="text" id="create-rank" className="action-input" value={mintRank} onChange={(e) => setMintRank(e.target.value)} />
        </div>
        <button type="submit" className="action-button mint-submit" id="btn-mint">Mint Card ✨</button>
      </form>
    </div>
  );
});
