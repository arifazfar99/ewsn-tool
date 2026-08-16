"use client";

import { useEffect, useState } from "react";
import { rotationFor } from "@/lib/stampRotation";

const AUTO_DISMISS_MS = 4000;

export default function Toast({ message }: { message: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const deg = rotationFor(message);

  return (
    <div
      role="status"
      onClick={() => setVisible(false)}
      className="stamp stamp-positive toast-positive"
      style={
        {
          transform: `rotate(${deg}deg)`,
          "--toast-rotate": `${deg}deg`,
        } as React.CSSProperties
      }
    >
      {message}
    </div>
  );
}
