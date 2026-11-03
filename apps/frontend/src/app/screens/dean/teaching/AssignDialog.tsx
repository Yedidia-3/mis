import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { FieldError } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";

interface BoardSubject {
  subject_id: number; subject_name: string; subject_code: string; periods_per_week: number;
  teacher_id: number | null; teacher_name: string | null; unassigned: boolean;
}
interface BoardClass {
  class_id: number; class_label: string; p_level_id: number; p_level_name: string;
  teaching_model: string; subjects: BoardSubject[];
}

/** Pick one or more classes (any level) and the courses this teacher takes in each. */
export function AssignDialog({ open, onOpenChange, teacherId, teacherName, boardClasses, existingByClass, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  teacherId: number; teacherName: string;
  boardClasses: BoardClass[];
  /** Subjects this teacher already holds, keyed by class_id. */
  existingByClass: Record<number, number[]>;
  onSaved: () => void;
}) {
  const [pickedClasses, setPickedClasses] = useState<Set<number>>(new Set());
  const [subjectsByClass, setSubjectsByClass] = useState<Record<number, Set<number>>>({});
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const initialClasses = new Set(Object.keys(existingByClass).map(Number));
    const initialSubjects: Record<number, Set<number>> = {};
    for (const [classId, ids] of Object.entries(existingByClass)) {
      initialSubjects[Number(classId)] = new Set(ids);
    }
    setPickedClasses(initialClasses);
    setSubjectsByClass(initialSubjects);
    setLevelFilter("all");
    setError(null);
  }, [open, existingByClass]);

  const levels = useMemo(
    () => [...new Set(boardClasses.map((c) => c.p_level_name))].sort(),
    [boardClasses],
  );
  const visible = boardClasses.filter((c) => levelFilter === "all" || c.p_level_name === levelFilter);

  const toggleClass = (classId: number, checked: boolean) => {
    setPickedClasses((prev) => {
      const next = new Set(prev);
      if (checked) next.add(classId);
      else next.delete(classId);
      return next;
    });
    if (checked && !subjectsByClass[classId]) {
      const cls = boardClasses.find((c) => c.class_id === classId);
      // Pre-tick subjects that are free or already theirs.
      const free = new Set(
        (cls?.subjects ?? [])
          .filter((s) => s.unassigned || s.teacher_id === teacherId)
          .map((s) => s.subject_id),
      );
      setSubjectsByClass((prev) => ({ ...prev, [classId]: free }));
    }
  };

  const toggleSubject = (classId: number, subjectId: number, checked: boolean) => {
    setSubjectsByClass((prev) => {
      const set = new Set(prev[classId] ?? []);
      if (checked) set.add(subjectId);
      else set.delete(subjectId);
      return { ...prev, [classId]: set };
    });
  };

  const save = async () => {
    setError(null);
    if (!pickedClasses.size && !Object.keys(existingByClass).length) {
      setError("Choose at least one class");
      return;
    }
    // Classes they had before but unchecked now are cleared with empty subject_ids.
    const classIds = new Set([...pickedClasses, ...Object.keys(existingByClass).map(Number)]);
    const assignments = [...classIds].map((class_id) => ({
      class_id,
      subject_ids: pickedClasses.has(class_id) ? [...(subjectsByClass[class_id] ?? [])] : [],
    }));

    for (const row of assignments) {
      if (pickedClasses.has(row.class_id) && row.subject_ids.length === 0) {
        const label = boardClasses.find((c) => c.class_id === row.class_id)?.class_label ?? "a class";
        setError(`Pick at least one course in ${label}, or remove the class`);
        return;
      }
    }

    setSaving(true);
    try {
      await api.put(`/api/v1/academics/teaching/assign-batch`, {
        teacher_id: teacherId,
        assignments,
      });
      toast.success(`Assignments saved for ${teacherName}`);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the assignments");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign classes · {teacherName}</DialogTitle>
          <DialogDescription>
            Choose classes from any level, then tick the courses they teach in each. One teacher can cover several classes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <FilterChip active={levelFilter === "all"} onClick={() => setLevelFilter("all")}>All levels</FilterChip>
          {levels.map((l) => (
            <FilterChip key={l} active={levelFilter === l} onClick={() => setLevelFilter(l)}>{l}</FilterChip>
          ))}
        </div>

        <div className="space-y-3">
          {visible.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: "var(--mid-gray)" }}>No classes at this level yet.</p>
          ) : visible.map((cls) => {
            const on = pickedClasses.has(cls.class_id);
            const selected = subjectsByClass[cls.class_id] ?? new Set();
            return (
              <div key={cls.class_id} className="rounded-xl border p-3" style={{ borderColor: on ? "var(--maroon)" : "var(--border)" }}>
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <Checkbox checked={on} onCheckedChange={(v) => toggleClass(cls.class_id, v === true)} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold" style={{ color: "var(--dark-gray)" }}>{cls.class_label}</div>
                    <div className="text-xs" style={{ color: "var(--mid-gray)" }}>
                      {cls.p_level_name} · {cls.teaching_model === "class_teacher" ? "Class-teacher level" : "Specialist level"}
                    </div>
                  </div>
                </label>
                {on && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 pl-7">
                    {cls.subjects.map((s) => {
                      const takenByOther = s.teacher_id != null && s.teacher_id !== teacherId;
                      const checked = selected.has(s.subject_id);
                      return (
                        <label key={s.subject_id}
                          className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-sm ${takenByOther ? "opacity-55" : "cursor-pointer"}`}
                          style={{ borderColor: "var(--border)", backgroundColor: checked ? "color-mix(in srgb, var(--maroon) 6%, white)" : "white" }}>
                          <Checkbox checked={checked} disabled={takenByOther}
                            onCheckedChange={(v) => toggleSubject(cls.class_id, s.subject_id, v === true)} className="mt-0.5" />
                          <span className="min-w-0">
                            <span className="font-medium block truncate" style={{ color: "var(--dark-gray)" }}>{s.subject_name}</span>
                            <span className="text-xs" style={{ color: "var(--mid-gray)" }}>
                              {s.periods_per_week} periods/week
                              {takenByOther ? ` · ${s.teacher_name}` : s.teacher_id === teacherId ? " · already theirs" : ""}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <FieldError message={error} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-semibold border transition-colors"
      style={{
        borderColor: active ? "var(--maroon)" : "var(--border)",
        backgroundColor: active ? "var(--maroon)" : "white",
        color: active ? "#fff" : "var(--dark-gray)",
      }}>
      {children}
    </button>
  );
}
