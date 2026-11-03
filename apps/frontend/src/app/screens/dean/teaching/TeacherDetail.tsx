import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import {
  EmptyState, ErrorState, Loading, PageHeader, TeacherAvatar,
} from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { AssignDialog } from "./AssignDialog";

interface Year { id: number; name: string; status: string }
interface SubjectRow {
  assignment_id: number; subject_id: number; subject_name: string; subject_code: string;
  periods_per_week: number; is_auto_generated: boolean;
}
interface ClassGroup {
  class_id: number; class_label: string; p_level_id: number; p_level_name: string;
  teaching_model: string; subjects: SubjectRow[];
}
interface Detail {
  teacher: { id: number; name: string; email: string; avatar: string | null };
  levels: string[];
  classes: ClassGroup[];
  load: {
    periods_per_week: number; max_periods_per_week: number | null; is_overloaded: boolean;
    class_count: number; subject_count: number;
  };
}
interface BoardClass {
  class_id: number; class_label: string; p_level_id: number; p_level_name: string;
  teaching_model: string;
  subjects: {
    subject_id: number; subject_name: string; subject_code: string; periods_per_week: number;
    teacher_id: number | null; teacher_name: string | null; unassigned: boolean;
  }[];
}

export function TeacherDetail() {
  const { teacherId } = useParams();
  const id = Number(teacherId);
  const [year, setYear] = useState<Year | null>(null);
  const [data, setData] = useState<Detail | null>(null);
  const [board, setBoard] = useState<BoardClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id < 1) {
      setError("That teacher was not found");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const years = await api.get<Year[]>("/api/v1/academics/academic-years");
      const active = years.find((y) => y.status === "active") ?? years[0] ?? null;
      setYear(active);
      if (!active) { setData(null); setBoard([]); return; }
      const [detail, boardRes] = await Promise.all([
        api.get<Detail>(`/api/v1/academics/teaching/teachers/${id}?academic_year_id=${active.id}`),
        api.get<{ classes: BoardClass[] }>(`/api/v1/academics/teaching/board?academic_year_id=${active.id}`),
      ]);
      setData(detail);
      setBoard(boardRes.classes);
    } catch (e: any) {
      setError(e?.message ?? "Could not load this teacher");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const existingByClass = useMemo(() => {
    const map: Record<number, number[]> = {};
    for (const c of data?.classes ?? []) {
      map[c.class_id] = c.subjects.map((s) => s.subject_id);
    }
    return map;
  }, [data]);

  const removeOne = async (assignmentId: number, label: string) => {
    setRemoving(assignmentId);
    try {
      await api.delete(`/api/v1/academics/teaching/${assignmentId}`);
      toast.success(`Removed ${label}`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove the assignment");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : !data || !year ? (
        <EmptyState icon={<TeacherAvatar name="?" size={44} />} title="Teacher not found" />
      ) : (
        <>
          <PageHeader
            back="/dean/teaching"
            title={
              <span className="inline-flex items-center gap-3">
                <TeacherAvatar name={data.teacher.name} avatar={data.teacher.avatar} size={44} />
                {data.teacher.name}
              </span>
            }
            subtitle={`${data.teacher.email} · ${year.name} · ${data.load.class_count} class${data.load.class_count === 1 ? "" : "es"} · ${data.load.subject_count} course${data.load.subject_count === 1 ? "" : "s"} · ${data.load.periods_per_week} periods/week${data.load.max_periods_per_week != null ? ` / ${data.load.max_periods_per_week}` : ""}`}
            actions={
              <Button onClick={() => setDialog(true)} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                <Pencil size={16} className="mr-1.5" /> Assign classes & courses
              </Button>
            }
          />

          {data.load.is_overloaded && (
            <div className="rounded-xl border p-3 text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--maroon) 35%, white)", backgroundColor: "color-mix(in srgb, var(--maroon) 6%, white)", color: "var(--dark-gray)" }}>
              This load is above the weekly period cap for their levels. Reduce courses or raise the cap on the P-level.
            </div>
          )}

          {data.classes.length === 0 ? (
            <EmptyState icon={<TeacherAvatar name={data.teacher.name} avatar={data.teacher.avatar} size={44} />} title="No classes assigned yet">
              Assign the classes and courses {data.teacher.name.split(" ")[0]} teaches — they can span more than one level.
            </EmptyState>
          ) : (
            <div className="grid gap-4">
              {data.classes.map((c) => (
                <div key={c.class_id} className="bg-white rounded-2xl border p-4 md:p-5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="font-semibold" style={{ color: "var(--dark-gray)" }}>{c.class_label}</div>
                      <div className="text-sm" style={{ color: "var(--mid-gray)" }}>
                        {c.p_level_name} · {c.teaching_model === "class_teacher" ? "Class-teacher level" : "Specialist level"}
                      </div>
                    </div>
                    <div className="text-sm tabular-nums" style={{ color: "var(--mid-gray)" }}>
                      {c.subjects.reduce((n, s) => n + s.periods_per_week, 0)} periods/week
                    </div>
                  </div>
                  <ul className="mt-3 divide-y" style={{ borderColor: "var(--border)" }}>
                    {c.subjects.map((s) => (
                      <li key={s.assignment_id} className="flex items-center justify-between gap-3 py-2.5" style={{ borderColor: "var(--border)" }}>
                        <div className="min-w-0">
                          <div className="font-medium truncate" style={{ color: "var(--dark-gray)" }}>{s.subject_name}</div>
                          <div className="text-xs" style={{ color: "var(--mid-gray)" }}>
                            {s.subject_code} · {s.periods_per_week} periods/week
                            {s.is_auto_generated ? " · from class teacher" : ""}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" disabled={removing === s.assignment_id}
                          onClick={() => removeOne(s.assignment_id, s.subject_name)}
                          aria-label={`Remove ${s.subject_name}`}>
                          {removing === s.assignment_id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <AssignDialog
            open={dialog}
            onOpenChange={setDialog}
            teacherId={data.teacher.id}
            teacherName={data.teacher.name}
            boardClasses={board}
            existingByClass={existingByClass}
            onSaved={load}
          />
        </>
      )}
    </div>
  );
}
