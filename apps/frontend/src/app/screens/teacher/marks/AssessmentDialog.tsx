import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import {
  CATEGORIES, normaliseText, parseBoundedNumber, RULES, sanitiseNumberTyping, sanitiseTyping,
  todayIso, validateAssessmentDate, validateTitle,
} from "../../../../lib/academicRules";
import { FieldError } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";

export interface RecordingOptions {
  academic_year: { id: number; name: string } | null;
  current_term_id: number | null;
  classes: {
    id: number; label: string; p_level_name: string; role: "class_teacher" | "teacher";
    student_count: number; subjects: { id: number; name: string; code: string }[];
  }[];
  terms: { id: number; name: string; sequence: number; start_date: string; end_date: string; status: string }[];
  categories: string[];
}

interface Existing {
  id: number; title: string; date: string; max_score: number; category: string | null;
  term_name: string; term_start: string; term_end: string; class_label: string; subject_name: string;
}

type Props =
  | { mode: "create"; open: boolean; onOpenChange: (o: boolean) => void; options: RecordingOptions | null; onSaved: (id: number) => void }
  | { mode: "edit"; open: boolean; onOpenChange: (o: boolean) => void; assessment: Existing; onSaved: (id: number) => void };

export function AssessmentDialog(props: Props) {
  const { open, onOpenChange, mode } = props;
  const options = mode === "create" ? props.options : null;
  const existing = mode === "edit" ? props.assessment : null;

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayIso());
  const [maxScore, setMaxScore] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched({});
    if (existing) {
      setTitle(existing.title);
      setDate(existing.date);
      setMaxScore(String(existing.max_score));
      setCategory(existing.category ?? "");
    } else {
      setClassId(options?.classes.length === 1 ? String(options.classes[0].id) : "");
      setSubjectId("");
      setCategory("");
      setTitle("");
      setMaxScore("");
      setDate(todayIso());
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const cls = options?.classes.find((c) => String(c.id) === classId);
  const currentTerm = options?.terms.find((t) => t.id === options.current_term_id && t.status === "active") ?? null;
  const term = existing
    ? { name: existing.term_name, start_date: existing.term_start, end_date: existing.term_end }
    : currentTerm;

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {};
    if (mode === "create") {
      e.class = classId ? null : "Choose a class";
      e.subject = subjectId ? null : "Choose a subject";
      e.term = currentTerm ? null : "No term is open";
    }
    e.category = CATEGORIES.some((c) => c.value === category) ? null : "Choose quiz, homework or exam";
    e.title = validateTitle(title);
    e.date = validateAssessmentDate(date, term);
    e.max = parseBoundedNumber(maxScore, RULES.MAX_SCORE_MIN, RULES.MAX_SCORE_MAX, "Maximum mark").error;
    return e;
  }, [mode, classId, subjectId, currentTerm, category, title, date, maxScore, term]);
  const valid = Object.values(errors).every((x) => !x);
  const show = (k: string) => (touched[k] ? errors[k] : null);

  const submit = async () => {
    setTouched({ class: true, subject: true, term: true, category: true, title: true, date: true, max: true });
    if (!valid) return;
    const body = {
      category,
      title: normaliseText(title),
      date,
      max_score: parseBoundedNumber(maxScore, RULES.MAX_SCORE_MIN, RULES.MAX_SCORE_MAX, "").value,
    };
    setSaving(true);
    try {
      if (existing) {
        await api.put(`/api/v1/academics/assessments/${existing.id}`, body);
        toast.success("Assessment updated");
        props.onSaved(existing.id);
      } else {
        const created = await api.post<{ id: number }>("/api/v1/academics/assessments", {
          ...body, class_id: Number(classId), subject_id: Number(subjectId), term_id: currentTerm?.id,
        });
        toast.success("Assessment created. Enter the marks next.");
        props.onSaved(created.id);
      }
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the assessment");
    } finally {
      setSaving(false);
    }
  };

  const noClasses = mode === "create" && (options?.classes.length ?? 0) === 0;
  const noTerms = mode === "create" && !currentTerm;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit assessment" : "New assessment"}</DialogTitle>
          <DialogDescription>
            {existing
              ? `${existing.subject_name} · ${existing.class_label} · ${existing.term_name}`
              : "Quizzes and homework count towards TJ on the report; exams count towards EXAM."}
          </DialogDescription>
        </DialogHeader>

        {noClasses ? (
          <p className="text-sm py-4" style={{ color: "var(--mid-gray)" }}>
            You have no classes to record yet. The dean assigns classes and subjects to teachers.
          </p>
        ) : noTerms ? (
          <p className="text-sm py-4" style={{ color: "var(--mid-gray)" }}>
            No term is open right now, so marks cannot be recorded. The dean opens each term when it starts.
          </p>
        ) : (
          <form className="grid gap-4 py-1" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
            {mode === "create" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Class</Label>
                  <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); setTouched((t) => ({ ...t, class: true })); }}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Choose class" /></SelectTrigger>
                    <SelectContent>
                      {options?.classes.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.label} · {c.role === "class_teacher" ? "Class teacher" : "Subject teacher"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={show("class")} />
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={subjectId} disabled={!cls} onValueChange={(v) => { setSubjectId(v); setTouched((t) => ({ ...t, subject: true })); }}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder={cls ? "Choose subject" : "Choose a class first"} /></SelectTrigger>
                    <SelectContent>
                      {cls?.subjects.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FieldError message={show("subject") ?? (cls && cls.subjects.length === 0 ? "No subjects assigned to you in this class" : null)} />
                </div>
                <div>
                  <Label>Term</Label>
                  <div className="mt-1.5 h-9 px-3 rounded-md border flex items-center gap-2 text-sm"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--light-gray)" }} aria-label="Term">
                    <span className="font-medium" style={{ color: "var(--dark-gray)" }}>{currentTerm?.name}</span>
                    <span className="text-xs" style={{ color: "var(--success-green)" }}>Current term</span>
                  </div>
                  <FieldError message={show("term")} />
                </div>
                <CategoryField value={category} onChange={(v) => { setCategory(v); setTouched((t) => ({ ...t, category: true })); }} error={show("category")} />
              </div>
            )}
            {mode === "edit" && (
              <CategoryField value={category} onChange={(v) => { setCategory(v); setTouched((t) => ({ ...t, category: true })); }} error={show("category")} />
            )}

            <div>
              <div className="flex items-baseline justify-between">
                <Label htmlFor="assessment-title">Title</Label>
                <span className="text-xs tabular-nums" style={{ color: title.length > RULES.TITLE_MAX - 10 ? "var(--warning-amber)" : "var(--mid-gray)" }}>
                  {title.length}/{RULES.TITLE_MAX}
                </span>
              </div>
              <Input id="assessment-title" className="mt-1.5" value={title} maxLength={RULES.TITLE_MAX}
                placeholder="e.g. Quiz 2: fractions" autoComplete="off"
                onChange={(e) => setTitle(sanitiseTyping(e.target.value, RULES.TITLE_MAX))}
                onBlur={() => { setTitle(normaliseText(title)); setTouched((t) => ({ ...t, title: true })); }}
                aria-invalid={!!show("title")} />
              <FieldError message={show("title")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="assessment-date">Date given</Label>
                <Input id="assessment-date" type="date" className="mt-1.5" value={date}
                  min={term?.start_date} max={term ? (term.end_date < todayIso() ? term.end_date : todayIso()) : todayIso()}
                  onChange={(e) => setDate(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, date: true }))} aria-invalid={!!show("date")} />
                <FieldError message={show("date")} />
              </div>
              <div>
                <Label htmlFor="assessment-max">Marked out of</Label>
                <Input id="assessment-max" inputMode="decimal" className="mt-1.5" value={maxScore} placeholder="e.g. 20"
                  onChange={(e) => { const v = sanitiseNumberTyping(e.target.value); if (v !== null) setMaxScore(v); }}
                  onBlur={() => setTouched((t) => ({ ...t, max: true }))} aria-invalid={!!show("max")} />
                <FieldError message={show("max")} />
              </div>
            </div>
            <button type="submit" hidden />
          </form>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!noClasses && !noTerms && (
            <Button onClick={submit} disabled={saving} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existing ? "Save changes" : "Create and enter marks"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error: string | null }) {
  return (
    <div>
      <Label>Category</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5"><SelectValue placeholder="Quiz, homework or exam" /></SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <FieldError message={error} />
    </div>
  );
}
