import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CardData, ReportCard } from "./ReportCard";

/**
 * Renders the bulletins outside the app shell, two side by side on each
 * landscape page as on the school's sheet, then opens the print dialog.
 */
export function PrintCards({ cards, onDone }: { cards: CardData[]; onDone: () => void }) {
  useEffect(() => {
    const after = () => onDone();
    window.addEventListener("afterprint", after);
    const timer = window.setTimeout(() => window.print(), 150);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", after); };
  }, [onDone]);

  const pages: CardData[][] = [];
  for (let i = 0; i < cards.length; i += 2) pages.push(cards.slice(i, i + 2));

  return createPortal(
    <div className="print-root">
      {pages.map((pair) => (
        <div key={pair[0].student.id} className="print-page">
          {pair.map((c) => <ReportCard key={c.student.id} card={c} />)}
        </div>
      ))}
    </div>,
    document.body,
  );
}
