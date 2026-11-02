import { ChevronRight, FileText, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { api } from "../../../../lib/api";
import { EmptyState, ErrorState, Loading, PageHeader } from "../../../components/academic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { SECTION_ICONS } from "../records/AcademicRecords";

export type Kind = "mid_term" | "end_of_term" | "end_of_year";
export const KINDS: { value: Kind; label: string }[] = [
  { value: "mid_term", label: "Mid-term" },
  { value: "end_of_term", label: "End of term" },
  { value: "end_of_year", label: "End of year" },
];
export const isKind = (v: string | null): v is Kind => KINDS.some((k) => k.value === v);

interface ClassRow { id: number; label: string; class_teacher_name: string | null; student_count: number; generated_count: number }
interface Data {
  academic_year: { id: number; name: string } | null;
  terms: { id: number; name: string; sequence: number; status: string }[];
  sections: { key: keyof typeof SECTION_ICONS; label: string; classes: ClassRow[] }[];
}

export function ReportsHome() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kindParam = params.get("kind");
  const kind: Kind = isKind(kindParam) ? kindParam : "end_of_term";
  const termParam = params.get("term");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const termId = kind === "end_of_year" ? null : termParam && /^\d{1,10}$/.test(termParam) ? termParam : null;

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams({ kind });
      if (termId) q.set("term_id", termId);
      // Listing without a term still returns the terms, so the first open one can be picked.
      const res = await api.get<Data>(`/api/v1/academics/reports/classes?${kind === "end_of_year" || termId ? q : "kind=end_of_year"}`);
      setData(res);
      if (kind !== "end_of_year" && !termId && res.terms.length) {
        const pick = res.terms.find((t) => t.status === "active") ?? res.terms[res.terms.length - 1];
        setParams({ kind, term: String(pick.id) }, { replace: true });
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not load classes");
    }
  }, [kind, termId, setParams]);
  useEffect(() => { load(); }, [load]);

  const setKind = (k: string) => {
    const next: Record<string, string> = { kind: k };
    if (k !== "end_of_year" && termId) next.term = termId;
    setParams(next);
  };

  const qs = `kind=${kind}${termId ? `&term=${termId}` : ""}`;
  const termName = data?.terms.find((t) => String(t.id) === termId)?.name;

  return (
    <div className="space-y-6">
      <PageHeader title="Report Generation"
        subtitle="Choose a report, then a class. Review each pupil's bulletin before generating and printing." />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <Tabs value={kind} onValueChange={setKind}>
          <TabsList>
            {KINDS.map((k) => <TabsTrigger key={k.value} value={k.value}>{k.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {kind !== "end_of_year" && data && data.terms.length > 0 && (
          <Select value={termId ?? ""} onValueChange={(v) => setParams({ kind, term: v })}>
            <SelectTrigger className="w-full sm:w-48 bg-white"><SelectValue placeholder="Choose term" /></SelectTrigger>
            <SelectContent>
              {data.terms.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}{t.status === "closed" ? " (closed)" : t.status === "active" ? " (open)" : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Loading /> : !data.academic_year ? (
        <EmptyState icon={<FileText size={44} />} title="No active academic year" />
      ) : data.terms.length === 0 ? (
        <EmptyState icon={<FileText size={44} />} title="No terms set up yet">
          Add the year's terms from Academic Records → Terms before generating reports.
        </EmptyState>
      ) : kind !== "end_of_year" && !termId ? <Loading /> : (
        <div className="space-y-8">
          {data.sections.map((s) => {
            const Icon = SECTION_ICONS[s.key];
            return (
              <section key={s.key}>
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--mid-gray)" }}>
                  <Icon size={16} /> {s.label}
                </h2>
                {s.classes.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>No distributed classes.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {s.classes.map((c) => {
                      const done = c.student_count > 0 && c.generated_count >= c.student_count;
                      return (
                        <button key={c.id} onClick={() => navigate(`/dean/reports/classes/${c.id}?${qs}`)}
                          className="press-subtle group text-left bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow"
                          style={{ borderColor: "var(--border)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-semibold" style={{ color: "var(--dark-gray)" }}>{c.label}</span>
                            <ChevronRight size={18} style={{ color: "var(--mid-gray)" }} />
                          </div>
                          <div className="text-xs mt-1 truncate" style={{ color: "var(--mid-gray)" }}>
                            {c.class_teacher_name ?? "No class teacher"}
                          </div>
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
                )}
              </section>
            );
          })}
          {kind !== "end_of_year" && termName && (
            <p className="text-xs" style={{ color: "var(--mid-gray)" }}>Showing {KINDS.find((k) => k.value === kind)?.label.toLowerCase()} reports for {termName}.</p>
          )}
        </div>
      )}
    </div>
  );
}
