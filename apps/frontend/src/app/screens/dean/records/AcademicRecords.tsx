import { Baby, BookOpenCheck, CalendarRange, ChevronRight, GraduationCap, School } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../../../lib/api";
import { EmptyState, ErrorState, Loading, PageHeader } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { TermsDialog } from "./TermsDialog";

interface Section {
  key: "nursery" | "lower_primary" | "upper_primary"; label: string; class_count: number;
  classes: string[]; teacher_count: number; submitted_count: number;
}
interface Overview { academic_year: { id: number; name: string } | null; sections: Section[] }

export const SECTION_ICONS = { nursery: Baby, lower_primary: School, upper_primary: GraduationCap };
export const SECTION_PATHS: Record<string, string> = { nursery: "nursery", lower_primary: "lower-primary", upper_primary: "upper-primary" };
export const SECTION_FROM_PATH: Record<string, Section["key"]> = { nursery: "nursery", "lower-primary": "lower_primary", "upper-primary": "upper_primary" };

export function AcademicRecords() {
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await api.get<Overview>("/api/v1/academics/records/sections")); }
    catch (e: any) { setError(e?.message ?? "Could not load academic records"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Records"
        subtitle={data?.academic_year ? `Marks teachers have submitted in ${data.academic_year.name}, by section.` : "Marks teachers have submitted, by section."}
        actions={data?.academic_year && (
          <Button variant="outline" onClick={() => setTerms(true)}>
            <CalendarRange size={16} className="mr-1.5" /> Terms
          </Button>
        )}
      />

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Loading /> : !data.academic_year ? (
        <EmptyState icon={<BookOpenCheck size={44} />} title="No active academic year">
          Academic records appear once an academic year is active.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {data.sections.map((s) => {
            const Icon = SECTION_ICONS[s.key];
            return (
              <button key={s.key} onClick={() => navigate(`/dean/academic-records/${SECTION_PATHS[s.key]}`)}
                className="press-subtle group text-left bg-white rounded-2xl border p-5 hover:shadow-md transition-shadow flex flex-col"
                style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 10%, white)" }}>
                    <Icon size={24} style={{ color: "var(--maroon)" }} />
                  </div>
                  <ChevronRight size={20} className="transition-transform group-hover:translate-x-0.5" style={{ color: "var(--mid-gray)" }} />
                </div>
                <div className="mt-4 text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>{s.label}</div>
                <div className="text-sm mt-0.5 truncate" style={{ color: "var(--mid-gray)" }}>
                  {s.classes.length ? s.classes.join(", ") : "No classes distributed yet"}
                </div>
                <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <Metric value={s.class_count} label="Classes" />
                  <Metric value={s.teacher_count} label="Teachers" />
                  <Metric value={s.submitted_count} label="Submitted" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {data?.academic_year && (
        <TermsDialog open={terms} onOpenChange={setTerms} yearId={data.academic_year.id} yearName={data.academic_year.name} />
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
