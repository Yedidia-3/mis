import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { sanitiseNumberTyping, validateScore } from "../../../lib/academicRules";
import { EmptyState, ErrorState, Loading } from "../../components/academic";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

interface Student { id: number; name: string }
interface Subject { id: number; code: string; name: string; max: number }
interface Term { id: number; name: string; status: string }
interface Sheet {
  mode: "nursery" | "midterm";
  label: string;
  term: Term;
  locked: boolean;
  students: Student[];
  subjects?: Subject[];
  scores?: { student_id: number; subject_id: number; score: number }[];
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

  const load = useCallback(async (nextTerm?: string) => {
    setError(null);
    const q = new URLSearchParams({ class_id: classId });
    if (nextTerm) q.set("term_id", nextTerm);
    try {
      const res = await api.get<Payload>(`/api/v1/academics/assessments/recording-sheet?${q}`);
      setData(res);
      const term = nextTerm
        || (res.sheet?.term?.id ? String(res.sheet.term.id) : "")
        || (res.current_term_id ? String(res.current_term_id) : res.terms[0] ? String(res.terms[0].id) : "");
      setTermId(term);
    } catch (e: any) {
      setError(e?.message ?? "Could not open the mid-term sheet");
    }
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const subjects = data?.sheet?.mode === "midterm" ? data.sheet.subjects ?? [] : [];
    setSubjectId((current) => subjects.some((s) => String(s.id) === current) ? current : subjects[0] ? String(subjects[0].id) : "");
  }, [data]);

  useEffect(() => {
    const current = data?.sheet?.mode === "midterm" ? data.sheet : null;
    const picked = current?.subjects?.find((s) => String(s.id) === subjectId);
    const next: Record<number, string> = {};
    if (picked) {
      for (const row of current?.scores ?? []) {
        if (row.subject_id === picked.id) next[row.student_id] = String(row.score);
      }
    }
    setMarks(next);
  }, [data, subjectId]);

  const sheet = data?.sheet?.mode === "midterm" ? data.sheet : null;
  const subject = sheet?.subjects?.find((s) => String(s.id) === subjectId) ?? null;
  const locked = !!sheet?.locked;

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

  const save = async () => {
    if (!sheet || !subject || markError) return;
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
      setData(res);
      toast.success(`${subject.name} saved`);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the marks");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={() => load(termId)} />;
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
        You record only the lesson the dean assigned to you in this class.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-sm" style={{ color: "var(--mid-gray)" }}>
            Lesson
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger className="mt-1 bg-white" aria-label="Lesson"><SelectValue placeholder="Lesson" /></SelectTrigger>
              <SelectContent>
                {sheet.subjects.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>{item.name} · out of {item.max}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="text-sm" style={{ color: "var(--mid-gray)" }}>
            Term
            <Select value={termId} onValueChange={(v) => { setTermId(v); load(v); }}>
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Back to class list</Button>
          <Button onClick={save} disabled={locked || saving || !!markError}
            style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
            {saving ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Save size={16} className="mr-1.5" />}
            Save marks
          </Button>
        </div>
      </div>

      {locked && (
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
        One mark for this lesson. The maximum comes from the mid-term sheet, so you only type the points.
      </p>
    </div>
  );
}
