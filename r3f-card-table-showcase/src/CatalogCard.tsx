interface CatalogCardProps {
  suit: string;
  rank: string;
  symbol: string;
}
import { memo } from 'react';

export const CatalogCard = memo(function CatalogCard({ suit, rank, symbol }: CatalogCardProps) {
  const getCardFaceHTML = () => {
    if (suit === 'skip') {
      return (
        <>
          <div className="card-corner">
            <span className="action-label">{rank}</span>
            <span>🚫</span>
          </div>
          <div className="card-suit-center">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2.5" fill="none">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
            </svg>
          </div>
          <div className="card-corner" style={{ transform: 'rotate(180deg)' }}>
            <span className="action-label">{rank}</span>
            <span>🚫</span>
          </div>
        </>
      );
    } else if (suit === 'reverse') {
      return (
        <>
          <div className="card-corner">
            <span className="action-label">{rank}</span>
            <span>🔄</span>
          </div>
          <div className="card-suit-center">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
          </div>
          <div className="card-corner" style={{ transform: 'rotate(180deg)' }}>
            <span className="action-label">{rank}</span>
            <span>🔄</span>
          </div>
        </>
      );
    } else if (suit === 'draw2') {
      return (
        <>
          <div className="card-corner">
            <span className="action-label">{rank}</span>
            <span>+2</span>
          </div>
          <div className="card-suit-center">
            <svg viewBox="0 0 24 24" width="48" height="48" stroke="currentColor" strokeWidth="2" fill="none">
              <rect x="2" y="6" width="12" height="16" rx="2"></rect>
              <rect x="8" y="2" width="12" height="16" rx="2" fill="rgba(240, 198, 111, 0.2)"></rect>
            </svg>
          </div>
          <div className="card-corner" style={{ transform: 'rotate(180deg)' }}>
            <span className="action-label">{rank}</span>
            <span>+2</span>
          </div>
        </>
      );
    } else if (suit === 'wild') {
      return (
        <>
          <div className="card-corner">
            <span className="action-label">{rank}</span>
            <span>W</span>
          </div>
          <div className="card-suit-center wild-wheel">W</div>
          <div className="card-corner" style={{ transform: 'rotate(180deg)' }}>
            <span className="action-label">{rank}</span>
            <span>W</span>
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className="card-corner">
            <span>{rank}</span>
            <span>{symbol}</span>
          </div>
          <div className="card-suit-center">{symbol}</div>
          <div className="card-corner" style={{ transform: 'rotate(180deg)' }}>
            <span>{rank}</span>
            <span>{symbol}</span>
          </div>
        </>
      );
    }
  };

  return (
    <div className={`card-component suit-${suit}`} style={{ cursor: 'default' }}>
      <div className="card-component-inner">
        <div className="card-face-front">
          {getCardFaceHTML()}
          <div className="card-sheen"></div>
        </div>
        <div className="card-face-back">
          <div className="card-sheen"></div>
        </div>
      </div>
    </div>
  );
});
