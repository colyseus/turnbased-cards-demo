import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVolumeValue, parseStoredVolumeValue, sfx } from "../src/audio/sfx.ts";

function withSoundState(fn: () => void) {
  const originalVolume = sfx.getVolume();
  const originalMuted = sfx.isMuted();
  try {
    fn();
  } finally {
    sfx.setMuted(originalMuted);
    sfx.setVolume(originalVolume);
  }
}

test("normalizeVolumeValue clamps and rejects invalid values", () => {
  assert.equal(normalizeVolumeValue(-0.5), 0);
  assert.equal(normalizeVolumeValue(0.4), 0.4);
  assert.equal(normalizeVolumeValue(1.5), 1);
  assert.equal(normalizeVolumeValue(Number.NaN), null);
});

test("parseStoredVolumeValue ignores empty storage strings", () => {
  assert.equal(parseStoredVolumeValue(null), null);
  assert.equal(parseStoredVolumeValue(""), null);
  assert.equal(parseStoredVolumeValue("   "), null);
  assert.equal(parseStoredVolumeValue("0.75"), 0.75);
  assert.equal(parseStoredVolumeValue(" 0.25 "), 0.25);
});

test("setVolume keeps the current value when passed an invalid number", () => {
  withSoundState(() => {
    sfx.setVolume(0.25);
    assert.equal(sfx.getVolume(), 0.25);

    sfx.setVolume(1.75);
    assert.equal(sfx.getVolume(), 1);

    sfx.setVolume(-1);
    assert.equal(sfx.getVolume(), 0);

    const beforeInvalidUpdate = sfx.getVolume();
    sfx.setVolume(Number.NaN);
    assert.equal(sfx.getVolume(), beforeInvalidUpdate);
  });
});
