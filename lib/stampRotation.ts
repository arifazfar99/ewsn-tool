// Deterministic -3..3deg tilt per label so the same text always renders with
// the same "stamp impression" instead of jittering between renders.
export function rotationFor(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 7) - 3;
}
