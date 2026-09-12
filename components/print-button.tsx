"use client";

/**
 * The whole PDF export: the browser's own print-to-PDF. No dependency, no
 * serverless binary, nothing to bundle. The sheet itself is the preview, so
 * this never fires on its own — the user reads first, then saves. The saved
 * file takes its name from document.title, which the print page sets to the
 * idea's title.
 */
export function PrintButton() {
  return (
    <button type="button" className="printbtn" onClick={() => window.print()}>
      Save as PDF
    </button>
  );
}

export default PrintButton;
