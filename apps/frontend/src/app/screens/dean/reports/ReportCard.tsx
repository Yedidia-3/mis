import "../../../../styles/report-card.css";
import { Fragment } from "react";

export interface Cell { value: number | null; max: number | null; flags: { code: string; message: string }[] }
export interface SubjectLine {
  subject_id: number; name: string; code: string; group: string | null; max: number | null;
  tj?: Cell; exam?: Cell | null; terms?: Cell[]; tot: Cell;
}
export interface ReportHeader {
  country: string; ministry: string; city: string; district: string; sector: string; school: string;
  phone: string; email: string; kind: "mid_term" | "end_of_term" | "end_of_year"; kind_label: string;
  academic_year: string; term: { id: number; name: string; status: string } | null;
  terms: { id: number; name: string; sequence: number; status: string }[];
  class: { id: number; label: string; p_level: string; p_level_id: number; band: string | null };
  class_teacher: string | null;
}
export interface CardData {
  header: ReportHeader;
  student: { id: number; name: string; student_id_number: string | null };
  subjects: SubjectLine[];
  total: number; max_total: number; percentage: number | null; position: number | null; class_size: number;
  flagged_count: number; flags: string[]; generated_by?: string | null; generated_at?: string | null;
}

const KIND_TITLES = { mid_term: "BULLETIN DE MI-TRIMESTRE", end_of_term: "BULLETIN SCOLAIRE", end_of_year: "BULLETIN ANNUEL" };

export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);

/** Subjects in report order, each group (ENGLISH, FRANÇAIS…) kept together under its heading. */
function grouped(subjects: SubjectLine[]) {
  const out: { group: string | null; items: SubjectLine[] }[] = [];
  for (const s of subjects) {
    const last = out[out.length - 1];
    if (s.group && last && last.group === s.group) last.items.push(s);
    else out.push({ group: s.group, items: [s] });
  }
  return out;
}

/**
 * One pupil's bulletin. With highlightFlags the cells that were zeroed or
 * guessed are tinted and titled with the reason, for the dean's review; the
 * printed copy never shows them.
 */
