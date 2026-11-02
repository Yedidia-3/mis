import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { isRealDate, normaliseText, RULES, sanitiseTyping, validateTermName } from "../../../../lib/academicRules";
import { FieldError } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

export interface TermRow {
  id: number; name: string; sequence: number; start_date: string; end_date: string;
  status: "upcoming" | "active" | "closed"; drafts: number; submitted: number;
}

interface Draft { name: string; start_date: string; end_date: string }

function validate(d: Draft, others: TermRow[]): Record<string, string | null> {
  const overlap = isRealDate(d.start_date) && isRealDate(d.end_date)
    ? others.find((t) => t.start_date <= d.end_date && t.end_date >= d.start_date)
    : undefined;
  return {
    name: validateTermName(d.name),
    start_date: isRealDate(d.start_date) ? null : "Enter a real date",
    end_date: !isRealDate(d.end_date) ? "Enter a real date"
      : d.end_date < d.start_date ? "Ends before it starts"
      : overlap ? `Overlaps ${overlap.name} (${overlap.start_date} to ${overlap.end_date})`
      : null,
  };
}

/** Name and dates only; a term's status changes through Open and Close on the Terms page. */
export function TermDialog({ open, onOpenChange, yearId, term, sequence, terms, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; yearId: number;
  term: TermRow | null; sequence: number; terms: TermRow[]; onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>({ name: "", start_date: "", end_date: "" });
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setDraft(term
      ? { name: term.name, start_date: term.start_date, end_date: term.end_date }
      : { name: `Term ${sequence}`, start_date: "", end_date: "" });
  }, [open, term, sequence]);

  const errors = validate(draft, terms.filter((t) => t.id !== term?.id));
  const valid = Object.values(errors).every((e) => !e);
  const show = (k: string) => (touched ? errors[k] : null);

  const save = async () => {
    setTouched(true);
    if (!valid) return;
    const body = { name: normaliseText(draft.name), start_date: draft.start_date, end_date: draft.end_date };
    setSaving(true);
    try {
      if (term) {
        await api.put(`/api/v1/academics/assessments/terms/${term.id}`, body);
        toast.success(`${body.name} saved`);
      } else {
        await api.post(`/api/v1/academics/assessments/terms`, { ...body, academic_year_id: yearId, sequence });
        toast.success(`${body.name} added. Open it when teachers should start recording.`);
      }
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the term");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{term ? `Edit ${term.name}` : `Add term ${sequence}`}</DialogTitle>
          <DialogDescription>
            Assessments must be dated inside the term, so keep the dates wide enough to cover every mark already recorded.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 py-1" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div>
            <Label htmlFor="term-name">Name</Label>
            <Input id="term-name" className="mt-1.5" value={draft.name} maxLength={RULES.TERM_NAME_MAX}
              onChange={(e) => setDraft({ ...draft, name: sanitiseTyping(e.target.value, RULES.TERM_NAME_MAX) })}
              onBlur={() => setDraft((d) => ({ ...d, name: normaliseText(d.name) }))} aria-invalid={!!show("name")} />
            <FieldError message={show("name")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="term-start">Starts</Label>
              <Input id="term-start" type="date" className="mt-1.5" value={draft.start_date}
                onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} aria-invalid={!!show("start_date")} />
              <FieldError message={show("start_date")} />
            </div>
            <div>
              <Label htmlFor="term-end">Ends</Label>
              <Input id="term-end" type="date" className="mt-1.5" value={draft.end_date} min={draft.start_date || undefined}
                onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} aria-invalid={!!show("end_date")} />
              <FieldError message={show("end_date")} />
            </div>
          </div>
          <button type="submit" hidden />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {term ? "Save" : "Add term"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
