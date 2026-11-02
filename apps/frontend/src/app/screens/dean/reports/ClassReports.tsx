import { AlertTriangle, CheckCircle2, Eye, FileCheck2, Loader2, OctagonX, Printer, Settings2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { ErrorState, formatDate, Loading, PageHeader } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { PrintCards } from "./PrintCards";
import { CardData, fmt, ReportCard, ReportHeader, SubjectLine } from "./ReportCard";
import { isKind, KINDS } from "./ReportsHome";
import { SubjectMaximaDialog } from "./SubjectMaximaDialog";

interface PreviewStudent {
  student_id: number; name: string; student_id_number: string | null; subjects: SubjectLine[];
  total: number; max_total: number; percentage: number | null; position: number | null; class_size: number;
  flagged_count: number; flags: string[]; generated_at: string | null;
}
interface Preview {
  header: ReportHeader;
  issues: { level: "blocking" | "warning"; message: string }[];
  can_generate: boolean;
  students: PreviewStudent[];
}

const asCard = (p: Preview, s: PreviewStudent): CardData => ({
  header: p.header,
  student: { id: s.student_id, name: s.name, student_id_number: s.student_id_number },
  subjects: s.subjects, total: s.total, max_total: s.max_total, percentage: s.percentage,
  position: s.position, class_size: s.class_size, flagged_count: s.flagged_count, flags: s.flags,
});

export function ClassReports() {
  const { classId = "" } = useParams();
  const [params] = useSearchParams();
  const kindParam = params.get("kind");
  const kind = isKind(kindParam) ? kindParam : null;
  const term = params.get("term");
  const validLink = /^\d{1,10}$/.test(classId) && !!kind && (kind === "end_of_year" || (!!term && /^\d{1,10}$/.test(term)));

  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [review, setReview] = useState<PreviewStudent | null>(null);
  const [confirmFor, setConfirmFor] = useState<number[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState<CardData[] | null>(null);
  const [loadingPrint, setLoadingPrint] = useState(false);
  const [maxima, setMaxima] = useState(false);

  const query = kind === "end_of_year" ? `kind=${kind}` : `kind=${kind}&term_id=${term}`;
  const back = `/dean/reports?kind=${kind ?? "end_of_term"}${kind !== "end_of_year" && term ? `&term=${term}` : ""}`;

  const load = useCallback(async () => {
    setError(null);
    if (!validLink) { setError("This link is missing the report kind or term"); return; }
    try {
      const res = await api.get<Preview>(`/api/v1/academics/reports/classes/${classId}/preview?${query}`);
      setData(res);
      setSelected((prev) => new Set([...prev].filter((id) => res.students.some((s) => s.student_id === id))));
    } catch (e: any) {
      setError(e?.message ?? "Could not build the reports");
    }
  }, [classId, query, validLink]);
  useEffect(() => { load(); }, [load]);

  const blocking = data?.issues.filter((i) => i.level === "blocking") ?? [];
  const warnings = data?.issues.filter((i) => i.level === "warning") ?? [];
  const allSelected = !!data && data.students.length > 0 && selected.size === data.students.length;
  const generatedCount = data?.students.filter((s) => s.generated_at).length ?? 0;

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(data?.students.map((s) => s.student_id)));
  const toggle = (id: number) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pending = useMemo(() => {
    if (!data || !confirmFor) return { flagged: 0, list: [] as PreviewStudent[] };
    const list = data.students.filter((s) => confirmFor.includes(s.student_id));
    return { flagged: list.filter((s) => s.flagged_count > 0).length, list };
  }, [data, confirmFor]);
  const needsAck = pending.flagged > 0 || warnings.length > 0;

  const askGenerate = (ids: number[]) => {
    if (!ids.length) { toast.warning("Select at least one pupil"); return; }
    setAcknowledged(false);
    setConfirmFor(ids);
  };

  const generate = async () => {
    if (!data || !confirmFor || !kind) return;
    if (needsAck && !acknowledged) return;
    setGenerating(true);
    try {
      const whole = confirmFor.length === data.students.length;
      const res = await api.post<{ message: string }>("/api/v1/academics/reports/generate", {
        class_id: Number(classId),
        kind,
        ...(kind === "end_of_year" ? {} : { term_id: Number(term) }),
        ...(whole ? {} : { student_ids: confirmFor }),
        confirm_incomplete: needsAck && acknowledged,
      });
      toast.success(res.message);
      setConfirmFor(null);
      setReview(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not generate the reports");
    } finally {
      setGenerating(false);
    }
  };

  const printClass = async () => {
    setLoadingPrint(true);
    try {
      const res = await api.get<{ cards: CardData[] }>(`/api/v1/academics/reports/classes/${classId}/cards?${query}`);
      if (!res.cards.length) { toast.warning("No reports have been generated for this class yet"); return; }
      if (data && res.cards.length < data.students.length) {
        toast.info(`Printing ${res.cards.length} of ${data.students.length} pupils; the rest have not been generated.`);
      }
      setPrinting(res.cards);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load the reports to print");
    } finally {
      setLoadingPrint(false);
    }
  };

  const onPrintDone = useCallback(() => setPrinting(null), []);

  if (error) return <div className="space-y-6"><PageHeader title="Reports" back={back} /><ErrorState message={error} onRetry={validLink ? load : undefined} /></div>;
  if (!data) return <Loading label="Building reports…" />;

  const h = data.header;
  const kindLabel = KINDS.find((k) => k.value === kind)?.label ?? "";

  return (
    <div className="space-y-6">
      <PageHeader back={back}
        title={`${h.class.label} · ${kindLabel}`}
        subtitle={`${h.term ? `${h.term.name} · ` : ""}${h.academic_year} · ${data.students.length} pupils · class teacher ${h.class_teacher ?? "not set"}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setMaxima(true)}><Settings2 size={16} className="mr-1.5" /> Report maxima</Button>
            <Button variant="outline" onClick={printClass} disabled={loadingPrint || generatedCount === 0}>
              {loadingPrint ? <Loader2 size={16} className="mr-1.5 animate-spin" /> : <Printer size={16} className="mr-1.5" />}
              Print class ({generatedCount})
            </Button>
          </>
        }
      />

      {(blocking.length > 0 || warnings.length > 0) && (
        <div className="space-y-2">
          {blocking.map((i, n) => (
            <div key={`b${n}`} className="flex gap-3 items-start rounded-xl border p-3 text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--danger-red) 40%, white)", backgroundColor: "color-mix(in srgb, var(--danger-red) 6%, white)", color: "var(--dark-gray)" }}>
              <OctagonX size={18} className="flex-shrink-0 mt-0.5" style={{ color: "var(--danger-red)" }} />
              <div><b>Cannot generate:</b> {i.message}</div>
            </div>
          ))}
          {warnings.map((i, n) => (
            <div key={`w${n}`} className="flex gap-3 items-start rounded-xl border p-3 text-sm"
              style={{ borderColor: "color-mix(in srgb, var(--warning-amber) 40%, white)", backgroundColor: "color-mix(in srgb, var(--warning-amber) 7%, white)", color: "var(--dark-gray)" }}>
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" style={{ color: "var(--warning-amber)" }} />
              <div>{i.message}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center gap-2 justify-between p-3 border-b" style={{ borderColor: "var(--border)" }}>
          <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--dark-gray)" }}>
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all pupils" />
            {selected.size ? `${selected.size} selected` : "Select all"}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!data.can_generate || selected.size === 0}
              onClick={() => askGenerate([...selected])}>
              Generate selected ({selected.size})
            </Button>
            <Button disabled={!data.can_generate || data.students.length === 0}
              onClick={() => askGenerate(data.students.map((s) => s.student_id))}
              style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              <FileCheck2 size={16} className="mr-1.5" /> Generate all
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ backgroundColor: "var(--light-gray)", color: "var(--mid-gray)" }}>
                <th className="px-3 py-3 w-10" />
                <th className="px-3 py-3 font-medium">Pupil</th>
                <th className="px-3 py-3 font-medium text-right">Total</th>
                <th className="px-3 py-3 font-medium text-right">%</th>
                <th className="px-3 py-3 font-medium text-right hidden sm:table-cell">Place</th>
                <th className="px-3 py-3 font-medium">Check</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">Generated</th>
                <th className="px-3 py-3 w-24" />
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.student_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-3 py-2.5">
                    <Checkbox checked={selected.has(s.student_id)} onCheckedChange={() => toggle(s.student_id)} aria-label={`Select ${s.name}`} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium" style={{ color: "var(--dark-gray)" }}>{s.name}</div>
                    {s.student_id_number && <div className="text-xs" style={{ color: "var(--mid-gray)" }}>{s.student_id_number}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--dark-gray)" }}>{fmt(s.total)}<span style={{ color: "var(--mid-gray)" }}>/{fmt(s.max_total)}</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: "var(--dark-gray)" }}>{s.percentage === null ? "—" : s.percentage.toFixed(1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell" style={{ color: "var(--dark-gray)" }}>{s.position ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {!data.can_generate ? <span className="text-xs" style={{ color: "var(--mid-gray)" }}>—</span> : s.flagged_count > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "color-mix(in srgb, var(--danger-red) 10%, white)", color: "var(--danger-red)" }}>
                        <AlertTriangle size={12} /> {s.flagged_count} flagged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--success-green)" }}>
                        <CheckCircle2 size={14} /> Complete
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs hidden md:table-cell" style={{ color: "var(--mid-gray)" }}>{s.generated_at ? formatDate(s.generated_at) : "Not yet"}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant="ghost" disabled={!data.can_generate} onClick={() => setReview(s)} style={{ color: "var(--maroon)" }}>
                      <Eye size={15} className="mr-1" /> Review
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.students.length === 0 && <p className="text-sm text-center py-10" style={{ color: "var(--mid-gray)" }}>This class has no pupils.</p>}
        </div>
      </div>

      {/* Review one pupil */}
      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[94vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review · {review?.name}</DialogTitle>
            <DialogDescription>
              {review && review.flagged_count > 0
                ? `${review.flagged_count} cell${review.flagged_count === 1 ? " is" : "s are"} outlined in red. Hover a cell to see why; blanks count as zero.`
                : "Every cell is complete."}
            </DialogDescription>
          </DialogHeader>
          {review && (
            <>
              {review.flags.length > 0 && (
                <ul className="text-sm rounded-xl border p-3 space-y-1 list-disc pl-6"
                  style={{ borderColor: "color-mix(in srgb, var(--danger-red) 35%, white)", backgroundColor: "color-mix(in srgb, var(--danger-red) 5%, white)", color: "var(--dark-gray)" }}>
                  {review.flags.slice(0, 12).map((f) => <li key={f}>{f}</li>)}
                  {review.flags.length > 12 && <li>…and {review.flags.length - 12} more</li>}
                </ul>
              )}
              <div className="border rounded-xl p-4 overflow-x-auto" style={{ borderColor: "var(--border)" }}>
                <ReportCard card={asCard(data, review)} highlightFlags />
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReview(null)}>Close</Button>
            <Button onClick={() => review && askGenerate([review.student_id])} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              Generate this report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm generation */}
      <Dialog open={!!confirmFor} onOpenChange={(o) => !o && !generating && setConfirmFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate {pending.list.length} report{pending.list.length === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              {kindLabel} for {h.class.label}{h.term ? `, ${h.term.name}` : ""}. Reports already generated for these pupils are replaced.
            </DialogDescription>
          </DialogHeader>
          {needsAck ? (
            <div className="space-y-3">
              <div className="rounded-xl border p-3 text-sm space-y-1"
                style={{ borderColor: "color-mix(in srgb, var(--warning-amber) 40%, white)", backgroundColor: "color-mix(in srgb, var(--warning-amber) 7%, white)", color: "var(--dark-gray)" }}>
                {pending.flagged > 0 && <div><b>{pending.flagged}</b> of these report{pending.flagged === 1 ? " has" : "s have"} flagged cells.</div>}
                {warnings.length > 0 && <div><b>{warnings.length}</b> warning{warnings.length === 1 ? "" : "s"} for this class (see the top of the page).</div>}
              </div>
              <label className="flex items-start gap-2 text-sm cursor-pointer" style={{ color: "var(--dark-gray)" }}>
                <Checkbox checked={acknowledged} onCheckedChange={(v) => setAcknowledged(v === true)} className="mt-0.5" />
                I have reviewed the flagged cells and want to generate anyway. Blank marks will print as zero.
              </label>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--success-green)" }}>All selected reports are complete.</p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={generating} onClick={() => setConfirmFor(null)}>Cancel</Button>
            <Button onClick={generate} disabled={generating || (needsAck && !acknowledged)} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubjectMaximaDialog open={maxima} onOpenChange={setMaxima} pLevelId={h.class.p_level_id} levelName={h.class.p_level} onSaved={load} />

      {printing && <PrintCards cards={printing} onDone={onPrintDone} />}
    </div>
  );
}
