"use client";

import { useEffect, useState } from "react";

const AUTO_DISMISS_MS = 4000;

export default function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div role="status" onClick={() => setVisible(false)} className="toast">
      {message}
    </div>
  );
}
