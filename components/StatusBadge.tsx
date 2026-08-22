import type { BadgeTone } from "@/lib/statusTone";

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: BadgeTone;
}) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}
