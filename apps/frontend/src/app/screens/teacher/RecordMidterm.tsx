import { Loader2, RotateCcw, Save, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { sanitiseNumberTyping, validateScore } from "../../../lib/academicRules";
import { EmptyState, ErrorState, Loading } from "../../components/academic";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

interface Student { id: number; name: string }
interface Subject { id: number; code: string; name: string; max: number; submitted?: boolean }
interface Term { id: number; name: string; status: string }
interface Sheet {
  mode: "nursery" | "midterm";
  label: string;
  term: Term;
  locked: boolean;
  students: Student[];
  subjects?: Subject[];
  scores?: { student_id: number; subject_id: number; score: number }[];
  submissions?: { subject_id: number; status: string; submitted_at: string }[];
}
interface Payload {
  current_term_id: number | null;
  terms: Term[];
  sheet: Sheet | null;
}

export function RecordMidterm({ classId, onClose }: { classId: string; onClose: () => void }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<"all" | "blank" | "recorded">("all");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const applySheet = (res: Payload, keepSubject?: string) => {
    setData(res);
    const term = (res.sheet?.term?.id ? String(res.sheet.term.id) : "")
      || (res.current_term_id ? String(res.current_term_id) : res.terms[0] ? String(res.terms[0].id) : "");
    setTermId(term);
    const subjects = res.sheet?.mode === "midterm" ? res.sheet.subjects ?? [] : [];
    const chosen = subjects.some((s) => String(s.id) === keepSubject) ? keepSubject!
      : subjects[0] ? String(subjects[0].id) : "";
    setSubjectId(chosen);
    const picked = subjects.find((s) => String(s.id) === chosen);
    const next: Record<number, string> = {};
    if (picked) {
      for (const row of res.sheet?.scores ?? []) {
        if (row.subject_id === picked.id) next[row.student_id] = String(row.score);
      }
    }
    setMarks(next);
  };

  const load = useCallback(async (nextTerm?: string, keepSubject?: string) => {
    setError(null);
    const q = new URLSearchParams({ class_id: classId });
    if (nextTerm) q.set("term_id", nextTerm);
    try {
      const res = await api.get<Payload>(`/api/v1/academics/assessments/recording-sheet?${q}`);
      applySheet(res, keepSubject);
    } catch (e: any) {
      setError(e?.message ?? "Could not open the mid-term sheet");
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  const sheet = data?.sheet?.mode === "midterm" ? data.sheet : null;
  const subject = sheet?.subjects?.find((s) => String(s.id) === subjectId) ?? null;
  const submitted = !!subject?.submitted;
  const locked = !!sheet?.locked || submitted;

  const rows = useMemo(() => {
    if (!sheet) return [];
    const q = search.trim().toLowerCase();
    return sheet.students.filter((student) => {
      if (q && !student.name.toLowerCase().includes(q)) return false;
      const value = (marks[student.id] ?? "").trim();
      if (filter === "blank") return value === "";
      if (filter === "recorded") return value !== "";
      return true;
    });
  }, [sheet, search, filter, marks]);

  const markError = useMemo(() => {
    if (!subject) return null;
    for (const student of sheet?.students ?? []) {
      const message = validateScore(marks[student.id] ?? "", subject.max).error;
      if (message) return `${student.name}: ${message}`;
    }
    return null;
  }, [sheet, subject, marks]);

  const blankCount = useMemo(() => {
    if (!sheet || !subject) return 0;
    return sheet.students.filter((student) => !(marks[student.id] ?? "").trim()).length;
  }, [sheet, subject, marks]);

  const chooseSubject = (id: string) => {
    setSubjectId(id);
    const picked = sheet?.subjects?.find((s) => String(s.id) === id);
    const next: Record<number, string> = {};
    if (picked) {
      for (const row of sheet?.scores ?? []) {
        if (row.subject_id === picked.id) next[row.student_id] = String(row.score);
      }
    }
    setMarks(next);
  };

  const save = async () => {
    if (!sheet || !subject || markError || submitted) return;
    setSaving(true);
    try {
      const res = await api.put<Payload>("/api/v1/academics/assessments/recording-sheet", {
        class_id: Number(classId),
        term_id: Number(termId),
        scores: sheet.students.map((student) => {
          const raw = (marks[student.id] ?? "").trim();
          return { student_id: student.id, subject_id: subject.id, score: raw === "" ? null : Number(raw) };
        }),
      });
      applySheet(res, String(subject.id));
      toast.success(`${subject.name} saved`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the marks");
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!sheet || !subject || markError || submitted || blankCount > 0) return;
    setSubmitting(true);
    try {
      await saveQuiet();
      const res = await api.post<Payload>("/api/v1/academics/assessments/recording-sheet/submit", {
        class_id: Number(classId),
        term_id: Number(termId),
        subject_id: subject.id,
      });
      applySheet(res, String(subject.id));
      toast.success(`${subject.name} submitted to the dean`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit to the dean");
    } finally {
      setSubmitting(false);
    }
  };

  const saveQuiet = async () => {
    if (!sheet || !subject) return;
    const res = await api.put<Payload>("/api/v1/academics/assessments/recording-sheet", {
      class_id: Number(classId),
      term_id: Number(termId),
      scores: sheet.students.map((student) => {
        const raw = (marks[student.id] ?? "").trim();
        return { student_id: student.id, subject_id: subject.id, score: raw === "" ? null : Number(raw) };
      }),
    });
    applySheet(res, String(subject.id));
  };

  const reopen = async () => {
    if (!sheet || !subject || !submitted) return;
    setSubmitting(true);
    try {
      const res = await api.post<Payload>("/api/v1/academics/assessments/recording-sheet/reopen", {
        class_id: Number(classId),
        term_id: Number(termId),
        subject_id: subject.id,
      });
      applySheet(res, String(subject.id));
      toast.success(`${subject.name} reopened for corrections`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reopen the lesson");
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => load(termId, subjectId)} />;
  if (!data) return <Loading />;
  if (data.sheet && data.sheet.mode !== "midterm") {
    return (
      <EmptyState icon={<Save size={44} />} title="This class does not take a mid-term mark">
        Nursery teachers record colours on the bulletin. Mid-term marks are for P1 to P6.
      </EmptyState>
    );
  }
  if (!data.terms.length) {
    return (
      <EmptyState icon={<Save size={44} />} title="No term yet">
        The dean opens the current term before mid-term marks can be recorded.
      </EmptyState>
    );
  }
  if (!sheet?.subjects?.length) {
    return (
      <EmptyState icon={<Save size={44} />} title="No lesson of yours on this mid-term">
        The lessons here are the ones the dean assigned you in this class.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-sm" style={{ color: "var(--mid-gray)" }}>
            Lesson
            <Select value={subjectId} onValueChange={chooseSubject}>
              <SelectTrigger className="mt-1 bg-white" aria-label="Lesson"><SelectValue placeholder="Lesson" /></SelectTrigger>
              <SelectContent>
                {sheet.subjects.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} · out of {item.max}{item.submitted ? " · submitted" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-sm" style={{ color: "var(--mid-gray)" }}>
            Term
            <Select value={termId} onValueChange={(v) => { setTermId(v); load(v, subjectId); }}>
              <SelectTrigger className="mt-1 bg-white" aria-label="Term"><SelectValue placeholder="Term" /></SelectTrigger>
              <SelectContent>
                {data.terms.map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {term.name}{term.status === "active" ? " (current)" : term.status === "closed" ? " (closed)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onClose}>Back to class list</Button>
        </div>
      </div>

      <div className="rounded-2xl border p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ borderColor: "var(--border)", backgroundColor: "color-mix(in srgb, var(--maroon) 6%, white)" }}>
        <div className="text-sm" style={{ color: "var(--dark-gray)" }}>
          {submitted
            ? `${subject?.name} is with the dean. Reopen only to correct a mark.`
            : blankCount > 0
              ? `Save as you go. ${blankCount} pupil${blankCount === 1 ? "" : "s"} still need a mark before Submit to dean.`
              : `Every pupil has a mark for ${subject?.name}. Submit to dean when you are ready.`}
        </div>
        <div className="flex flex-wrap gap-2">
          {!submitted ? (
            <>
              <Button onClick={save} disabled={locked || saving || submitting || !!markError}
                style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>
                {saving ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Save size={16} className="mr-1.5" />}
                Save
              </Button>
              <Button onClick={submit}
                disabled={locked || saving || submitting || !!markError || blankCount > 0}
                style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                {submitting ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Send size={16} className="mr-1.5" />}
                Submit to dean
              </Button>
            </>
          ) : (
            <Button onClick={reopen} disabled={sheet.locked || submitting}
              style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              {submitting ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <RotateCcw size={16} className="mr-1.5" />}
              Reopen to correct
            </Button>
          )}
        </div>
      </div>

      {sheet.locked && !submitted && (
        <p className="text-sm rounded-xl border p-3" style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}>
          {sheet.term.name} is {sheet.term.status === "closed" ? "closed" : "not open"}, so these marks cannot be changed.
        </p>
      )}
      {markError && <p className="text-sm" style={{ color: "var(--danger-red)" }}>{markError}</p>}

      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search pupil" className="h-11" />
        <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "blank" | "recorded")}>
          <SelectTrigger className="w-full sm:w-52 h-11 bg-white" aria-label="Filter pupils"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All pupils</SelectItem>
            <SelectItem value="blank">Not yet recorded</SelectItem>
            <SelectItem value="recorded">Already recorded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-2xl border overflow-x-auto" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>
              <th className="text-left px-3 py-3 font-medium w-12">#</th>
              <th className="text-left px-3 py-3 font-medium">Pupil</th>
              <th className="text-right px-3 py-3 font-medium w-40">
                {subject?.name} <span className="font-normal opacity-80">/ {subject?.max}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="px-3 py-8 text-center" style={{ color: "var(--mid-gray)" }}>No pupils match this filter.</td></tr>
            ) : rows.map((student, index) => (
              <tr key={student.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                <td className="px-3 py-2" style={{ color: "var(--mid-gray)" }}>{index + 1}</td>
                <td className="px-3 py-2 font-medium" style={{ color: "var(--dark-gray)" }}>{student.name}</td>
                <td className="px-3 py-2">
                  <Input inputMode="decimal" disabled={locked} aria-label={`${student.name} ${subject?.name ?? "mark"}`}
                    value={marks[student.id] ?? ""}
                    onChange={(e) => {
                      const value = sanitiseNumberTyping(e.target.value);
                      if (value === null || !subject) return;
                      setMarks({ ...marks, [student.id]: value });
                    }}
                    className="text-right tabular-nums" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs" style={{ color: "var(--mid-gray)" }}>
        Use Save while you type. Use Submit to dean when the lesson sheet is complete.
      </p>
    </div>
  );
}
