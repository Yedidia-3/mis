import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { sanitiseNumberTyping, validateScore } from "../../../../lib/academicRules";
import { EmptyState, ErrorState, Loading, PageHeader } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

type Rating = "excellent" | "tres_bon" | "bon" | "assez_bon";
const RATINGS: { value: Rating; label: string; color: string }[] = [
  { value: "excellent", label: "Excellent", color: "#7dce6a" },
  { value: "tres_bon", label: "Très bon", color: "#6eb0e0" },
  { value: "bon", label: "Bon", color: "#ffe14a" },
  { value: "assez_bon", label: "Assez bon", color: "#fff3b0" },
];
const DECISIONS = [
  { value: "promu", label: "Promu" },
  { value: "redoublement", label: "Admis au redoublement" },
  { value: "renvoye", label: "Renvoyé" },
];

interface Student { id: number; name: string; student_id_number: string | null }
interface Subject { id: number; code: string; name: string; max: number }
interface Area { code: string; title: string; subjects: { code: string; name: string }[] }
interface Term { id: number; name: string; status: string }
interface ClassOption { id: number; label: string; mode: "nursery" | "midterm" }
interface Sheet {
  mode: "nursery" | "midterm";
  label: string;
  term: Term;
  locked: boolean;
  students: Student[];
  subjects?: Subject[];
  scores?: { student_id: number; subject_id: number; score: number }[];
  areas?: Area[];
  ratings?: { student_id: number; subject_code: string; rating: Rating }[];
  observations?: { student_id: number; observation: string }[];
  decisions?: { student_id: number; decision: string }[];
}
interface Payload {
  academic_year: { id: number; name: string } | null;
  current_term_id: number | null;
  classes: ClassOption[];
  terms: Term[];
  sheet: Sheet | null;
}

