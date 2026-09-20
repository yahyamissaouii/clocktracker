"use client";

import { useEffect, useState } from "react";

export function LiveTimer({ startTime }: { startTime: string | Date }) {
  const [elapsed, setElapsed] = useState<number>(() => {
    return Math.max(0, Date.now() - new Date(startTime).getTime());
  });

  useEffect(() => {
    const start = new Date(startTime).getTime();

    const interval = setInterval(() => {
      setElapsed(Math.max(0, Date.now() - start));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  const hours = Math.floor(elapsed / (1000 * 60 * 60));
  const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);

  const format2 = (num: number) => num.toString().padStart(2, "0");

  return (
    <span className="tabular-nums">
      {format2(hours)}:{format2(minutes)}:{format2(seconds)}
    </span>
  );
}
