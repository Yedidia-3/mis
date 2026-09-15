import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, BookOpen } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { api } from "../../../lib/api";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────
interface CatalogueEntry {
  id: number;
  name: string;
  code: string;
  default_periods_per_week: number;
  default_min_consecutive: number;
}
interface PLevel { id: number; name: string }
interface ClassGroup { id: number; name: string }

// ── Component ──────────────────────────────────────────────────────────────────
export function CourseCatalogue() {
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [pLevels, setPLevels] = useState<PLevel[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-course inline form
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newPeriods, setNewPeriods] = useState("5");
  const [adding, setAdding] = useState(false);

  // Step 1 dialog — pick p-level + class groups
  const [pickOpen, setPickOpen] = useState(false);
  const [pickedPLevel, setPickedPLevel] = useState<string>("");
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Set<number>>(new Set());
  const [loadingClasses, setLoadingClasses] = useState(false);

  // Step 2 dialog — import checklist
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [otherName, setOtherName] = useState("");
  const [otherCode, setOtherCode] = useState("");
  const [importing, setImporting] = useState(false);

  const loadCatalogue = useCallback(async () => {
    const res = await api.get<any>("/api/v1/academics/assessments/catalogue");
    setCatalogue(Array.isArray(res) ? res : res?.data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadCatalogue();
        const years = await api.get<any>("/api/v1/academics/academic-years");
        const yearList = Array.isArray(years) ? years : years?.data ?? [];
        const active = yearList.find((y: any) => y.status === "active") ?? yearList[0];
        if (active) {
          const pl = await api.get<any>(`/api/v1/academics/p-levels?academic_year_id=${active.id}`);
          setPLevels(Array.isArray(pl) ? pl : pl?.data ?? []);
        }
      } catch {
        toast.error("Failed to load courses");
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCatalogue]);

  // ── Add a new course to the catalogue ─────────────────────────────────────
  const handleAdd = async () => {
    if (!newName.trim() || !newCode.trim()) return;
    setAdding(true);
    try {
      await api.post("/api/v1/academics/assessments/catalogue", {
        name: newName.trim(),
        code: newCode.trim().toUpperCase(),
        default_periods_per_week: Number(newPeriods) || 5,
      });
      toast.success("Course added");
      setNewName(""); setNewCode(""); setNewPeriods("5");
      await loadCatalogue();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not add course");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: number) => {
    try {
      const res = await api.delete<any>(`/api/v1/academics/assessments/catalogue/${id}`);
      toast.success((res?.data ?? res)?.message ?? "Course removed");
      await loadCatalogue();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not remove course");
    }
  };

  // ── Fetch classes when p-level changes ───────────────────────────────────
  const fetchClasses = useCallback(async (pLevelId: string) => {
    if (!pLevelId) return;
    setLoadingClasses(true);
    try {
      const res = await api.get<any>(`/api/v1/academics/p-levels/${pLevelId}/classes`);
      const list: ClassGroup[] = Array.isArray(res) ? res : res?.data ?? [];
      setClasses(list);
      setSelectedClasses(new Set(list.map((c) => c.id)));
    } catch {
      toast.error("Could not load classes");
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  // ── Step 1: open pick-p-level dialog ──────────────────────────────────────
  const openPickDialog = () => {
    const first = pLevels[0] ? String(pLevels[0].id) : "";
    setPickedPLevel(first);
    setClasses([]);
    setSelectedClasses(new Set());
    setPickOpen(true);
    if (first) fetchClasses(first);
  };

  const handlePLevelChange = (val: string) => {
    setPickedPLevel(val);
    fetchClasses(val);
  };

  const allClassesChecked = classes.length > 0 && selectedClasses.size === classes.length;
  const toggleAllClasses = () =>
    setSelectedClasses(allClassesChecked ? new Set() : new Set(classes.map((c) => c.id)));
  const toggleClass = (id: number) =>
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Step 2: open import checklist ─────────────────────────────────────────
  const openImportDialog = () => {
    setSelected(new Set(catalogue.map((c) => c.id))); // pre-tick all
    setOtherName(""); setOtherCode("");
    setPickOpen(false);
    setImportOpen(true);
  };

  const allChecked = selected.size === catalogue.length;
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(catalogue.map((c) => c.id)));

  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Confirm import ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!pickedPLevel) return;
    setImporting(true);
    try {
      // If "Other" was filled in, create that course first then include it
      let extraId: number | null = null;
      if (otherName.trim() && otherCode.trim()) {
        const created = await api.post<any>("/api/v1/academics/assessments/catalogue", {
          name: otherName.trim(),
          code: otherCode.trim().toUpperCase(),
          default_periods_per_week: 5,
        });
        extraId = (created?.data ?? created)?.id ?? null;
        await loadCatalogue();
      }

      const ids = [...selected, ...(extraId ? [extraId] : [])];
      if (ids.length === 0) { toast.warning("Select at least one course"); setImporting(false); return; }

      const res = await api.post<any>("/api/v1/academics/assessments/catalogue/assign-p-level", {
        p_level_id: Number(pickedPLevel),
        catalogue_ids: ids,
      });
      const data = res?.data ?? res;
      const levelName = pLevels.find((p) => String(p.id) === pickedPLevel)?.name ?? pickedPLevel;
      toast.success(`${data.assigned} course(s) assigned to ${levelName}`);
      setImportOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not assign courses");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
            Courses
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Define courses once here, then assign them to p-levels in bulk.
          </p>
        </div>
        <Button
          onClick={openPickDialog}
          disabled={catalogue.length === 0 || pLevels.length === 0}
          style={{ backgroundColor: "var(--navy-blue)", color: "white" }}
        >
          <BookOpen size={15} className="mr-2" /> Add P-Level
        </Button>
      </div>

      {/* Catalogue table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Course</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Periods / week</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogue.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-6 font-medium" style={{ color: "var(--dark-gray)" }}>
                    {c.name}
                  </TableCell>
                  <TableCell style={{ color: "var(--mid-gray)" }}>{c.code}</TableCell>
                  <TableCell style={{ color: "var(--mid-gray)" }}>{c.default_periods_per_week}</TableCell>
                  <TableCell className="text-right pr-4">
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(c.id)}>
                      <Trash2 size={14} style={{ color: "var(--danger-red)" }} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {catalogue.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10" style={{ color: "var(--mid-gray)" }}>
                    No courses yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add course inline */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm font-medium mb-3" style={{ color: "var(--dark-gray)" }}>Add a course</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1 md:col-span-2">
              <Label>Name</Label>
              <Input value={newName} placeholder="e.g. Mathematics"
                onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input value={newCode} placeholder="MATH" maxLength={16}
                onChange={(e) => setNewCode(e.target.value)} />
            </div>
            <Button onClick={handleAdd} disabled={adding || !newName.trim() || !newCode.trim()}
              style={{ backgroundColor: "var(--navy-blue)", color: "white" }}>
              {adding ? <Loader2 className="animate-spin mr-1" size={14} /> : <Plus size={14} className="mr-1" />}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Step 1: Pick P-Level ── */}
      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Which P-Level?</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-4">
            <div className="space-y-2">
              <Label>P-Level</Label>
              <Select value={pickedPLevel} onValueChange={handlePLevelChange}>
                <SelectTrigger><SelectValue placeholder="Choose a level" /></SelectTrigger>
                <SelectContent>
                  {pLevels.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {pickedPLevel && (
              <div className="space-y-2">
                <Label>Class groups</Label>
                {loadingClasses ? (
                  <div className="flex items-center gap-2 py-2">
                    <Loader2 className="animate-spin" size={14} style={{ color: "var(--navy-blue)" }} />
                    <span className="text-sm" style={{ color: "var(--mid-gray)" }}>Loading classes…</span>
                  </div>
                ) : classes.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>No classes found for this level.</p>
                ) : (
                  <div className="border rounded-md p-3 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer border-b pb-2">
                      <Checkbox checked={allClassesChecked} onCheckedChange={toggleAllClasses} />
                      <span className="text-sm font-semibold" style={{ color: "var(--dark-gray)" }}>Select all</span>
                    </label>
                    {classes.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={selectedClasses.has(c.id)}
                          onCheckedChange={() => toggleClass(c.id)}
                        />
                        <span className="text-sm" style={{ color: "var(--dark-gray)" }}>{c.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickOpen(false)}>Cancel</Button>
            <Button
              disabled={!pickedPLevel || selectedClasses.size === 0 || loadingClasses}
              onClick={openImportDialog}
              style={{ backgroundColor: "var(--navy-blue)", color: "white" }}
            >
              Import Courses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Step 2: Import checklist ── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Import courses → {pLevels.find((p) => String(p.id) === pickedPLevel)?.name}
              {classes.length > 0 && (
                <span className="font-normal text-sm ml-1" style={{ color: "var(--mid-gray)" }}>
                  ({classes.filter((c) => selectedClasses.has(c.id)).map((c) => c.name).join(", ")})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-1 max-h-72 overflow-y-auto pr-1">
            {/* Select All */}
            <label className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:bg-gray-50 border-b mb-1">
              <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              <span className="text-sm font-semibold" style={{ color: "var(--dark-gray)" }}>
                Select all
              </span>
            </label>

            {/* Each catalogue course */}
            {catalogue.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-2 py-2 rounded cursor-pointer hover:bg-gray-50">
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} />
                <span className="text-sm flex-1" style={{ color: "var(--dark-gray)" }}>{c.name}</span>
                <span className="text-xs" style={{ color: "var(--mid-gray)" }}>{c.code}</span>
              </label>
            ))}

            {/* Other */}
            <div className="border-t mt-2 pt-3 px-2 space-y-2">
              <p className="text-xs font-medium" style={{ color: "var(--mid-gray)" }}>
                Other — add a new course and include it in this import
              </p>
              <div className="flex gap-2">
                <Input
                  className="flex-1 h-8 text-sm"
                  placeholder="Course name"
                  value={otherName}
                  onChange={(e) => setOtherName(e.target.value)}
                />
                <Input
                  className="w-24 h-8 text-sm"
                  placeholder="Code"
                  maxLength={16}
                  value={otherCode}
                  onChange={(e) => setOtherCode(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button
              onClick={handleImport}
              disabled={importing || (selected.size === 0 && !otherName.trim())}
              style={{ backgroundColor: "var(--navy-blue)", color: "white" }}
            >
              {importing && <Loader2 className="animate-spin mr-1" size={14} />}
              Confirm import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