export function MarksList() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState<string>("");
  const [termId, setTermId] = useState<string>("");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<Record<string, Rating | "">>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [decisions, setDecisions] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (nextClass?: string, nextTerm?: string) => {
    setError(null);
    const q = new URLSearchParams();
    if (nextClass) q.set("class_id", nextClass);
    if (nextTerm) q.set("term_id", nextTerm);
    try {
      const res = await api.get<Payload>(`/api/v1/academics/assessments/recording-sheet${q.size ? `?${q}` : ""}`);
      setData(res);
      const cls = nextClass || (res.classes[0] ? String(res.classes[0].id) : "");
      const term = nextTerm || (res.current_term_id ? String(res.current_term_id) : res.terms[0] ? String(res.terms[0].id) : "");
      if (!nextClass && cls) {
        setClassId(cls);
        setTermId(term);
        return load(cls, term);
      }
      setClassId(cls);
      setTermId(term);
      const sheet = res.sheet;
      if (sheet?.mode === "midterm") {
        const next: Record<string, string> = {};
        for (const row of sheet.scores ?? []) next[`${row.student_id}:${row.subject_id}`] = String(row.score);
        setMarks(next);
      } else if (sheet?.mode === "nursery") {
        const next: Record<string, Rating | ""> = {};
        for (const row of sheet.ratings ?? []) next[`${row.student_id}:${row.subject_code}`] = row.rating;
        setRatings(next);
        setNotes(Object.fromEntries((sheet.observations ?? []).map((o) => [o.student_id, o.observation])));
        setDecisions(Object.fromEntries((sheet.decisions ?? []).map((d) => [d.student_id, d.decision])));
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not load the mark sheet");
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const sheet = data?.sheet ?? null;
  const locked = !!sheet?.locked;

  const markError = useMemo(() => {
    if (sheet?.mode !== "midterm") return null;
    for (const subject of sheet.subjects ?? []) {
      for (const student of sheet.students) {
        const message = validateScore(marks[`${student.id}:${subject.id}`] ?? "", subject.max).error;
        if (message) return `${student.name}, ${subject.name}: ${message}`;
      }
    }
    return null;
  }, [sheet, marks]);

  const save = async () => {
    if (!sheet || markError) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { class_id: Number(classId), term_id: Number(termId) };
      if (sheet.mode === "midterm") {
        body.scores = sheet.students.flatMap((student) => (sheet.subjects ?? []).map((subject) => {
          const raw = (marks[`${student.id}:${subject.id}`] ?? "").trim();
          return { student_id: student.id, subject_id: subject.id, score: raw === "" ? null : Number(raw) };
        }));
      } else {
        const codes = (sheet.areas ?? []).flatMap((a) => a.subjects.map((s) => s.code));
        body.ratings = sheet.students.flatMap((student) => codes.map((code) => ({
          student_id: student.id,
          subject_code: code,
          rating: ratings[`${student.id}:${code}`] || null,
        })));
        body.observations = sheet.students.map((student) => ({
          student_id: student.id,
          observation: notes[student.id] ?? "",
        }));
        body.decisions = sheet.students.map((student) => ({
          student_id: student.id,
          decision: decisions[student.id] || null,
        }));
      }
      const res = await api.put<Payload>("/api/v1/academics/assessments/recording-sheet", body);
      setData(res);
      toast.success("Marks saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks"
        subtitle={sheet?.mode === "nursery"
          ? "Tap a colour for each activity. The bulletin prints that colour. Add a short observation for the term."
          : "Enter each pupil's points. The maximum is already on the sheet, so you only type the mark."}
        actions={
          <Button onClick={save} disabled={!sheet || locked || saving || !!markError}
            style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
            {saving ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Save size={16} className="mr-1.5" />}
            Save
          </Button>
        }
      />

      {error ? <ErrorState message={error} onRetry={() => load(classId, termId)} /> : !data ? <Loading /> : data.classes.length === 0 ? (
        <EmptyState icon={<Save size={44} />} title="No class to record">
          Marks open once the dean has given you a class.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={classId} onValueChange={(v) => { setClassId(v); load(v, termId); }}>
              <SelectTrigger className="w-full sm:w-56 bg-white" aria-label="Class"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                {data.classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={termId} onValueChange={(v) => { setTermId(v); load(classId, v); }}>
              <SelectTrigger className="w-full sm:w-56 bg-white" aria-label="Term"><SelectValue placeholder="Term" /></SelectTrigger>
              <SelectContent>
                {data.terms.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}{t.status === "active" ? " (current)" : t.status === "closed" ? " (closed)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sheet?.locked && (
            <p className="text-sm rounded-xl border p-3" style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}>
              {sheet.term.name} is {sheet.term.status === "closed" ? "closed" : "not open"}, so these marks cannot be changed.
            </p>
          )}
          {markError && <p className="text-sm" style={{ color: "var(--danger-red)" }}>{markError}</p>}

          {!data.terms.length ? (
            <EmptyState icon={<Save size={44} />} title="No term yet">
              The dean sets up the terms, then opens the current one, before marks can be recorded.
            </EmptyState>
          ) : !sheet ? <Loading /> : sheet.students.length === 0 ? (
            <EmptyState icon={<Save size={44} />} title="This class has no pupils" />
          ) : sheet.mode === "midterm" ? (
            sheet.subjects?.length ? <MidtermGrid sheet={sheet} marks={marks} setMarks={setMarks} locked={locked} /> : (
              <EmptyState icon={<Save size={44} />} title="No subject of yours on this bulletin">
                The mid-term sheet lists Mathematics, Social Studies, Kinyarwanda, English, SET and French.
              </EmptyState>
            )
          ) : (
            <NurseryGrid sheet={sheet} ratings={ratings} setRatings={setRatings} notes={notes} setNotes={setNotes}
              decisions={decisions} setDecisions={setDecisions} locked={locked} />
          )}
        </>
      )}
    </div>
  );
}

function MidtermGrid({ sheet, marks, setMarks, locked }: {
  sheet: Sheet; marks: Record<string, string>; setMarks: (v: Record<string, string>) => void; locked: boolean;
}) {
  const subjects = sheet.subjects ?? [];
  const set = (studentId: number, subjectId: number, raw: string) => {
    const value = sanitiseNumberTyping(raw);
    if (value === null) return;
    setMarks({ ...marks, [`${studentId}:${subjectId}`]: value });
  };
  return (
    <div className="bg-white rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
      <table className="w-full text-sm min-w-[720px]">
        <thead>
          <tr style={{ backgroundColor: "var(--light-gray)", color: "var(--mid-gray)" }}>
            <th className="text-left px-3 py-3 font-medium sticky left-0 bg-[var(--light-gray)]">Pupil</th>
            {subjects.map((s) => (
              <th key={s.id} className="px-2 py-3 font-medium text-center">
                <div style={{ color: "var(--dark-gray)" }}>{s.name}</div>
                <div className="text-xs font-normal">out of {s.max}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.students.map((student, row) => (
            <tr key={student.id} className="border-t" style={{ borderColor: "var(--border)" }}>
              <td className="px-3 py-2 sticky left-0 bg-white">
                <div className="font-medium" style={{ color: "var(--dark-gray)" }}>{student.name}</div>
              </td>
              {subjects.map((subject, col) => (
                <td key={subject.id} className="px-2 py-2">
                  <Input inputMode="decimal" disabled={locked} aria-label={`${student.name} ${subject.name}`}
                    value={marks[`${student.id}:${subject.id}`] ?? ""}
                    onChange={(e) => set(student.id, subject.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        document.getElementById(`m-${row + 1}-${col}`)?.focus();
                      }
                    }}
                    id={`m-${row}-${col}`}
                    className="text-right tabular-nums" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NurseryGrid({ sheet, ratings, setRatings, notes, setNotes, decisions, setDecisions, locked }: {
  sheet: Sheet;
  ratings: Record<string, Rating | "">;
  setRatings: (v: Record<string, Rating | "">) => void;
  notes: Record<number, string>;
  setNotes: (v: Record<number, string>) => void;
  decisions: Record<number, string>;
  setDecisions: (v: Record<number, string>) => void;
  locked: boolean;
}) {
  const areas = sheet.areas ?? [];
  const pick = (studentId: number, code: string, value: Rating) => {
    const key = `${studentId}:${code}`;
    setRatings({ ...ratings, [key]: ratings[key] === value ? "" : value });
  };
  return (
    <div className="space-y-4">
      {sheet.students.map((student) => (
        <section key={student.id} className="bg-white rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <h3 className="font-semibold" style={{ color: "var(--dark-gray)" }}>{student.name}</h3>
            <label className="text-sm flex items-center gap-2" style={{ color: "var(--mid-gray)" }}>
              Deliberation
              <select className="border rounded-md px-2 py-1 bg-white" style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}
                aria-label={`Deliberation for ${student.name}`}
                value={decisions[student.id] ?? ""}
                onChange={(e) => setDecisions({ ...decisions, [student.id]: e.target.value })}>
                <option value="">Not yet</option>
                {DECISIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </label>
          </div>
          {areas.map((area) => (
            <div key={area.code} className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--mid-gray)" }}>{area.title}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {area.subjects.map((subject) => {
                  const current = ratings[`${student.id}:${subject.code}`] ?? "";
                  return (
                    <div key={subject.code} className="flex items-center justify-between gap-2">
                      <span className="text-sm" style={{ color: "var(--dark-gray)" }}>{subject.name}</span>
                      <div className="flex gap-1" role="radiogroup" aria-label={subject.name}>
                        {RATINGS.map((r) => {
                          const on = current === r.value;
                          return (
                            <button key={r.value} type="button" disabled={locked}
                              aria-label={`${r.label} for ${subject.name}`}
                              aria-pressed={on}
                              onClick={() => pick(student.id, subject.code, r.value)}
                              className="h-7 w-7 rounded-md border"
                              style={{
                                backgroundColor: r.color,
                                borderColor: on ? "var(--dark-gray)" : "transparent",
                                outline: on ? "2px solid var(--dark-gray)" : undefined,
                              }} />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <label className="block text-sm" style={{ color: "var(--mid-gray)" }}>
            Observation for this term
            <Input className="mt-1" maxLength={100} disabled={locked} value={notes[student.id] ?? ""}
              aria-label={`Observation for ${student.name}`}
              onChange={(e) => setNotes({ ...notes, [student.id]: e.target.value })} />
          </label>
        </section>
      ))}
      <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--mid-gray)" }}>
        {RATINGS.map((r) => (
          <span key={r.value} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: r.color }} /> {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}
