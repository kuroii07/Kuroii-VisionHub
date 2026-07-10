export function readUrlSearchParam(name: string) {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export function readUrlSearchList(name: string) {
  return (readUrlSearchParam(name) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}
