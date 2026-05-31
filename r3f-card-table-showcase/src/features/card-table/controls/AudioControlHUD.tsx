import React from 'react';

interface AudioControlHUDProps {
  isMuted: boolean;
  onToggleMute: () => void;
  onVolumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AudioControlHUD = React.memo(function AudioControlHUD({
  isMuted,
  onToggleMute,
  onVolumeChange,
}: AudioControlHUDProps) {
  return (
    <div className="audio-control-hud" id="audio-hud">
      <button className="opt-btn" id="audio-mute-btn" title="Toggle Sound Mute" aria-label="Mute Sound" onClick={onToggleMute}>
        <svg id="svg-speaker" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          {isMuted ? <line x1="23" y1="1" x2="1" y2="23" /> : <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" className="sound-wave-lines" />}
        </svg>
      </button>
      <div className="audio-slider-container">
        <input type="range" id="audio-vol-slider" min="0" max="1" step="0.05" defaultValue="0.5" title="Volume Slider" aria-label="Volume Slider" onChange={onVolumeChange} />
      </div>
      <div className="sound-wave-visualizer">
        <div className="sound-wave-bar" />
        <div className="sound-wave-bar" />
        <div className="sound-wave-bar" />
      </div>
    </div>
  );
});
