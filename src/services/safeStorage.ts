export function readStorageValue(key: string): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn(`[VisionHub] localStorage read failed for ${key}`, error);
    return null;
  }
}

export function writeStorageValue(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`[VisionHub] localStorage write failed for ${key}`, error);
    return false;
  }
}

export function removeStorageValue(key: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`[VisionHub] localStorage remove failed for ${key}`, error);
    return false;
  }
}
