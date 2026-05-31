import { useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { sfx } from "../audio/sfx";

function AudioSettingsPanel() {
  const [vol, setVol] = useState(() => sfx.getVolume());
  const [muted, setMuted] = useState(() => sfx.isMuted());

  const handleVolChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setVol(value);
    sfx.setVolume(value);
    localStorage.setItem("uno_volume", String(value));
  };

  const handleMuteToggle = () => {
    const isMutedNow = !muted;
    setMuted(isMutedNow);
    sfx.setMuted(isMutedNow);
    localStorage.setItem("uno_muted", isMutedNow ? "true" : "false");
  };

  return (
    <div className="audio-controls-panel">
      <button
        className="audio-btn-toggle"
        onClick={handleMuteToggle}
        type="button"
        aria-label="Toggle Mute"
      >
        {muted || vol === 0 ? "🔇" : "🔊"}
      </button>
      <div className="volume-slider-container">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={vol}
          onChange={handleVolChange}
          className="volume-slider"
          aria-label="Volume level"
          style={{ "--vol-val": `${vol * 100}%` } as CSSProperties}
        />
        <span>{Math.round(vol * 100)}%</span>
      </div>
      <button
        className="ghost-btn"
        style={{ height: "32px", fontSize: "11px", padding: "0 8px" }}
        onClick={() => sfx.playPluck()}
        type="button"
      >
        Test Sound
      </button>
    </div>
  );
}

export { AudioSettingsPanel };
