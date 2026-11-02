import { Loader2, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { isRealDate, normaliseText, RULES, sanitiseTyping, validateTermName } from "../../../../lib/academicRules";
import { FieldError } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

interface Term { id: number; name: string; sequence: number; start_date: string; end_date: string; status: "upcoming" | "active" | "closed" }
interface Draft { name: string; start_date: string; end_date: string; status: Term["status"] }

function validate(d: Draft): Record<string, string | null> {
  return {
    name: validateTermName(d.name),
    start_date: isRealDate(d.start_date) ? null : "Enter a real date",
    end_date: !isRealDate(d.end_date) ? "Enter a real date" : d.end_date < d.start_date ? "Ends before it starts" : null,
  };
}

/** The year's three terms. Report cards are built per term, so they must exist before marks are recorded. */
export function TermsDialog({ open, onOpenChange, yearId, yearName }: {
  open: boolean; onOpenChange: (o: boolean) => void; yearId: number; yearName: string;
}) {
  const [terms, setTerms] = useState<Term[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | "new" | null>(null);
  const [fresh, setFresh] = useState<Draft>({ name: "", start_date: "", end_date: "", status: "upcoming" });
  const [freshTouched, setFreshTouched] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.get<Term[]>(`/api/v1/academics/assessments/terms?academic_year_id=${yearId}`);
      setTerms(list);
      setDrafts(Object.fromEntries(list.map((t) => [t.id, { name: t.name, start_date: t.start_date, end_date: t.end_date, status: t.status }])));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load terms");
    } finally {
      setLoading(false);
    }
  }, [yearId]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const nextSequence = [1, 2, 3].find((s) => !terms.some((t) => t.sequence === s));

  useEffect(() => {
    if (nextSequence) setFresh((f) => ({ ...f, name: f.name || `Term ${nextSequence}` }));
  }, [nextSequence]);

  const saveTerm = async (t: Term) => {
    const d = drafts[t.id];
    const errs = validate(d);
    if (Object.values(errs).some(Boolean)) { toast.error("Fix the highlighted fields"); return; }
    setSaving(t.id);
    try {
      await api.put(`/api/v1/academics/assessments/terms/${t.id}`, { ...d, name: normaliseText(d.name) });
      toast.success(`${normaliseText(d.name)} saved`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the term");
    } finally {
      setSaving(null);
    }
  };

  const addTerm = async () => {
    setFreshTouched(true);
    const errs = validate(fresh);
    if (!nextSequence || Object.values(errs).some(Boolean)) return;
    setSaving("new");
    try {
      await api.post(`/api/v1/academics/assessments/terms`, {
        academic_year_id: yearId, sequence: nextSequence, name: normaliseText(fresh.name),
        start_date: fresh.start_date, end_date: fresh.end_date,
      });
      toast.success(`Term ${nextSequence} added`);
      setFresh({ name: "", start_date: "", end_date: "", status: "upcoming" });
      setFreshTouched(false);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add the term");
    } finally {
      setSaving(null);
    }
  };

  const freshErrors = validate(fresh);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terms for {yearName}</DialogTitle>
          <DialogDescription>
            Teachers record marks in an open term. Close a term when its marks are final; end of term and end of year reports warn until it is closed.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
        ) : (
          <div className="space-y-3">
            {terms.map((t) => {
              const d = drafts[t.id];
              const errs = validate(d);
              const changed = d.name !== t.name || d.start_date !== t.start_date || d.end_date !== t.end_date || d.status !== t.status;
              return (
                <div key={t.id} className="rounded-xl border p-3 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-start" style={{ borderColor: "var(--border)" }}>
                  <div>
                    <Input value={d.name} maxLength={RULES.TERM_NAME_MAX} aria-label="Term name"
                      onChange={(e) => setDrafts((p) => ({ ...p, [t.id]: { ...d, name: sanitiseTyping(e.target.value, RULES.TERM_NAME_MAX) } }))} />
                    <FieldError message={errs.name} />
                  </div>
                  <div>
                    <Input type="date" value={d.start_date} aria-label="Start date"
                      onChange={(e) => setDrafts((p) => ({ ...p, [t.id]: { ...d, start_date: e.target.value } }))} />
                    <FieldError message={errs.start_date} />
                  </div>
                  <div>
                    <Input type="date" value={d.end_date} aria-label="End date"
                      onChange={(e) => setDrafts((p) => ({ ...p, [t.id]: { ...d, end_date: e.target.value } }))} />
                    <FieldError message={errs.end_date} />
                  </div>
                  <Select value={d.status} onValueChange={(v) => setDrafts((p) => ({ ...p, [t.id]: { ...d, status: v as Term["status"] } }))}>
                    <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="active">Open for marks</SelectItem>
                      <SelectItem value="closed">Closed (final)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" disabled={!changed || saving !== null} onClick={() => saveTerm(t)}>
                    {saving === t.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
                  </Button>
                </div>
              );
            })}

            {nextSequence ? (
              <div className="rounded-xl border border-dashed p-3 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-start" style={{ borderColor: "var(--border)" }}>
                <div>
                  <Input value={fresh.name} maxLength={RULES.TERM_NAME_MAX} aria-label="New term name"
                    onChange={(e) => setFresh({ ...fresh, name: sanitiseTyping(e.target.value, RULES.TERM_NAME_MAX) })} />
                  {freshTouched && <FieldError message={freshErrors.name} />}
                </div>
                <div>
                  <Input type="date" value={fresh.start_date} aria-label="New term start"
                    onChange={(e) => setFresh({ ...fresh, start_date: e.target.value })} />
                  {freshTouched && <FieldError message={freshErrors.start_date} />}
                </div>
                <div>
                  <Input type="date" value={fresh.end_date} aria-label="New term end"
                    onChange={(e) => setFresh({ ...fresh, end_date: e.target.value })} />
                  {freshTouched && <FieldError message={freshErrors.end_date} />}
                </div>
                <Button onClick={addTerm} disabled={saving !== null} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                  {saving === "new" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus size={16} className="mr-1" />}
                  Add term {nextSequence}
                </Button>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--mid-gray)" }}>All three terms are set up.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
