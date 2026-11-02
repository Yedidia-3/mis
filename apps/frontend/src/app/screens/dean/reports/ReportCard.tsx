import "../../../../styles/report-card.css";
import { Fragment } from "react";
import logo from "../../../../assets/images/official-logo.png";

export interface Cell { value: number | null; max: number | null; flags: { code: string; message: string }[] }
export interface SubjectLine {
  subject_id: number; name: string; code: string; group: string | null; max: number | null;
  tj?: Cell; exam?: Cell | null; terms?: Cell[]; tot: Cell;
}
export interface ReportHeader {
  country: string; ministry: string; city: string; district: string; sector: string; school: string;
  phone: string; email: string; kind: "mid_term" | "end_of_term" | "end_of_year"; kind_label: string;
  academic_year: string; term: { id: number; name: string; sequence?: number; status: string } | null;
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

const ROMAN = ["", "I", "II", "III"];
const ORDINAL = ["", "PREMIER", "DEUXIEME", "TROISIEME"];

export const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? "" : Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);

/** Subjects in report order, each group (ENGLISH, FRANÇAIS…) kept together under its heading row. */
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
 * One pupil's bulletin, laid out as the school's "School Report" sheet: the
 * authority block and year/class/term on top, BULLETIN SCOLAIRE, the pupil's
 * name, then COURS | MAXIMUM (TJ EXAM TOT) | period (TJ EXAM TOT), TOTAL,
 * POURCENTAGE, PLACE … Sur …, and the signature rows, under the school logo.
 *
 * With highlightFlags the cells that were zeroed or guessed are outlined and
 * titled with the reason, for the dean's review; printed copies never show it.
 */
export function ReportCard({ card, highlightFlags = false }: { card: CardData; highlightFlags?: boolean }) {
  const h = card.header;
  const yearly = h.kind === "end_of_year";
  const seq = h.term?.sequence ?? h.terms.find((t) => t.id === h.term?.id)?.sequence ?? Number(h.term?.name.match(/\d/)?.[0] ?? 0);
  const trimestre = yearly ? "ANNUEL" : ROMAN[seq] ?? h.term?.name ?? "";
  const period = yearly ? "ANNUEL" : h.kind === "mid_term" ? "MI-TRIMESTRE" : `${ORDINAL[seq] ?? ""} TRIMESTRE`.trim();
  const yearTerms = [...h.terms].sort((a, b) => a.sequence - b.sequence);

  const value = (c: Cell | null | undefined) => {
    const flagged = highlightFlags && !!c && c.flags.length > 0;
    return (
      <td className={`rc-v${flagged ? " rc-flag" : ""}`} title={flagged ? c!.flags.map((f) => f.message).join("\n") : undefined}>
        {fmt(c?.value)}
      </td>
    );
  };

  return (
    <article className="report-card">
      <img src={logo} alt="Jericho School" className="rc-logo" />
      <header className="rc-head">
        <div className="rc-left">
          <div>{h.country}</div>
          <div>{h.ministry}</div>
          <div>{h.city}</div>
          <div>{h.district}</div>
          <div>{h.sector}</div>
          <div>{h.school}</div>
          <div>TEL: {h.phone}</div>
          <div>EMAIL: {h.email}</div>
        </div>
        <div className="rc-right">
          <div>ANNEE SCOLAIRE&nbsp;: {h.academic_year}</div>
          <div />
          <div />
          <div className="rc-pair"><span>CLASSE:</span><span>{h.class.label}</span></div>
          <div />
          <div />
          <div>TRIMESTRE: {trimestre}</div>
          <div />
        </div>
      </header>

      <div className="rc-title"><span>BULLETIN SCOLAIRE</span></div>

      <div className="rc-name">
        <span className="rc-name-label">NOM ET PRENOM</span>
        <span className="rc-name-value">{card.student.name}</span>
      </div>

      <table className="rc-table">
        <colgroup>
          <col style={{ width: "33.6%" }} />
          <col style={{ width: "8%" }} /><col style={{ width: "11.7%" }} /><col style={{ width: "7.5%" }} />
          <col style={{ width: "10.7%" }} /><col style={{ width: "13.1%" }} /><col style={{ width: "15.4%" }} />
        </colgroup>
        <thead>
          <tr>
            <th rowSpan={2} className="rc-course">COURS</th>
            <th colSpan={yearly ? 2 : 3} className="rc-max">MAXIMUM</th>
            <th colSpan={yearly ? 4 : 3}>{period}</th>
          </tr>
          <tr>
            {yearly ? (
              <>
                <th className="rc-max">TRIM</th><th className="rc-max">ANNUEL</th>
                {[1, 2, 3].map((n) => <th key={n}>{ROMAN[n]}</th>)}<th>TOT</th>
              </>
            ) : (
              <>
                <th className="rc-max">TJ</th><th className="rc-max">EXAM</th><th className="rc-max">TOT</th>
                <th>TJ</th><th>EXAM</th><th>TOT</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {grouped(card.subjects).map((g, gi) => (
            <Fragment key={gi}>
              {g.group && (
                <tr className="rc-group"><td className="rc-course" colSpan={7}>{g.group.toUpperCase()}</td></tr>
              )}
              {g.items.map((s) => (
                <tr key={s.subject_id}>
                  <td className={`rc-course${g.group ? " rc-sub" : ""}`}>{s.name.toUpperCase()}</td>
                  {yearly ? (
                    <>
                      <td className="rc-max">{fmt(s.terms?.[0]?.max)}</td>
                      <td className="rc-max">{fmt(s.tot.max)}</td>
                      {yearTerms.map((t, i) => <Fragment key={t.id}>{value(s.terms?.[i])}</Fragment>)}
                      <td className="rc-v">{fmt(s.tot.value)}</td>
                    </>
                  ) : (
                    <>
                      <td className="rc-max">{fmt(s.max)}</td>
                      <td className="rc-max">{fmt(s.max)}</td>
                      <td className="rc-max">{fmt(s.tot.max)}</td>
                      {value(s.tj)}
                      {value(s.exam)}
                      <td className="rc-v">{fmt(s.tot.value)}</td>
                    </>
                  )}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="rc-foot">
            <td className="rc-course">TOTAL</td>
            <td className="rc-max rc-center" colSpan={yearly ? 2 : 3}>{fmt(card.max_total)}</td>
            <td className="rc-right-num" colSpan={yearly ? 4 : 3}>{fmt(card.total)}</td>
          </tr>
          <tr className="rc-foot">
            <td className="rc-course">POURCENTAGE</td>
            <td className="rc-max" colSpan={yearly ? 2 : 3} />
            <td className="rc-right-num" colSpan={yearly ? 4 : 3}>{card.percentage === null ? "" : card.percentage.toFixed(1)}</td>
          </tr>
          <tr className="rc-foot">
            <td className="rc-course">PLACE</td>
            <td className="rc-max" colSpan={yearly ? 2 : 3} />
            {yearly && <td className="rc-place-pad" />}
            <td className="rc-place">{card.position ?? ""}</td>
            <td className="rc-place rc-sur">Sur</td>
            <td className="rc-place">{card.class_size}</td>
          </tr>
          {["SIGNATURE DES PARENTS", "SIGNATURE DU MAÎTRE", "OBSERVATION"].map((label) => (
            <tr key={label} className="rc-sign">
              <td className="rc-course">{label}</td>
              <td colSpan={6} />
            </tr>
          ))}
        </tbody>
      </table>
    </article>
  );
}
