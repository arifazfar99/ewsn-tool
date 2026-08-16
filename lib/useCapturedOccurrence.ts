"use client";

import { useState } from "react";

// Captures `value` into local state once per distinct occurrence, comparing
// against the last-seen value during render (React's "adjust state when a
// prop changes" pattern) rather than in a useEffect — this repo's
// react-hooks/set-state-in-effect lint rule rejects the plain effect-based
// version. Re-fires correctly even when the exact same value recurs later,
// as long as the caller lets `value` fall back to null/undefined in between
// occurrences (e.g. a URL param that gets stripped after being read) — a
// naive equality check against a value that's never cleared would silently
// swallow a repeat. Reference-typed values (e.g. a fresh object per action
// call) don't need that reset, since two distinct occurrences are already
// distinct references.
export function useCapturedOccurrence<T>(value: T | null | undefined) {
  const [seen, setSeen] = useState<T | null | undefined>(undefined);
  const [captured, setCaptured] = useState<{ nonce: number; value: T } | null>(
    null
  );

  if (value !== seen) {
    setSeen(value);
    if (value) {
      setCaptured((prev) => ({ nonce: (prev?.nonce ?? 0) + 1, value }));
    }
  }

  return captured;
}
