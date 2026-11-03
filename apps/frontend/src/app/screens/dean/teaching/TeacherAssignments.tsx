import { BookUser, ChevronRight, ClipboardList, RefreshCw, Search, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import {
  EmptyState, ErrorState, Loading, PageHeader, TeacherAvatar,
} from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";

interface Year { id: number; name: string; status: string }
interface TeacherLoad {
  teacher_id: number; teacher_name: string; email: string; avatar: string | null;
  levels: string[]; class_count: number; subject_count: number;
  periods_per_week: number; max_periods_per_week: number | null; is_overloaded: boolean;
}
interface CoverageClass {
  class_id: number; class_label: string; p_level_name: string; teaching_model: string;
  class_teacher_name: string | null; distributed: boolean;
  subject_count: number; assigned_count: number; unassigned_count: number;
  subjects: {
    subject_id: number; subject_name: string; teacher_name: string | null; unassigned: boolean;
  }[];
}

/** Dean screen: who teaches which courses, across every class and level. */
export function TeacherAssignments() {
  const navigate = useNavigate();
  const [year, setYear] = useState<Year | null>(null);
  const [loads, setLoads] = useState<TeacherLoad[]>([]);
  const [coverage, setCoverage] = useState<CoverageClass[]>([]);
  const [tab, setTab] = useState("teachers");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const years = await api.get<Year[]>("/api/v1/academics/academic-years");
      const active = years.find((y) => y.status === "active") ?? years[0] ?? null;
      setYear(active);
      if (!active) { setLoads([]); setCoverage([]); return; }
      const [teacherLoads, cov] = await Promise.all([
        api.get<TeacherLoad[]>(`/api/v1/academics/teaching/loads?academic_year_id=${active.id}`),
        api.get<{ classes: CoverageClass[] }>(`/api/v1/academics/teaching/coverage?academic_year_id=${active.id}`),
      ]);
      setLoads(teacherLoads);
      setCoverage(cov.classes);
    } catch (e: any) {
      setError(e?.message ?? "Could not load teacher assignments");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shownTeachers = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return loads;
    return loads.filter((t) =>
      t.teacher_name.toLowerCase().includes(needle)
      || t.email.toLowerCase().includes(needle)
      || t.levels.some((l) => l.toLowerCase().includes(needle)));
  }, [loads, q]);

  const shownClasses = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return coverage;
    return coverage.filter((c) =>
      c.class_label.toLowerCase().includes(needle)
      || c.p_level_name.toLowerCase().includes(needle)
      || (c.class_teacher_name ?? "").toLowerCase().includes(needle));
  }, [coverage, q]);

  const unassignedTeachers = loads.filter((t) => t.subject_count === 0).length;
  const gapClasses = coverage.filter((c) => c.unassigned_count > 0).length;

  const syncClassTeachers = async () => {
    if (!year) return;
    setSyncing(true);
    try {
      const classTeacherClasses = coverage.filter((c) => c.teaching_model === "class_teacher");
      for (const c of classTeacherClasses) {
        await api.post(`/api/v1/academics/teaching/classes/${c.class_id}/sync`, {});
      }
      toast.success("Class-teacher courses refreshed");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not sync class teachers");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Assignments"
        subtitle={year
          ? `Academic year ${year.name}. Give each teacher the classes and courses they teach — across any level.`
          : "Distribute classes and courses to teachers."}
        actions={year && (
          <Button variant="outline" disabled={syncing} onClick={syncClassTeachers}>
            <RefreshCw size={16} className={`mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            Sync class teachers
          </Button>
        )}
      />

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : !year ? (
        <EmptyState icon={<BookUser size={44} />} title="No active academic year">
          Teacher assignments appear once an academic year is active.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Teachers" value={loads.length} hint={`${unassignedTeachers} with no courses yet`} />
            <Stat label="Classes" value={coverage.length} hint={`${gapClasses} still missing a course teacher`} />
            <Stat label="Courses assigned"
              value={coverage.reduce((n, c) => n + c.assigned_count, 0)}
              hint={`of ${coverage.reduce((n, c) => n + c.subject_count, 0)} class-courses`} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="teachers">By teacher ({loads.length})</TabsTrigger>
                <TabsTrigger value="classes">By class ({coverage.length})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input className="pl-9 bg-white" placeholder={tab === "teachers" ? "Search teachers…" : "Search classes…"}
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {tab === "teachers" ? (
            shownTeachers.length === 0 ? (
              <EmptyState icon={<UserRound size={44} />} title={loads.length ? "No teachers match" : "No teachers yet"}>
                {loads.length ? "Try another search." : "Add teachers in user management first."}
              </EmptyState>
            ) : (
              <div className="grid gap-3">
                {shownTeachers.map((t) => (
                  <button key={t.teacher_id} onClick={() => navigate(`/dean/teaching/teachers/${t.teacher_id}`)}
                    className="press-subtle text-left bg-white rounded-2xl border p-4 md:p-5 hover:shadow-sm transition-shadow flex items-center gap-4"
                    style={{ borderColor: "var(--border)" }}>
                    <TeacherAvatar name={t.teacher_name} avatar={t.avatar} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold truncate" style={{ color: "var(--dark-gray)" }}>{t.teacher_name}</div>
                        {t.subject_count === 0 && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "color-mix(in srgb, var(--warning-amber) 14%, white)", color: "var(--warning-amber)" }}>
                            Unassigned
                          </span>
                        )}
                        {t.is_overloaded && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 12%, white)", color: "var(--maroon)" }}>
                            Overloaded
                          </span>
                        )}
                      </div>
                      <div className="text-sm mt-0.5 truncate" style={{ color: "var(--mid-gray)" }}>
                        {t.levels.length ? t.levels.join(" · ") : "No level yet"}
                        {" · "}
                        {t.class_count} class{t.class_count === 1 ? "" : "es"}
                        {" · "}
                        {t.subject_count} course{t.subject_count === 1 ? "" : "s"}
                        {" · "}
                        {t.periods_per_week} periods/week
                        {t.max_periods_per_week != null ? ` / ${t.max_periods_per_week}` : ""}
                      </div>
                    </div>
                    <ChevronRight size={18} style={{ color: "var(--mid-gray)" }} />
                  </button>
                ))}
              </div>
            )
          ) : shownClasses.length === 0 ? (
            <EmptyState icon={<ClipboardList size={44} />} title={coverage.length ? "No classes match" : "No classes yet"}>
              Distribute classes first, then assign their courses here.
            </EmptyState>
          ) : (
            <div className="grid gap-3">
              {shownClasses.map((c) => (
                <div key={c.class_id} className="bg-white rounded-2xl border p-4 md:p-5" style={{ borderColor: "var(--border)" }}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div>
                      <div className="font-semibold" style={{ color: "var(--dark-gray)" }}>{c.class_label}</div>
                      <div className="text-sm" style={{ color: "var(--mid-gray)" }}>
                        {c.teaching_model === "class_teacher" ? "Class-teacher level" : "Specialist level"}
                        {c.class_teacher_name ? ` · class teacher ${c.class_teacher_name}` : " · no class teacher"}
                        {!c.distributed ? " · not distributed yet" : ""}
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start"
                      style={{
                        backgroundColor: c.unassigned_count
                          ? "color-mix(in srgb, var(--warning-amber) 14%, white)"
                          : "color-mix(in srgb, var(--success-green) 12%, white)",
                        color: c.unassigned_count ? "var(--warning-amber)" : "var(--success-green)",
                      }}>
                      {c.assigned_count}/{c.subject_count} courses covered
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.subjects.map((s) => (
                      <span key={s.subject_id} className="text-xs px-2 py-1 rounded-lg border"
                        style={{
                          borderColor: s.unassigned ? "color-mix(in srgb, var(--warning-amber) 40%, white)" : "var(--border)",
                          backgroundColor: s.unassigned ? "color-mix(in srgb, var(--warning-amber) 8%, white)" : "var(--light-gray)",
                          color: "var(--dark-gray)",
                        }}>
                        {s.subject_name}
                        <span style={{ color: "var(--mid-gray)" }}> · {s.unassigned ? "needs teacher" : s.teacher_name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="bg-white rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--mid-gray)" }}>{label}</div>
      <div className="text-2xl font-semibold tabular-nums mt-1" style={{ color: "var(--dark-gray)" }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: "var(--mid-gray)" }}>{hint}</div>
    </div>
  );
}