export function ReportCard({ card, highlightFlags = false }: { card: CardData; highlightFlags?: boolean }) {
  const { header: h } = card;
  const kind = h.kind;
  const period = kind === "end_of_year" ? h.academic_year : `${h.term?.name ?? ""} · ${h.academic_year}`;

  const cellProps = (c: Cell | null | undefined) => {
    const flagged = highlightFlags && !!c && c.flags.length > 0;
    return {
      title: flagged ? c!.flags.map((f) => f.message).join("\n") : undefined,
      className: `rc-num${flagged ? " rc-flag" : ""}`,
    };
  };

  const maxCols = kind === "mid_term" ? 1 : kind === "end_of_term" ? 3 : 2;
  const termCols = h.terms.length || 3;

  const groupTotals = (items: SubjectLine[]) => {
    const sum = (pick: (s: SubjectLine) => number | null | undefined) =>
      items.reduce((n, s) => n + (pick(s) ?? 0), 0);
    return {
      max: sum((s) => s.max),
      tj: sum((s) => s.tj?.value), exam: sum((s) => s.exam?.value), tot: sum((s) => s.tot.value),
      totMax: sum((s) => s.tot.max),
      terms: Array.from({ length: termCols }, (_, i) => sum((s) => s.terms?.[i]?.value)),
      termMax: sum((s) => s.terms?.[0]?.max),
    };
  };

  return (
    <article className="report-card">
      <header className="rc-head">
        <div className="rc-authority">
          <div>{h.country}</div><div>{h.ministry}</div><div>{h.city}</div><div>{h.district}</div><div>{h.sector}</div>
          <div className="rc-school">{h.school}</div>
          <div>TEL: {h.phone}</div><div>EMAIL: {h.email}</div>
        </div>
        <div className="rc-titleblock">
          <div className="rc-title">{KIND_TITLES[kind]}</div>
          <div className="rc-period">{period}</div>
        </div>
      </header>

      <div className="rc-pupil">
        <div><span>NOM ET PRENOM :</span> <b>{card.student.name}</b></div>
        <div><span>CLASSE :</span> <b>{h.class.label}</b>{card.student.student_id_number && <> · <span>N° :</span> {card.student.student_id_number}</>}</div>
      </div>

      <table className="rc-table">
        <thead>
          <tr>
            <th rowSpan={2} className="rc-subject">COURS</th>
            <th colSpan={maxCols}>MAXIMUM</th>
            <th colSpan={kind === "mid_term" ? 1 : kind === "end_of_term" ? 3 : termCols + 1}>POINTS OBTENUS</th>
          </tr>
          <tr>
            {kind === "mid_term" && <><th>TJ</th><th>TJ</th></>}
            {kind === "end_of_term" && <><th>TJ</th><th>EXAM</th><th>TOT</th><th>TJ</th><th>EXAM</th><th>TOT</th></>}
            {kind === "end_of_year" && (
              <>
                <th>TRIM.</th><th>ANNUEL</th>
                {h.terms.map((t) => <th key={t.id}>{t.name.toUpperCase()}</th>)}<th>TOTAL</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {grouped(card.subjects).map((g, gi) => (
            <Fragment key={gi}>
              {g.group && (() => {
                const t = groupTotals(g.items);
                return (
                  <tr className="rc-group">
                    <td className="rc-subject">{g.group.toUpperCase()}</td>
                    {kind === "mid_term" && <><td className="rc-num">{fmt(t.max)}</td><td className="rc-num">{fmt(t.tj)}</td></>}
                    {kind === "end_of_term" && (
                      <><td className="rc-num">{fmt(t.max)}</td><td className="rc-num">{fmt(t.max)}</td><td className="rc-num">{fmt(t.max * 2)}</td>
                        <td className="rc-num">{fmt(t.tj)}</td><td className="rc-num">{fmt(t.exam)}</td><td className="rc-num">{fmt(t.tot)}</td></>
                    )}
                    {kind === "end_of_year" && (
                      <><td className="rc-num">{fmt(t.termMax)}</td><td className="rc-num">{fmt(t.totMax)}</td>
                        {t.terms.map((v, i) => <td key={i} className="rc-num">{fmt(v)}</td>)}<td className="rc-num">{fmt(t.tot)}</td></>
                    )}
                  </tr>
                );
              })()}
              {g.items.map((s) => (
                <tr key={s.subject_id} className={g.group ? "rc-sub" : undefined}>
                  <td className="rc-subject">{g.group ? s.name : s.name.toUpperCase()}</td>
                  {kind === "mid_term" && <><td className="rc-num">{fmt(s.max)}</td><td {...cellProps(s.tj)}>{fmt(s.tj?.value)}</td></>}
                  {kind === "end_of_term" && (
                    <><td className="rc-num">{fmt(s.max)}</td><td className="rc-num">{fmt(s.max)}</td><td className="rc-num">{fmt(s.tot.max)}</td>
                      <td {...cellProps(s.tj)}>{fmt(s.tj?.value)}</td><td {...cellProps(s.exam)}>{fmt(s.exam?.value)}</td>
                      <td className="rc-num rc-strong">{fmt(s.tot.value)}</td></>
                  )}
                  {kind === "end_of_year" && (
                    <><td className="rc-num">{fmt(s.terms?.[0]?.max)}</td><td className="rc-num">{fmt(s.tot.max)}</td>
                      {(s.terms ?? []).map((c, i) => <td key={i} {...cellProps(c)}>{fmt(c.value)}</td>)}
                      <td className="rc-num rc-strong">{fmt(s.tot.value)}</td></>
                  )}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="rc-total">
            <td className="rc-subject">TOTAL</td>
            <td className="rc-num" colSpan={maxCols}>{fmt(card.max_total)}</td>
            <td className="rc-num" colSpan={kind === "mid_term" ? 1 : kind === "end_of_term" ? 3 : termCols + 1}>{fmt(card.total)}</td>
          </tr>
          <tr className="rc-total">
            <td className="rc-subject">POURCENTAGE</td>
            <td colSpan={maxCols} />
            <td className="rc-num" colSpan={kind === "mid_term" ? 1 : kind === "end_of_term" ? 3 : termCols + 1}>
              {card.percentage === null ? "" : `${card.percentage.toFixed(1)} %`}
            </td>
          </tr>
          <tr className="rc-total">
            <td className="rc-subject">PLACE</td>
            <td colSpan={maxCols} />
            <td className="rc-num" colSpan={kind === "mid_term" ? 1 : kind === "end_of_term" ? 3 : termCols + 1}>
              {card.position ?? ""} Sur {card.class_size}
            </td>
          </tr>
        </tfoot>
      </table>

      <footer className="rc-sign">
        <div><div className="rc-sign-label">SIGNATURE DES PARENTS</div><div className="rc-line" /></div>
        <div><div className="rc-sign-label">SIGNATURE DU TITULAIRE</div><div className="rc-line" />{h.class_teacher && <div className="rc-small">{h.class_teacher}</div>}</div>
        <div><div className="rc-sign-label">OBSERVATION</div><div className="rc-line" /></div>
      </footer>
    </article>
  );
}
