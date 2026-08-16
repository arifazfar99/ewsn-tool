import type { StampTone } from "@/lib/statusTone";
import { rotationFor } from "@/lib/stampRotation";

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
