"use client";

import { useEffect, useRef } from "react";

/**
 * The whole PDF export: the browser's own print-to-PDF. No dependency, no
 * serverless binary, nothing to bundle — `window.print()` and a print
 * stylesheet. The saved file takes its name from document.title, which the
 * print page sets to the idea's title.
 */
export function PrintButton({ auto = false }: { auto?: boolean }) {
  const fired = useRef(false);

  useEffect(() => {
    if (!auto || fired.current) return;
    fired.current = true;
    // One frame after paint, so the sheet is laid out before the dialog
    // freezes rendering.
    const id = window.requestAnimationFrame(() => window.print());
    return () => window.cancelAnimationFrame(id);
  }, [auto]);

  return (
    <button type="button" className="printbtn" onClick={() => window.print()}>
      Save as PDF
    </button>
  );
}

export default PrintButton;
