export function readStorage(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string) {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // ignored
  }
}

export function removeStorage(key: string) {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // ignored
  }
}
