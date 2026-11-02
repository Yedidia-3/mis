import { ClipboardList, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../../../lib/api";
import { CATEGORIES } from "../../../../lib/academicRules";
import {
  CategoryBadge, EmptyState, ErrorState, formatDate, Loading, PageHeader, StatusBadge,
} from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { AssessmentDialog, RecordingOptions } from "./AssessmentDialog";

interface MyAssessment {
  id: number; title: string; date: string; max_score: number; status: "draft" | "submitted";
  class_label: string; subject_name: string; category: string | null; term_name: string;
  term_status: string; recorded: number; roster_size: number; submitted_at: string | null;
}

export function MarksList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<MyAssessment[]>([]);
  const [options, setOptions] = useState<RecordingOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [category, setCategory] = useState("all");
  const [dialog, setDialog] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [mine, opts] = await Promise.all([
        api.get<MyAssessment[]>("/api/v1/academics/assessments/mine"),
        api.get<RecordingOptions>("/api/v1/academics/assessments/recording-options"),
      ]);
      setItems(mine);
      setOptions(opts);
    } catch (e: any) {
      setError(e?.message ?? "Could not load your assessments");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => items.filter((a) =>
    (tab === "all" || a.status === tab) && (category === "all" || a.category === category)), [items, tab, category]);
  const drafts = items.filter((a) => a.status === "draft").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marks"
        subtitle="Record quiz, homework and exam marks, then submit them to the dean."
        actions={
          <Button onClick={() => setDialog(true)} disabled={loading || !!error}
            style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
            <Plus size={16} className="mr-1.5" /> New assessment
          </Button>
        }
      />

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : (
        <>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">All ({items.length})</TabsTrigger>
                <TabsTrigger value="draft">Drafts ({drafts})</TabsTrigger>
                <TabsTrigger value="submitted">Submitted ({items.length - drafts})</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-44 bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={<ClipboardList size={44} />} title={items.length ? "Nothing matches these filters" : "No assessments yet"}>
              {items.length ? "Try another tab or category." : "Create an assessment for a quiz, homework or exam, then enter each pupil's mark."}
            </EmptyState>
          ) : (
            <div className="grid gap-3">
              {shown.map((a) => {
                const pct = a.roster_size ? Math.round((a.recorded / a.roster_size) * 100) : 0;
                return (
                  <button key={a.id} onClick={() => navigate(`/teacher/marks/${a.id}`)}
                    className="press-subtle text-left bg-white rounded-2xl border p-4 md:p-5 hover:shadow-sm transition-shadow"
                    style={{ borderColor: "var(--border)" }}>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CategoryBadge category={a.category} />
                          <StatusBadge status={a.status} />
                          {a.term_status === "closed" && (
                            <span className="text-xs" style={{ color: "var(--mid-gray)" }}>Term closed</span>
                          )}
                        </div>
                        <div className="mt-2 font-semibold truncate" style={{ color: "var(--dark-gray)" }}>{a.title}</div>
                        <div className="text-sm mt-0.5" style={{ color: "var(--mid-gray)" }}>
                          {a.subject_name} · {a.class_label} · {a.term_name} · {formatDate(a.date)} · out of {a.max_score}
                        </div>
                      </div>
                      <div className="md:w-48">
                        <div className="flex justify-between text-xs mb-1" style={{ color: "var(--mid-gray)" }}>
                          <span>Marked</span>
                          <span className="tabular-nums">{a.recorded}/{a.roster_size}</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--light-gray)" }}>
                          <div className="h-full rounded-full" style={{
                            width: `${pct}%`,
                            backgroundColor: pct === 100 ? "var(--success-green)" : "var(--gold)",
                          }} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <AssessmentDialog mode="create" open={dialog} onOpenChange={setDialog} options={options}
        onSaved={(id) => navigate(`/teacher/marks/${id}`)} />
    </div>
  );
}
