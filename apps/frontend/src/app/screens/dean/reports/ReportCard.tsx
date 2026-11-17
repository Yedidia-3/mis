import "../../../../styles/report-card.css";

export interface Cell { value: number | null; max: number | null; flags: { code: string; message: string }[] }
export interface SubjectLine {
  subject_id: number; name: string; code: string; max: number | null;
  points?: Cell;
}
export interface NurseryTerm {
  sequence: number; name: string; observation: string;
  ratings: Record<string, string | null>;
}
export interface ReportHeader {
  layout?: "french" | "english" | "nursery";
  kind: string; kind_label: string;
  country?: string; ministry?: string; city?: string; district?: string; sector?: string;
  school?: string; phone?: string; email?: string;
  title?: string;
  academic_year: string;
  date?: string;
  year_label?: string; class_label?: string; level_label?: string; level_value?: string;
  name_label?: string; course_label?: string; period_label?: string;
  max_label?: string; points_label?: string; total_label?: string; percentage_label?: string;
  place_label?: string; parent_sign?: string; teacher_sign?: string; done_at?: string; date_label?: string;
  term: { id: number; name: string; sequence?: number; status: string } | null;
  terms: { id: number; name: string; sequence: number; status: string }[];
  areas?: { code: string; title: string; subjects: { code: string; name: string }[] }[];
  class: { id: number; label: string; p_level: string; p_level_id: number; band: string | null };
  class_teacher: string | null;
}
export interface CardData {
  header: ReportHeader;
  student: { id: number; name: string; student_id_number: string | null };
  subjects: SubjectLine[];
  nursery?: { terms: NurseryTerm[]; decision: string | null } | null;
  total: number; max_total: number; percentage: number | null; position: number | null; class_size: number;
  flagged_count: number; flags: string[];
}

const RATING_CLASS: Record<string, string> = {
  excellent: "nu-excellent",
  tres_bon: "nu-tres",
  bon: "nu-bon",
  assez_bon: "nu-assez",
};

export const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined) return "";
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const dmy = (iso?: string | null) => {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
};

export function ReportCard({ card, highlightFlags = false }: { card: CardData; highlightFlags?: boolean }) {
  if (card.header.layout === "nursery" || card.header.kind === "nursery") return <NurseryCard card={card} />;
  return <MidtermCard card={card} highlightFlags={highlightFlags} />;
}

