import { ChevronRight, FileText, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../../../../lib/api";
import { EmptyState, ErrorState, Loading, PageHeader } from "../../../components/academic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { SECTION_ICONS } from "../records/AcademicRecords";

interface ClassRow { id: number; label: string; class_teacher_name: string | null; student_count: number; generated_count: number }
interface Data {
  academic_year: { id: number; name: string } | null;
  terms: { id: number; name: string; sequence: number; status: string }[];
  sections: { key: keyof typeof SECTION_ICONS; label: string; classes: ClassRow[] }[];
}

export function ReportsHome() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const termParam = params.get("term");
  const termId = termParam && /^\d{1,10}$/.test(termParam) ? termParam : null;
  const [mid, setMid] = useState<Data | null>(null);
  const [nursery, setNursery] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams({ kind: "mid_term" });
      if (termId) q.set("term_id", termId);
      const [midRes, nurseryRes] = await Promise.all([
        api.get<Data>(`/api/v1/academics/reports/classes?${q}`),
        api.get<Data>(`/api/v1/academics/reports/classes?kind=nursery`),
      ]);
      setMid(midRes);
      setNursery(nurseryRes);
      if (!termId && midRes.terms.length) {
        const pick = midRes.terms.find((t) => t.status === "active") ?? midRes.terms[midRes.terms.length - 1];
        setParams({ term: String(pick.id) }, { replace: true });
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not load classes");
    }
  }, [termId, setParams]);
  useEffect(() => { load(); }, [load]);

  const termName = mid?.terms.find((t) => String(t.id) === termId)?.name;

  return (
    <div className="space-y-8">
      <PageHeader title="Report Generation"
        subtitle="Nursery bulletins and mid-term bulletins. Teachers record the colours and the marks. The maxima are already set." />

      {error ? <ErrorState message={error} onRetry={load} /> : !mid || !nursery ? <Loading /> : !mid.academic_year ? (
        <EmptyState icon={<FileText size={44} />} title="No active academic year" />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--mid-gray)" }}>Nursery</h2>
            <ClassGrid sections={nursery.sections} onOpen={(id) => navigate(`/dean/reports/classes/${id}?kind=nursery`)} />
          </section>

          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--mid-gray)" }}>Mid-term</h2>
              {mid.terms.length > 0 && (
                <Select value={termId ?? ""} onValueChange={(v) => setParams({ term: v })}>
                  <SelectTrigger className="w-full sm:w-48 bg-white"><SelectValue placeholder="Choose term" /></SelectTrigger>
                  <SelectContent>
                    {mid.terms.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}{t.status === "closed" ? " (closed)" : t.status === "active" ? " (current)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {mid.terms.length === 0 ? (
              <EmptyState icon={<FileText size={44} />} title="No terms set up yet">
                Add the year's terms from Terms before printing mid-term bulletins.
              </EmptyState>
            ) : !termId ? <Loading /> : (
              <ClassGrid sections={mid.sections} onOpen={(id) => navigate(`/dean/reports/classes/${id}?kind=mid_term&term=${termId}`)} />
            )}
            {termName && <p className="text-xs" style={{ color: "var(--mid-gray)" }}>Mid-term bulletins for {termName}. Each subject is out of the maximum on the school's sheet.</p>}
          </section>
        </>
      )}
    </div>
  );
}

function ClassGrid({ sections, onOpen }: { sections: Data["sections"]; onOpen: (id: number) => void }) {
  const any = sections.some((s) => s.classes.length > 0);
  if (!any) return <p className="text-sm" style={{ color: "var(--mid-gray)" }}>No classes in this section yet.</p>;
  return (
    <div className="space-y-6">
      {sections.map((s) => {
        const Icon = SECTION_ICONS[s.key];
        if (!s.classes.length) return null;
        return (
          <div key={s.key}>
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--mid-gray)" }}>
              {Icon && <Icon size={14} />} {s.label}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {s.classes.map((c) => {
                const done = c.student_count > 0 && c.generated_count >= c.student_count;
                return (
                  <button key={c.id} onClick={() => onOpen(c.id)}
                    className="press-subtle text-left bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow"
                    style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>{c.label}</span>
                      <ChevronRight size={18} style={{ color: "var(--mid-gray)" }} />
                    </div>
                    <div className="text-xs mt-1 truncate" style={{ color: "var(--mid-gray)" }}>{c.class_teacher_name ?? "No class teacher"}</div>
                    <div className="flex items-center justify-between mt-4 text-xs">
                      <span className="flex items-center gap-1" style={{ color: "var(--mid-gray)" }}><Users size={14} /> {c.student_count} pupils</span>
                      <span className="px-2 py-0.5 rounded-full font-semibold" style={done
                        ? { backgroundColor: "color-mix(in srgb, var(--success-green) 12%, white)", color: "var(--success-green)" }
                        : { backgroundColor: "var(--light-gray)", color: "var(--dark-gray)" }}>
                        {c.generated_count}/{c.student_count} generated
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
