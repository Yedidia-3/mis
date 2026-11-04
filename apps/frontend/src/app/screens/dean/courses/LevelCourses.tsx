import { BookOpen, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { BAND_FROM_PATH, BAND_PATH, bandOf } from "../../../../lib/schoolBands";
import { EmptyState, ErrorState, FieldError, Loading, PageHeader } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";

interface Subject {
  id: number; name: string; code: string; display_order: number; status: string;
}
interface PLevel { id: number; name: string }

const NAME_MAX = 80;
const CODE_MAX = 16;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9+\-_]*$/;

function validate(name: string, code: string) {
  const n = name.replace(/\s+/g, " ").trim();
  const c = code.trim().toUpperCase();
  return {
    name: n.length < 2 ? "Enter a course name" : n.length > NAME_MAX ? `Keep the name under ${NAME_MAX} characters` : null,
    code: !c ? "Enter a short code" : !CODE_PATTERN.test(c) ? "Use letters, digits, +, - or _" : c.length > CODE_MAX ? `Keep the code under ${CODE_MAX} characters` : null,
    clean: { name: n, code: c },
  };
}

/** Courses taught at one P-level. Periods / credits are hidden until brought back. */
export function LevelCourses() {
  const { section, pLevelId } = useParams();
  const band = section ? BAND_FROM_PATH[section] : undefined;
  const id = Number(pLevelId);
  const [level, setLevel] = useState<PLevel | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id < 1) {
      setError("That level was not found");
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [pl, list] = await Promise.all([
        api.get<PLevel>(`/api/v1/academics/p-levels/${id}`),
        api.get<Subject[]>(`/api/v1/academics/assessments/subjects?p_level_id=${id}`),
      ]);
      setLevel(pl);
      setSubjects(list);
    } catch (e: any) {
      setError(e?.message ?? "Could not load courses");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!band) return <Navigate to="/dean/courses" replace />;
  if (!loading && level && bandOf(level.name) !== band) {
    return <Navigate to={`/dean/courses/${BAND_PATH[bandOf(level.name)!]}/${level.id}`} replace />;
  }

  const openCreate = () => {
    setEditing(null); setName(""); setCode(""); setTouched(false); setDialog("create");
  };
  const openEdit = (s: Subject) => {
    setEditing(s); setName(s.name); setCode(s.code); setTouched(false); setDialog("edit");
  };

  const errs = validate(name, code);
  const save = async () => {
    setTouched(true);
    if (errs.name || errs.code) return;
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/v1/academics/assessments/subjects/${editing.id}`, errs.clean);
        toast.success(`${errs.clean.name} updated`);
      } else {
        await api.post(`/api/v1/academics/assessments/subjects`, {
          p_level_id: id,
          name: errs.clean.name,
          code: errs.clean.code,
          display_order: subjects.length,
        });
        toast.success(`${errs.clean.name} added to ${level?.name ?? "this level"}`);
      }
      setDialog(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save the course");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Subject) => {
    setRemoving(s.id);
    try {
      const res = await api.delete<{ message?: string }>(`/api/v1/academics/assessments/subjects/${s.id}`);
      toast.success((res as any)?.message ?? `${s.name} removed`);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove the course");
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="space-y-6">
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : !level ? (
        <EmptyState icon={<BookOpen size={44} />} title="Level not found" />
      ) : (
        <>
          <PageHeader
            back={`/dean/courses/${BAND_PATH[band]}`}
            title={`${level.name} courses`}
            subtitle="These courses belong only to this level. Teachers can mark them only in classes they are assigned to teach."
            actions={
              <Button onClick={openCreate} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                <Plus size={16} className="mr-1.5" /> Add course
              </Button>
            }
          />

          {subjects.length === 0 ? (
            <EmptyState icon={<BookOpen size={44} />} title={`No courses on ${level.name} yet`}>
              Add the courses this level takes — for example Mathematics, English, or Kinyarwanda.
            </EmptyState>
          ) : (
            <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Course</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="w-28 text-right pr-5">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="pl-5 font-medium" style={{ color: "var(--dark-gray)" }}>{s.name}</TableCell>
                      <TableCell style={{ color: "var(--mid-gray)" }}>{s.code}</TableCell>
                      <TableCell className="text-right pr-3">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)} aria-label={`Edit ${s.name}`}>
                          <Pencil size={14} />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={removing === s.id}
                          onClick={() => remove(s)} aria-label={`Remove ${s.name}`}>
                          {removing === s.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} style={{ color: "var(--danger-red)" }} />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? `Edit ${editing.name}` : `Add a course to ${level.name}`}</DialogTitle>
                <DialogDescription>
                  Name and code only for now. Teachers assigned this course on {level.name} will see it when recording marks.
                </DialogDescription>
              </DialogHeader>
              <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); save(); }}>
                <div>
                  <Label htmlFor="course-name">Name</Label>
                  <Input id="course-name" className="mt-1.5" value={name} maxLength={NAME_MAX}
                    placeholder="e.g. Mathematics"
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setName((n) => n.replace(/\s+/g, " ").trim())}
                    aria-invalid={touched && !!errs.name} />
                  {touched && <FieldError message={errs.name} />}
                </div>
                <div>
                  <Label htmlFor="course-code">Code</Label>
                  <Input id="course-code" className="mt-1.5" value={code} maxLength={CODE_MAX}
                    placeholder="e.g. MATH"
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    aria-invalid={touched && !!errs.code} />
                  {touched && <FieldError message={errs.code} />}
                </div>
                <button type="submit" hidden />
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
                <Button onClick={save} disabled={saving} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Save" : "Add course"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

