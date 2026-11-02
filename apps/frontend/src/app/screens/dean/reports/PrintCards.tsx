import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CardData, ReportCard } from "./ReportCard";

/**
 * Renders the bulletins outside the app shell, one per A4 page, then opens the
 * browser's print dialog. The app itself is hidden while printing.
 */
export function PrintCards({ cards, onDone }: { cards: CardData[]; onDone: () => void }) {
  useEffect(() => {
    const after = () => onDone();
    window.addEventListener("afterprint", after);
    const timer = window.setTimeout(() => window.print(), 150);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", after); };
  }, [onDone]);

  return createPortal(
    <div className="print-root">
      {cards.map((c) => (
        <div key={c.student.id} className="print-page">
          <ReportCard card={c} />
        </div>
      ))}
    </div>,
    document.body,
  );
}
