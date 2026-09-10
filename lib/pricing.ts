import type { CustomerSegment } from "@/generated/prisma/client";
import { round2 } from "./money";

// Fixed markup per customer segment, applied to the Item catalog's stored
// cost price - see the CustomerSegment enum in schema.prisma for the real
// trade-pricing reasoning behind each tier.
export const SEGMENT_MARKUP: Record<CustomerSegment, number> = {
  DIRECT: 0.25,
  SME: 0.3,
  GOVERNMENT: 0.5,
};

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  DIRECT: "Direct",
  SME: "SME",
  GOVERNMENT: "Government",
};

export function sellPriceFromCost(
  costPrice: number,
  segment: CustomerSegment
): number {
  return round2(costPrice * (1 + SEGMENT_MARKUP[segment]));
}
