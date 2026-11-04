import { Baby, BookOpen, ChevronRight, GraduationCap, School } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../../../lib/api";
import { SCHOOL_BANDS, bandOf, type SchoolBand } from "../../../../lib/schoolBands";
import { EmptyState, ErrorState, Loading, PageHeader } from "../../../components/academic";

interface PLevel {
  id: number; name: string; teaching_model?: string;
  class_count?: number; student_count?: number;
}

const ICONS: Record<SchoolBand, typeof Baby> = {
  nursery: Baby,
  lower_primary: School,
  upper_primary: GraduationCap,
};

/** Courses open by school section — navigation only; each P-level keeps its own course list. */
export function CoursesHome() {
  const navigate = useNavigate();
  const [levels, setLevels] = useState<PLevel[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const years = await api.get<{ id: number; status: string }[]>("/api/v1/academics/academic-years");
      const active = years.find((y) => y.status === "active") ?? years[0];
      if (!active) { setLevels([]); setCounts({}); return; }
      const pls = await api.get<PLevel[]>(`/api/v1/academics/p-levels?academic_year_id=${active.id}`);
      setLevels(pls);
      const subjectCounts: Record<number, number> = {};
      await Promise.all(pls.map(async (pl) => {
        const subjects = await api.get<{ id: number }[]>(`/api/v1/academics/assessments/subjects?p_level_id=${pl.id}`);
        subjectCounts[pl.id] = subjects.length;
      }));
      setCounts(subjectCounts);
    } catch (e: any) {
      setError(e?.message ?? "Could not load courses");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byBand = useMemo(() => {
    const map: Record<SchoolBand, { levels: PLevel[]; courses: number; classes: number }> = {
      nursery: { levels: [], courses: 0, classes: 0 },
      lower_primary: { levels: [], courses: 0, classes: 0 },
      upper_primary: { levels: [], courses: 0, classes: 0 },
    };
    for (const pl of levels) {
      const band = bandOf(pl.name);
      if (!band) continue;
      map[band].levels.push(pl);
      map[band].courses += counts[pl.id] ?? 0;
      map[band].classes += pl.class_count ?? 0;
    }
    return map;
  }, [levels, counts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses"
        subtitle="Open a section, then a P-level, to manage that level's courses. Levels in a section do not share a course list."
      />

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : (
        <div className="grid gap-4 md:grid-cols-3">
          {SCHOOL_BANDS.map((b) => {
            const Icon = ICONS[b.key];
            const stats = byBand[b.key];
            return (
              <button key={b.key} onClick={() => navigate(`/dean/courses/${b.path}`)}
                className="press-subtle group text-left bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow flex flex-col"
                style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 10%, white)" }}>
                    <Icon size={24} style={{ color: "var(--maroon)" }} />
                  </div>
                  <ChevronRight size={20} className="transition-transform group-hover:translate-x-0.5" style={{ color: "var(--mid-gray)" }} />
                </div>
                <div className="mt-4 text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>{b.label}</div>
                <div className="text-sm mt-0.5" style={{ color: "var(--mid-gray)" }}>
                  {stats.levels.length
                    ? stats.levels.map((l) => l.name).join(", ")
                    : b.hint}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <Metric value={stats.levels.length} label="Levels" />
                  <Metric value={stats.classes} label="Classes" />
                  <Metric value={stats.courses} label="Courses" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!loading && !error && levels.length === 0 && (
        <EmptyState icon={<BookOpen size={44} />} title="No P-levels yet">
          Create P-levels first, then add courses under each section.
        </EmptyState>
      )}
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--dark-gray)" }}>{value}</div>
      <div className="text-xs" style={{ color: "var(--mid-gray)" }}>{label}</div>
    </div>
  );
}
