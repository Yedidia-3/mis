import { ArrowLeft, Bus, CheckCircle2, Loader2, Search, Trash2, Users, Utensils } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

type EnrollType = "feeding" | "transport";

interface RosterStudent {
  id: number;
  student_id: string;
  name: string;
  class_id: number | null;
  p_level_id: number | null;
  p_level_name: string;
  current_class: string;
}

interface Zone { id: number; name: string; price: number; }

export function StudentListPerClass() {
  const { pLevelId } = useParams<{ pLevelId: string }>();
  const navigate = useNavigate();

  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [enrollmentByStudent, setEnrollmentByStudent] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [enrollType, setEnrollType] = useState<EnrollType>("feeding");
  const [classFilter, setClassFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [showEnroll, setShowEnroll] = useState(false);
  const [showRemove, setShowRemove] = useState(false);
  const [zoneId, setZoneId] = useState("");
  const [saving, setSaving] = useState(false);

  const loadRoster = useCallback(async () => {
    try {
      const [roster, zoneRes] = await Promise.all([
        api.get<{ students: RosterStudent[] }>('/api/v1/accountant/roster'),
        api.get<any>('/api/v1/accountant/zones').catch(() => []),
      ]);
      const mine = (roster?.students ?? []).filter((s) => String(s.p_level_id) === String(pLevelId));
      setStudents(mine);
      setZones(Array.isArray(zoneRes) ? zoneRes : zoneRes.data ?? []);
    } catch {
      toast.error('Failed to load class list');
    } finally {
      setLoading(false);
    }
  }, [pLevelId]);

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await api.get<any>(`/api/v1/accountant/enrollments?type=${enrollType}`);
      const list = Array.isArray(res) ? res : res.data ?? [];
      const map: Record<number, number> = {};
      for (const row of list) {
        const studentId = Number(row?.student_id ?? row?.student?.id);
        const enrollmentId = Number(row?.id);
        if (studentId && enrollmentId) map[studentId] = enrollmentId;
      }
      setEnrollmentByStudent(map);
    } catch {
      /* enrollment status is optional on this screen */
    }
  }, [enrollType]);

  useEffect(() => { loadRoster(); }, [loadRoster]);
  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);

  const pLevelName = students[0]?.p_level_name ?? "Class list";
  const classes = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of students) {
      if (student.class_id != null) map.set(String(student.class_id), student.current_class);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [students]);

  const visible = students
    .filter((s) => classFilter === "all" || String(s.class_id) === classFilter)
    .filter((s) => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q) || s.current_class.toLowerCase().includes(q);
    })
    .sort((a, b) => a.current_class.localeCompare(b.current_class) || a.name.localeCompare(b.name));

  const visibleIds = visible.map((s) => s.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const selectedVisible = selected.filter((id) => visibleIds.includes(id));
  const importIds = selectedVisible.filter((id) => enrollmentByStudent[id] == null);
  const removeEnrollmentIds = selectedVisible
    .map((id) => enrollmentByStudent[id])
    .filter((id): id is number => typeof id === "number");
  const serviceLabel = enrollType === "feeding" ? "Feeding" : "Transport";

  const toggleAll = () => {
    setSelected((prev) => {
      if (allVisibleSelected) return prev.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleImport = async () => {
    if (!importIds.length) {
      toast.info('The selected students are already in this enrollment');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<any>('/api/v1/accountant/enrollments/bulk', {
        student_ids: importIds,
        type: enrollType,
        zone_id: enrollType === 'transport' && zoneId ? +zoneId : undefined,
      });
      const created = res?.created ?? importIds.length;
      toast.success(`${created} student${created === 1 ? '' : 's'} imported into ${enrollType}`);
      setShowEnroll(false);
      setSelected([]);
      await loadEnrollments();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to import');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!removeEnrollmentIds.length) {
      toast.info(`None of the selected students are in ${serviceLabel.toLowerCase()}`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<{ removed: number }>('/api/v1/accountant/enrollments/bulk-remove', {
        ids: removeEnrollmentIds,
      });
      const removed = res?.removed ?? removeEnrollmentIds.length;
      toast.success(`${removed} student${removed === 1 ? '' : 's'} removed from ${enrollType}`);
      setShowRemove(false);
      setSelected([]);
      await loadEnrollments();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove selected students');
    } finally {
      setSaving(false);
    }
  };

  const TypeIcon = enrollType === "feeding" ? Utensils : Bus;

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/accountant/class-lists")} style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back to P-Levels
        </Button>
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate("/accountant/class-lists")} style={{ color: "var(--maroon)" }}>
        <ArrowLeft size={18} className="mr-2" /> Back to P-Levels
      </Button>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>{pLevelName} — Class List</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Select students, then import them into feeding or transport, or remove the ones already enrolled. This copy shows student ID, name, and class.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => { setZoneId(zones[0] ? String(zones[0].id) : ""); setShowEnroll(true); }}
            disabled={importIds.length === 0}
            className="h-11"
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
          >
            Import selected to {serviceLabel}
            {importIds.length > 0 ? ` (${importIds.length})` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowRemove(true)}
            disabled={removeEnrollmentIds.length === 0}
            className="h-11"
            style={{ borderColor: "var(--danger-red)", color: "var(--danger-red)" }}
          >
            <Trash2 size={16} className="mr-2" />
            Remove selected from {serviceLabel}
            {removeEnrollmentIds.length > 0 ? ` (${removeEnrollmentIds.length})` : ""}
          </Button>
        </div>
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: "var(--dark-gray)" }}>Service:</span>
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {(["feeding", "transport"] as EnrollType[]).map((t) => {
                const Icon = t === "feeding" ? Utensils : Bus;
                const active = enrollType === t;
                return (
                  <button key={t} onClick={() => setEnrollType(t)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: active ? "var(--maroon)" : "#FFFFFF", color: active ? "#FFFFFF" : "var(--mid-gray)" }}>
                    <Icon size={16} /> {t === "feeding" ? "Feeding" : "Transport"}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-64 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{pLevelName} — All classes ({students.length})</SelectItem>
                {classes.map(([id, name]) => (
                  <SelectItem key={id} value={id}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search ID, name, or class" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: "var(--mid-gray)" }}>
            <span className="flex items-center gap-1"><Users size={14} /> {visible.length} students</span>
            <span>{selectedVisible.length} selected</span>
          </div>
        </CardContent>
      </Card>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="flex items-center gap-3 px-4 py-3 text-white text-sm font-semibold"
              style={{ backgroundColor: "var(--navy-blue)" }}>
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} className="bg-white" aria-label="Select all students in view" />
              <span className="w-28">Student ID</span>
              <span className="flex-1">Name</span>
              <span className="w-24">Class</span>
              <span className="w-32 text-right">{serviceLabel}</span>
            </div>
            {visible.length === 0 ? (
              <div className="text-center py-12">
                <TypeIcon size={40} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
                <p style={{ color: "var(--mid-gray)" }}>
                  {students.length === 0 ? "Accept the distributed class list before students appear here." : "No students match this view."}
                </p>
              </div>
            ) : visible.map((student, index) => {
              const isEnrolled = enrollmentByStudent[student.id] != null;
              return (
                <div key={student.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0"
                  style={{ borderColor: "var(--border)", backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F9F9FB" }}>
                  <Checkbox checked={selected.includes(student.id)} onCheckedChange={() => toggleOne(student.id)} aria-label={`Select ${student.name}`} />
                  <span className="w-28 text-sm font-medium" style={{ color: "var(--dark-gray)" }}>{student.student_id}</span>
                  <span className="flex-1 font-medium" style={{ color: "var(--dark-gray)" }}>{student.name}</span>
                  <span className="w-24">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: "var(--navy-blue)" }}>
                      {student.current_class}
                    </span>
                  </span>
                  <span className="w-32 text-right">
                    {isEnrolled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--success-green)" }}>
                        <CheckCircle2 size={12} /> In {serviceLabel.toLowerCase()}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--mid-gray)" }}>Not in {serviceLabel.toLowerCase()}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showEnroll} onOpenChange={setShowEnroll}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import selected to {serviceLabel}</DialogTitle>
            <DialogDescription>
              {importIds.length} selected student{importIds.length === 1 ? "" : "s"} will be added.
              Students already enrolled are left as they are.
            </DialogDescription>
          </DialogHeader>
          {enrollType === "transport" && (
            <div>
              <Label>Default transport zone</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger className="w-full h-11 mt-2"><SelectValue placeholder="No zone yet" /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={String(z.id)}>{z.name} — {z.price.toLocaleString()} RWF</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEnroll(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={saving || importIds.length === 0}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {importIds.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRemove} onOpenChange={setShowRemove}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove selected from {serviceLabel}</DialogTitle>
            <DialogDescription>
              {removeEnrollmentIds.length} selected student{removeEnrollmentIds.length === 1 ? "" : "s"} will be removed from {serviceLabel.toLowerCase()}.
              Students who are not in {serviceLabel.toLowerCase()} stay as they are. Payment history stays archived.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRemove(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleRemove} disabled={saving || removeEnrollmentIds.length === 0}
              style={{ backgroundColor: "var(--danger-red)", color: "#FFFFFF" }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove {removeEnrollmentIds.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
