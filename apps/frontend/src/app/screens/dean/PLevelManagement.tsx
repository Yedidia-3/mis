import { useState, useEffect, useCallback } from "react";
import { Plus, MoreVertical, Users, BookOpen, Loader2, Upload } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { useNavigate } from "react-router";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";
import { pLevelStatus } from "../../../lib/plevelStatus";

interface AcademicYear { id: number; name: string; status: string; }
interface PLevel {
  id: number;
  name: string;
  academic_year_id: number;
  teaching_model?: "class_teacher" | "specialist";
  classes: { id: number; students?: any[]; student_count?: number; pending_imported_count?: number }[];
  class_count?: number;
  student_count?: number;
  pending_imported_count?: number;
  is_distributed?: boolean;
  any_distributed?: boolean;
}

export function PLevelManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPrincipal = user?.role === "principal";
  const routePrefix = isPrincipal ? "/principal" : "/dean";

  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [pLevels, setPLevels] = useState<PLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPLevel, setSelectedPLevel] = useState<PLevel | null>(null);
  const [newPLevelName, setNewPLevelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [importOutcome, setImportOutcome] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const years = await api.get<any>('/api/v1/academics/academic-years');
      const yearList: AcademicYear[] = Array.isArray(years) ? years : years.data ?? [];
      const active = yearList.find(y => y.status === 'active') ?? null;
      setActiveYear(active);
      if (active) {
        const pl = await api.get<any>(`/api/v1/academics/p-levels?academic_year_id=${active.id}`);
        setPLevels(Array.isArray(pl) ? pl : pl.data ?? []);
      }
    } catch {
      toast.error('Failed to load P-Levels');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const handleAdd = async () => {
    if (!newPLevelName.trim() || !activeYear) return;
    setSaving(true);
    try {
      await api.post('/api/v1/academics/p-levels', { name: newPLevelName.trim(), academic_year_id: activeYear.id });
      toast.success(`${newPLevelName} created`);
      setShowAddDialog(false);
      setNewPLevelName("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPLevel) return;
    setSaving(true);
    try {
      await api.delete(`/api/v1/academics/p-levels/${selectedPLevel.id}`);
      toast.success(`${selectedPLevel.name} removed`);
      setShowDeleteDialog(false);
      setSelectedPLevel(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const setTeachingModel = async (pl: PLevel, teaching_model: "class_teacher" | "specialist") => {
    if (pl.teaching_model === teaching_model) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/academics/p-levels/${pl.id}/teaching-model`, { teaching_model });
      toast.success(
        teaching_model === "specialist"
          ? `${pl.name} is now a specialist level — assign subject teachers on Teacher Assignments`
          : `${pl.name} is now a class-teacher level — one teacher covers every subject`,
      );
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Could not update the teaching model");
    } finally {
      setSaving(false);
    }
  };


  const uploadClassLists = async (files: File[], dryRun: boolean) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return api.upload<any>(`/api/v1/academics/class-lists/import?dry_run=${dryRun ? 'true' : 'false'}`, form);
  };

  const handleClassListFiles = async (files: File[]) => {
    const chosen = files.filter((file) => /\.xls[x]?$/i.test(file.name));
    if (!chosen.length) return;
    setImporting(true);
    try {
      const preview = await uploadClassLists(chosen, true);
      setImportFiles(chosen);
      setImportPreview(preview);
    } catch (err: any) {
      toast.error(err.message ?? 'Could not read those class lists');
    } finally {
      setImporting(false);
    }
  };

  const confirmClassLists = async () => {
    if (!importFiles.length) return;
    setImporting(true);
    try {
      const result = await uploadClassLists(importFiles, false);
      setImportPreview(null);
      setImportFiles([]);
      setImportOutcome(result);
      await load();
    } catch (err: any) {
      setImportPreview(null);
      setImportOutcome({ message: err.message ?? 'Import failed', results: [] });
    } finally {
      setImporting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin" size={36} style={{ color: "var(--navy-blue)" }} />
    </div>
  );

  if (!activeYear) return (
    <div className="text-center py-20">
      <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No active academic year</p>
      <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
        Ask the Super Admin to create an academic year first.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>P-Levels</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>Academic year: {activeYear.name}</p>
        </div>
        {!isPrincipal && (
          <Button onClick={() => setShowAddDialog(true)} className="h-11"
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            <Plus size={18} className="mr-2" /> Add P-Level
          </Button>
        )}
      </div>

      {!isPrincipal && pLevels.length > 0 && (
        <div
          className="rounded-xl border-2 border-dashed p-5"
          style={{ borderColor: 'var(--navy-blue)', backgroundColor: '#fff' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleClassListFiles(Array.from(e.dataTransfer.files ?? []));
          }}
        >
          <input
            id="all-class-lists"
            type="file"
            accept=".xls,.xlsx"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleClassListFiles(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold" style={{ color: 'var(--dark-gray)' }}>Update all class lists</p>
              <p className="text-sm mt-1" style={{ color: 'var(--mid-gray)' }}>
                Drop every class Excel file at once. Each file is matched by its Class line, such as P1-A or P4D. The list columns become the columns in the file.
              </p>
            </div>
            <Button asChild style={{ backgroundColor: 'var(--maroon)', color: '#fff' }}>
              <label htmlFor="all-class-lists" className="cursor-pointer">
                <Upload size={16} className="mr-2" /> Choose files
              </label>
            </Button>
          </div>
          {importing && <Loader2 className="mt-3 animate-spin" size={18} style={{ color: 'var(--navy-blue)' }} />}
        </div>
      )}

      {pLevels.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-card/60 p-12 text-center shadow-xs">
          <div className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 10%, transparent)" }}>
            <BookOpen size={24} style={{ color: "var(--maroon)" }} />
          </div>
          <p className="text-base font-semibold tracking-tight" style={{ color: "var(--dark-gray)" }}>No P-Levels yet</p>
          <p className="text-xs mt-1 mb-5 text-muted-foreground">
            {isPrincipal ? "The Dean has not created any P-Levels yet." : "Create the first primary level to organize classes and students."}
          </p>
          {!isPrincipal && (
            <Button onClick={() => setShowAddDialog(true)} style={{ backgroundColor: "var(--maroon)", color: "#fff" }} className="h-10 px-5 rounded-xl font-medium">
              <Plus size={16} className="mr-2" /> Add P-Level
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pLevels.map((pl) => {
            const classCount = pl.class_count ?? pl.classes?.length ?? 0;
            const studentCount = pl.student_count
              ?? pl.classes?.reduce((sum, c) => sum + (c.student_count ?? c.students?.length ?? 0), 0)
              ?? 0;
            const status = pLevelStatus(pl);
            return (
              <Card key={pl.id} className="interactive-card border-black/[0.06] shadow-xs">
                <CardContent className="p-6 flex flex-col justify-between h-full">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-2xl font-bold tracking-tight" style={{ color: "var(--dark-gray)" }}>{pl.name}</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: status.bg, color: status.color }}>
                          {status.label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: pl.teaching_model === "specialist"
                              ? "color-mix(in srgb, var(--navy-blue) 12%, white)"
                              : "color-mix(in srgb, var(--success-green) 12%, white)",
                            color: pl.teaching_model === "specialist" ? "var(--navy-blue)" : "var(--success-green)",
                          }}>
                          {pl.teaching_model === "specialist" ? "Specialist (P3–P6 style)" : "Class teacher"}
                        </span>
                        {Number(pl.pending_imported_count || 0) > 0 && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow-xs cursor-pointer animate-pulse"
                            style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }}
                            title={`${pl.pending_imported_count} imported student(s) pending review`}
                            onClick={() => navigate(`${routePrefix}/p-levels/${pl.id}/classes`)}
                          >
                            ⚠️ Imported! ({pl.pending_imported_count})
                          </span>
                        )}
                      </div>
                      {!isPrincipal && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/dean/p-levels/${pl.id}/classes`)}>
                              Manage Classes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/dean/p-levels/${pl.id}/classes`)}>
                              Import Students
                            </DropdownMenuItem>
                            {pl.teaching_model !== "specialist" ? (
                              <DropdownMenuItem onClick={() => setTeachingModel(pl, "specialist")}>
                                Use specialist teachers (P3–P6 style)
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setTeachingModel(pl, "class_teacher")}>
                                Use one class teacher for all subjects
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              onClick={() => { setSelectedPLevel(pl); setShowDeleteDialog(true); }}>
                              Delete P-Level
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    <div className="space-y-3 py-1">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--navy-blue) 12%, transparent)" }}>
                          <BookOpen size={18} style={{ color: "var(--navy-blue)" }} />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Classes</p>
                          <p className="text-lg font-bold tabular-nums tracking-tight" style={{ color: "var(--dark-gray)" }}>{classCount}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 12%, transparent)" }}>
                          <Users size={18} style={{ color: "var(--maroon)" }} />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Students</p>
                          <p className="text-lg font-bold tabular-nums tracking-tight" style={{ color: "var(--dark-gray)" }}>{studentCount}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button onClick={() => navigate(`${routePrefix}/p-levels/${pl.id}/classes`)}
                    className="w-full mt-6 rounded-xl font-medium" variant="outline"
                    style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
                    {isPrincipal ? "View Classes" : "Manage Classes"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New P-Level</DialogTitle>
            <DialogDescription>
              For academic year {activeYear.name}. P3–P6 open as specialist levels (several subject teachers per class); nursery and P1–P2 keep one class teacher.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>P-Level Name</Label>
            <Input className="mt-2 h-11" placeholder="e.g. P3" value={newPLevelName}
              onChange={e => setNewPLevelName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving || !newPLevelName.trim()}
              style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importPreview} onOpenChange={(open) => { if (!open) { setImportPreview(null); setImportFiles([]); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Update these class lists</DialogTitle>
            <DialogDescription>{importPreview?.message}</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto space-y-3 text-sm" style={{ color: 'var(--dark-gray)' }}>
            {(importPreview?.results ?? []).map((item: any) => (
              <div key={item.file} className="rounded border p-3" style={{ borderColor: 'var(--border)' }}>
                <p className="font-medium">{item.class_label || item.file}</p>
                <p style={{ color: item.error ? 'var(--danger-red)' : 'var(--mid-gray)' }}>
                  {item.error || item.message}
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setImportPreview(null); setImportFiles([]); }} disabled={importing}>Cancel</Button>
            <Button onClick={confirmClassLists} disabled={importing || !(importPreview?.results ?? []).some((item: any) => !item.error)} style={{ backgroundColor: 'var(--maroon)', color: '#fff' }}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update class lists
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!importOutcome} onOpenChange={(open) => { if (!open) setImportOutcome(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Class lists updated</DialogTitle>
            <DialogDescription>{importOutcome?.message}</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-auto space-y-3 text-sm" style={{ color: 'var(--dark-gray)' }}>
            {(importOutcome?.results ?? []).map((item: any) => (
              <div key={`${item.file}-${item.class_label ?? ''}`} className="rounded border p-3" style={{ borderColor: 'var(--border)' }}>
                <p className="font-medium">{item.class_label || item.file}</p>
                <p style={{ color: item.error ? 'var(--danger-red)' : 'var(--dark-gray)' }}>{item.error || item.message}</p>
                {!item.error && (
                  <p style={{ color: 'var(--mid-gray)' }}>
                    {item.new_count ?? 0} added, {item.already_in_class ?? 0} already in the class, {item.already_elsewhere ?? 0} already in another class.
                    {item.headers?.length ? ` Columns: ${item.headers.join(', ')}.` : ''}
                  </p>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setImportOutcome(null)} style={{ backgroundColor: 'var(--maroon)', color: '#fff' }}>Back to P-Levels</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedPLevel?.name}?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={saving} style={{ backgroundColor: "var(--danger-red)", color: "#fff" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
