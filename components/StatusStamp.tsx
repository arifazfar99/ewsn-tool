import type { StampTone } from "@/lib/statusTone";

// Deterministic -3..3deg tilt per label so the same status always renders
// with the same "stamp impression" instead of jittering between renders.
function rotationFor(label: string) {
  let hash = 0;
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 7) - 3;
}

export function StatusStamp({
  label,
  tone,
}: {
  label: string;
  tone: StampTone;
}) {
  return (
    <span
      className={`stamp stamp-${tone}`}
      style={{ transform: `rotate(${rotationFor(label)}deg)` }}
    >
      {label}
    </span>
  );
}
