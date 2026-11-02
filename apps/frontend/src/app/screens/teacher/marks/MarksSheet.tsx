import { Loader2, Lock, Pencil, RotateCcw, Save, Send, Trash2 } from "lucide-react";
import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { sanitiseNumberTyping, validateScore } from "../../../../lib/academicRules";
import {
  CategoryBadge, ErrorState, FieldError, formatDate, Loading, PageHeader, StatusBadge,
} from "../../../components/academic";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../../../components/ui/alert-dialog";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { AssessmentDialog } from "./AssessmentDialog";

export interface AssessmentDetail {
  id: number; title: string; date: string; max_score: number; status: "draft" | "submitted";
  submitted_at: string | null; category: string | null; class_label: string; subject_name: string;
  term_name: string; term_status: string; term_start: string; term_end: string;
  teacher_name: string | null; teacher_avatar: string | null;
  students: { student_id: number; student_name: string; student_id_number: string | null; score: number | null; is_absent: boolean; percentage: number | null }[];
  analytics: { average: number | null; highest: number | null; lowest: number | null; recorded: number; total: number; absent: number };
}

interface Row { text: string; absent: boolean }

export function MarksSheet() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<AssessmentDetail | null>(null);
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "save" | "submit" | "reopen" | "delete">(null);
  const [confirm, setConfirm] = useState<null | "submit" | "delete" | "reopen">(null);
  const [editOpen, setEditOpen] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const apply = (d: AssessmentDetail) => {
    setData(d);
    setRows(Object.fromEntries(d.students.map((s) => [s.student_id, {
      text: s.score === null ? "" : String(s.score), absent: s.is_absent,
    }])));
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      if (!id || !/^\d{1,10}$/.test(id)) throw new Error("This assessment link is not valid");
      apply(await api.get<AssessmentDetail>(`/api/v1/academics/assessments/${id}`));
    } catch (e: any) {
      setError(e?.message ?? "Could not load the assessment");
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const editable = data?.status === "draft" && data.term_status === "active";

  const rowErrors = useMemo(() => {
    const out: Record<number, string | null> = {};
    if (!data) return out;
    for (const s of data.students) {
      const r = rows[s.student_id];
      out[s.student_id] = r && !r.absent ? validateScore(r.text, data.max_score).error : null;
    }
    return out;
  }, [rows, data]);
  const invalidCount = Object.values(rowErrors).filter(Boolean).length;
  const dirty = !!data && data.students.some((s) => {
    const r = rows[s.student_id];
    return r && (r.absent !== s.is_absent || r.text !== (s.score === null ? "" : String(s.score)));
  });
  const completed = data ? data.students.filter((s) => {
    const r = rows[s.student_id];
    return r && (r.absent || r.text.trim() !== "");
  }).length : 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setRow = (sid: number, patch: Partial<Row>) => setRows((prev) => ({ ...prev, [sid]: { ...prev[sid], ...patch } }));

  const save = async (quiet = false) => {
    if (!data) return false;
    if (invalidCount) { toast.error(`Fix ${invalidCount} mark${invalidCount === 1 ? "" : "s"} first`); return false; }
    const scores = data.students.map((s) => {
      const r = rows[s.student_id];
      if (r.absent) return { student_id: s.student_id, is_absent: true };
      const { value } = validateScore(r.text, data.max_score);
      return { student_id: s.student_id, score: value, is_absent: false };
    });
    setBusy("save");
    try {
      apply(await api.put<AssessmentDetail>(`/api/v1/academics/assessments/${data.id}/scores`, { scores }));
      if (!quiet) toast.success("Marks saved");
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save marks");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!data) return;
    if (dirty && !(await save(true))) return;
    setBusy("submit");
    try {
      apply(await api.post<AssessmentDetail>(`/api/v1/academics/assessments/${data.id}/submit`, {}));
      toast.success("Submitted. The dean can now see these marks.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not submit");
    } finally {
      setBusy(null);
    }
  };

  const reopen = async () => {
    if (!data) return;
    setBusy("reopen");
    try {
      apply(await api.post<AssessmentDetail>(`/api/v1/academics/assessments/${data.id}/reopen`, {}));
      toast.success("Reopened as a draft. Submit again when corrected.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reopen");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!data) return;
    setBusy("delete");
    try {
      await api.delete(`/api/v1/academics/assessments/${data.id}`);
      toast.success("Draft deleted");
      navigate("/teacher/marks");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete");
      setBusy(null);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); inputs.current[index + 1]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); inputs.current[index - 1]?.focus(); }
  };

  if (error) return <div className="space-y-6"><PageHeader title="Marks" back="/teacher/marks" /><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return <Loading />;

  const missing = data.students.length - completed;

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <PageHeader
        back="/teacher/marks"
        title={data.title}
        subtitle={<span>{data.subject_name} · {data.class_label} · {data.term_name} · {formatDate(data.date)} · out of <b>{data.max_score}</b></span>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={data.category} />
            <StatusBadge status={data.status} />
          </div>
        }
      />

      {!editable && (
        <div className="flex items-start gap-3 rounded-xl border p-3 text-sm bg-white" style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}>
          <Lock size={16} className="mt-0.5 flex-shrink-0" style={{ color: "var(--mid-gray)" }} />
          {data.term_status === "closed"
            ? `${data.term_name} is closed, so these marks are final.`
            : data.term_status !== "active"
            ? `${data.term_name} is not open. Marks can be changed only while the dean has the term open.`
            : `Submitted ${data.submitted_at ? formatDate(data.submitted_at) : ""}. Reopen it to correct a mark; the dean is told when you do.`}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Marked" value={`${completed}/${data.students.length}`} />
        <Stat label="Absent" value={String(Object.values(rows).filter((r) => r.absent).length)} />
        <Stat label="Class average" value={data.analytics.average === null ? "—" : `${data.analytics.average}%`} />
        <Stat label="Highest / lowest" value={data.analytics.highest === null ? "—" : `${data.analytics.highest}% / ${data.analytics.lowest}%`} />
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ backgroundColor: "var(--light-gray)", color: "var(--mid-gray)" }}>
                <th className="px-4 py-3 w-10 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Pupil</th>
                <th className="px-4 py-3 font-medium w-40">Mark / {data.max_score}</th>
                <th className="px-4 py-3 font-medium w-24">Absent</th>
                <th className="px-4 py-3 font-medium w-20 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => {
                const r = rows[s.student_id] ?? { text: "", absent: false };
                const err = rowErrors[s.student_id];
                const parsed = validateScore(r.text, data.max_score).value;
                return (
                  <tr key={s.student_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--mid-gray)" }}>{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium" style={{ color: "var(--dark-gray)" }}>{s.student_name}</div>
                      {s.student_id_number && <div className="text-xs" style={{ color: "var(--mid-gray)" }}>{s.student_id_number}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        ref={(el) => { inputs.current[i] = el; }}
                        inputMode="decimal" autoComplete="off"
                        aria-label={`Mark for ${s.student_name}`}
                        value={r.absent ? "" : r.text}
                        placeholder={r.absent ? "Absent" : "—"}
                        disabled={!editable || r.absent}
                        onChange={(e) => { const v = sanitiseNumberTyping(e.target.value); if (v !== null) setRow(s.student_id, { text: v }); }}
                        onKeyDown={(e) => onKey(e, i)}
                        aria-invalid={!!err}
                        className="h-9 w-28 tabular-nums"
                        style={err ? { borderColor: "var(--danger-red)" } : undefined}
                      />
                      <FieldError message={err} />
                    </td>
                    <td className="px-4 py-2">
                      <Checkbox checked={r.absent} disabled={!editable}
                        aria-label={`${s.student_name} was absent`}
                        onCheckedChange={(v) => setRow(s.student_id, { absent: v === true, text: v === true ? "" : r.text })} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--mid-gray)" }}>
                      {r.absent || parsed === null || err ? "—" : `${Math.round((parsed / data.max_score) * 1000) / 10}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {data.students.length === 0 && (
          <p className="text-sm text-center py-10" style={{ color: "var(--mid-gray)" }}>This class has no pupils yet.</p>
        )}
      </div>

      <div className="fixed md:static bottom-0 left-0 right-0 z-10 bg-white md:bg-transparent border-t md:border-0 p-3 md:p-0 flex flex-wrap gap-2 justify-end"
        style={{ borderColor: "var(--border)" }}>
        {editable ? (
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => setConfirm("delete")} disabled={!!busy}
              style={{ color: "var(--danger-red)" }}>
              <Trash2 size={16} className="mr-1.5" /> Delete draft
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} disabled={!!busy || dirty}
              title={dirty ? "Save the marks first" : undefined}>
              <Pencil size={16} className="mr-1.5" /> Details
            </Button>
            <Button variant="outline" onClick={() => save()} disabled={!!busy || !dirty || invalidCount > 0}>
              {busy === "save" ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Save size={16} className="mr-1.5" />}
              Save draft
            </Button>
            <Button onClick={() => setConfirm("submit")} disabled={!!busy || invalidCount > 0 || data.students.length === 0}
              style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              {busy === "submit" ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Send size={16} className="mr-1.5" />}
              Submit to dean
            </Button>
          </>
        ) : data.status === "submitted" && data.term_status === "active" ? (
          <Button variant="outline" onClick={() => setConfirm("reopen")} disabled={!!busy}>
            {busy === "reopen" ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <RotateCcw size={16} className="mr-1.5" />}
            Reopen to correct
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "submit" ? "Submit these marks?" : confirm === "delete" ? "Delete this draft?" : "Reopen this assessment?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "submit"
                ? missing > 0
                  ? `${missing} pupil${missing === 1 ? " has" : "s have"} no mark. Enter a mark or tick Absent for every pupil before submitting.`
                  : `The dean will see ${data.students.length} marks for ${data.title}. You can reopen it later to correct a mistake while the term is open.`
                : confirm === "delete"
                  ? "The assessment and every mark entered for it will be removed. This cannot be undone."
                  : "It returns to draft and stops counting on reports until you submit it again. The dean is notified."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!(confirm === "submit" && missing > 0) && (
              <AlertDialogAction
                onClick={() => { const c = confirm; setConfirm(null); if (c === "submit") submit(); if (c === "delete") remove(); if (c === "reopen") reopen(); }}
                style={{ backgroundColor: confirm === "delete" ? "var(--danger-red)" : "var(--maroon)", color: "#fff" }}>
                {confirm === "submit" ? "Submit" : confirm === "delete" ? "Delete" : "Reopen"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AssessmentDialog mode="edit" open={editOpen} onOpenChange={setEditOpen}
        assessment={{ ...data, date: data.date }} onSaved={() => load()} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs" style={{ color: "var(--mid-gray)" }}>{label}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5" style={{ color: "var(--dark-gray)" }}>{value}</div>
    </div>
  );
}
