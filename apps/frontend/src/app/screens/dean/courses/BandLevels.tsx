import { BookOpen, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "../../../../lib/api";
import { BAND_FROM_PATH, BAND_PATH, SCHOOL_BANDS, bandOf, type SchoolBand } from "../../../../lib/schoolBands";
import { EmptyState, ErrorState, Loading, PageHeader } from "../../../components/academic";

interface PLevel {
  id: number; name: string; teaching_model?: string;
  class_count?: number;
}

export function BandLevels() {
  const { section } = useParams();
  const band = section ? BAND_FROM_PATH[section] : undefined;
  const navigate = useNavigate();
  const [levels, setLevels] = useState<PLevel[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!band) return;
    setError(null);
    try {
      const years = await api.get<{ id: number; status: string }[]>("/api/v1/academics/academic-years");
      const active = years.find((y) => y.status === "active") ?? years[0];
      if (!active) { setLevels([]); return; }
      const pls = await api.get<PLevel[]>(`/api/v1/academics/p-levels?academic_year_id=${active.id}`);
      const inBand = pls.filter((pl) => bandOf(pl.name) === band);
      setLevels(inBand);
      const subjectCounts: Record<number, number> = {};
      await Promise.all(inBand.map(async (pl) => {
        const subjects = await api.get<{ id: number }[]>(`/api/v1/academics/assessments/subjects?p_level_id=${pl.id}`);
        subjectCounts[pl.id] = subjects.length;
      }));
      setCounts(subjectCounts);
    } catch (e: any) {
      setError(e?.message ?? "Could not load levels");
    } finally {
      setLoading(false);
    }
  }, [band]);
  useEffect(() => { load(); }, [load]);

  const meta = useMemo(() => SCHOOL_BANDS.find((b) => b.key === band), [band]);
  if (!band || !meta) return <Navigate to="/dean/courses" replace />;

  return (
    <div className="space-y-6">
      <PageHeader
        back="/dean/courses"
        title={meta.label}
        subtitle="Each P-level has its own courses. Open a level to add, edit or remove them."
      />

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : levels.length === 0 ? (
        <EmptyState icon={<BookOpen size={44} />} title={`No ${meta.label.toLowerCase()} levels yet`}>
          Create a P-level such as {band === "nursery" ? "N1" : band === "lower_primary" ? "P1 or P3" : "P4 or P6"} first.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {levels.map((pl) => (
            <button key={pl.id}
              onClick={() => navigate(`/dean/courses/${BAND_PATH[band]}/${pl.id}`)}
              className="press-subtle text-left bg-white rounded-2xl border p-4 md:p-5 hover:shadow-sm transition-shadow flex items-center gap-4"
              style={{ borderColor: "var(--border)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-semibold"
                style={{ backgroundColor: "color-mix(in srgb, var(--navy-blue) 10%, white)", color: "var(--navy-blue)" }}>
                {pl.name}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold" style={{ color: "var(--dark-gray)" }}>{pl.name}</div>
                <div className="text-sm" style={{ color: "var(--mid-gray)" }}>
                  {counts[pl.id] ?? 0} course{(counts[pl.id] ?? 0) === 1 ? "" : "s"}
                  {" · "}
                  {pl.class_count ?? 0} class{(pl.class_count ?? 0) === 1 ? "" : "es"}
                  {pl.teaching_model === "specialist" ? " · specialist teachers" : " · class teacher"}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: "var(--mid-gray)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