function MidtermCard({ card, highlightFlags }: { card: CardData; highlightFlags: boolean }) {
  const h = card.header;
  const value = (c: Cell | undefined) => {
    const flagged = highlightFlags && !!c && c.flags.length > 0;
    return (
      <td className={`rc-v${flagged ? " rc-flag" : ""}`} title={flagged ? c!.flags.map((f) => f.message).join("\n") : undefined}>
        {fmt(c?.value)}
      </td>
    );
  };
  return (
    <article className="report-card">
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
          <div>{h.year_label} {h.academic_year}</div>
          <div className="rc-pair"><span>{h.class_label}</span><span>{h.class.label}</span></div>
          <div className="rc-pair"><span>{h.level_label}</span><span>{h.level_value}</span></div>
        </div>
      </header>
      <div className="rc-title"><span>{h.title}</span></div>
      <div className="rc-name">
        <span className="rc-name-label">{h.name_label}</span>
        <span className="rc-name-value">{card.student.name}</span>
      </div>
      <table className="rc-table rc-mid">
        <colgroup>
          <col style={{ width: "46%" }} />
          <col style={{ width: "27%" }} />
          <col style={{ width: "27%" }} />
        </colgroup>
        <thead>
          <tr>
            <th className="rc-course">{h.course_label}</th>
            <th colSpan={2}>{h.period_label}</th>
          </tr>
          <tr>
            <th />
            <th className="rc-max">{h.max_label}</th>
            <th>{h.points_label}</th>
          </tr>
        </thead>
        <tbody>
          {card.subjects.map((s) => (
            <tr key={s.subject_id}>
              <td className="rc-course">{s.name}</td>
              <td className="rc-max">{fmt(s.max)}</td>
              {value(s.points)}
            </tr>
          ))}
          <tr className="rc-foot">
            <td className="rc-course">{h.total_label}</td>
            <td className="rc-max">{fmt(card.max_total)}</td>
            <td className="rc-v">{fmt(card.total)}</td>
          </tr>
          <tr className="rc-foot">
            <td className="rc-course">{h.percentage_label}</td>
            <td className="rc-right-num" colSpan={2}>{card.percentage === null ? "" : `${card.percentage.toFixed(2)}%`}</td>
          </tr>
          <tr className="rc-foot">
            <td className="rc-course">{h.place_label}</td>
            <td className="rc-v">{card.position ?? ""}</td>
            <td className="rc-v">{card.class_size}</td>
          </tr>
          <tr className="rc-sign"><td className="rc-course">{h.parent_sign}</td><td colSpan={2} /></tr>
          <tr className="rc-sign"><td className="rc-course">{h.teacher_sign}</td><td colSpan={2} /></tr>
          <tr className="rc-sign">
            <td className="rc-course">{h.done_at}</td>
            <td colSpan={2}>{h.date_label} {dmy(h.date)}</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

const TERM_HEAD = ["1er", "2ème", "3ème"];
const DECISIONS = [
  ["promu", "L'ELEVE EST PROMU"],
  ["redoublement", "L'ELEVE EST ADMIS AU REDOUBLEMENT"],
  ["renvoye", "L'ELEVE EST RENVOYE"],
] as const;

function NurseryCard({ card }: { card: CardData }) {
  const h = card.header;
  const areas = h.areas ?? [];
  const terms = card.nursery?.terms ?? [];
  const rows = areas.flatMap((area) => [
    { kind: "area" as const, key: area.code, title: area.title },
    ...area.subjects.map((s) => ({ kind: "subject" as const, key: s.code, code: s.code, name: s.name })),
  ]);
  const rating = (sequence: number, code: string) =>
    terms.find((t) => t.sequence === sequence)?.ratings?.[code] ?? null;

  return (
    <article className="report-card nursery-card">
      <header className="nu-head">
        <div>
          <div>REPUBLIQUE DU RWANDA</div>
          <div>MINISTERE DE L'EDUCATION</div>
          <div>VILLE DE KIGALI</div>
          <div>DISTRICT DE NYARUGENGE</div>
          <div>SECTEUR DE NYAMIRAMBO</div>
          <div>JERICHO SCHOOL</div>
          <div>TEL: {h.phone}</div>
          <div>Email: {h.email}</div>
        </div>
        <div className="nu-id">
          <div>ANNEE SCOLAIRE: {h.academic_year}</div>
          <div className="nu-banner">{h.title}</div>
          <div className="nu-line"><span>NOM:</span><b>{card.student.name}</b></div>
          <div className="nu-line"><span>CLASSE:</span><b>{h.class.label}</b></div>
        </div>
      </header>

      <table className="nu-table">
        <thead>
          <tr>
            <th>COURS</th>
            <th>1<sup>er</sup> Trimestre</th>
            <th>2<sup>ème</sup> Trimestre</th>
            <th>3<sup>ème</sup> Trimestre</th>
            <th>OBSERVATION</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} className={row.kind === "area" ? "nu-area" : undefined}>
              {row.kind === "area" ? (
                <td colSpan={4}>{row.title}</td>
              ) : (
                <>
                  <td className="nu-course">{row.name}</td>
                  {[1, 2, 3].map((sequence) => {
                    const mark = rating(sequence, row.code);
                    return <td key={sequence} className={mark ? RATING_CLASS[mark] : undefined} />;
                  })}
                </>
              )}
              {index === 0 && (
                <td className="nu-obs" rowSpan={rows.length}>
                  {TERM_HEAD.map((label, i) => (
                    <div key={label} className="nu-obs-block">
                      <div>{label === "1er" ? <>1<sup>er</sup> Trimestre</> : <>{i + 1}<sup>ème</sup> Trimestre</>}</div>
                      <div className="nu-obs-text">{terms.find((t) => t.sequence === i + 1)?.observation}</div>
                    </div>
                  ))}
                </td>
              )}
            </tr>
          ))}
          <tr className="nu-key">
            <td>EXPLICATION</td>
            <td className="nu-excellent">EXCELLENT</td>
            <td className="nu-tres">TRES BON</td>
            <td className="nu-bon">BON</td>
            <td className="nu-assez">ASSEZ BON</td>
          </tr>
        </tbody>
      </table>

      <footer className="nu-foot">
        <div>
          <div className="nu-delib">DELIBERATION:</div>
          {DECISIONS.map(([value, label]) => (
            <div key={value} className={card.nursery?.decision === value ? "nu-chosen" : undefined}>{label}</div>
          ))}
        </div>
        <div className="nu-signs">
          <div>SIGNATURE DU TITULAIRE</div>
          <div>SIGNATURE DES PARENTS</div>
          <div>DATE: {dmy(h.date)}</div>
        </div>
      </footer>
    </article>
  );
}
