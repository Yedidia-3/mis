import {
    AlertTriangle,
    ArrowLeft,
    Bus,
    CheckCircle2,
    Layers,
    Loader2, Plus,
    Search,
    Trash2,
    Users,
    Utensils,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

type EnrollType = "feeding" | "transport";

interface StudentRow {
  id: number;
  name: string;
  rank: number | null;
  marks_percentage: number | null;
  former_class: string | null;
  classId: number;
  className: string;
}

interface ClassData {
  id: number;
  name: string;
  p_level: { id: number; name: string };
  students: any[];
}

interface Zone { id: number; name: string; price: number; }

interface EnrollmentInfo { id: number; expiry_date: string; zone_id: number | null; meal_type: string | null; }

const DURATION_OPTIONS = [
  { label: "1 month (30 days)", days: 30 },
  { label: "2 months (60 days)", days: 60 },
  { label: "3 months (90 days)", days: 90 },
  { label: "4 months (120 days)", days: 120 },
];

export function StudentListPerClass() {
  const { pLevelId } = useParams<{ pLevelId: string }>();
  const navigate = useNavigate();

  const [pLevelName, setPLevelName] = useState("");
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [enrollType, setEnrollType] = useState<EnrollType>("feeding");
  const [classFilter, setClassFilter] = useState<string>("all");   // "all" or classId
  const [searchTerm, setSearchTerm] = useState("");
  const [manualStudentNames, setManualStudentNames] = useState("");
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [studentEdits, setStudentEdits] = useState<Record<number, { name: string; former_class: string; rank: string; marks_percentage: string }>>({});

  // Enrollment map for the current type: student_id -> info
  const [enrolled, setEnrolled] = useState<Record<number, EnrollmentInfo>>({});

  // Enroll dialog
  const [showEnroll, setShowEnroll] = useState(false);
  const [mealType, setMealType] = useState<string>("both");
  const [zoneId, setZoneId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState("");
  const [durationDays, setDurationDays] = useState<string>("30");
  const [saving, setSaving] = useState(false);

  // Manage / Drop Class
  const [showManageClasses, setShowManageClasses] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassData | null>(null);
  const [deletingClass, setDeletingClass] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadBase = useCallback(async () => {
    try {
      const years = await api.get<any>('/api/v1/academics/academic-years');
      const yearList = Array.isArray(years) ? years : years.data ?? [];
      const active = yearList.find((y: any) => y.status === 'active');
      if (!active) { toast.error('No active academic year'); setLoading(false); return; }

      const [allClasses, zoneRes] = await Promise.all([
        api.get<any>(`/api/v1/academics/all-classes?academic_year_id=${active.id}`),
        api.get<any>('/api/v1/accountant/zones').catch(() => []),
      ]);
      const clsList: ClassData[] = Array.isArray(allClasses) ? allClasses : allClasses.data ?? [];
      const mine = clsList.filter(c => String(c.p_level?.id) === String(pLevelId));
      setClasses(mine);
      setPLevelName(mine[0]?.p_level?.name ?? '');
      setZones(Array.isArray(zoneRes) ? zoneRes : zoneRes.data ?? []);
    } catch {
      toast.error('Failed to load class lists');
    } finally {
      setLoading(false);
    }
  }, [pLevelId]);

  const loadEnrollments = useCallback(async () => {
    try {
      const res = await api.get<any>(`/api/v1/accountant/enrollments?type=${enrollType}`);
      const list = Array.isArray(res) ? res : res.data ?? [];
      const map: Record<number, EnrollmentInfo> = {};
      for (const e of list) {
        if (e.student_id) map[e.student_id] = { id: e.id, expiry_date: e.expiry_date, zone_id: e.zone_id, meal_type: e.meal_type };
      }
      setEnrolled(map);
    } catch {
      // silent
    }
  }, [enrollType]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadEnrollments(); }, [loadEnrollments]);
  useAutoRefresh(loadEnrollments);

  // ── Derived rows ──────────────────────────────────────────────────────────
  const allRows = useMemo<StudentRow[]>(() => {
    const seenStudentIds = new Set<number>();
    return classes.flatMap(c =>
      (c.students ?? []).map((s: any) => ({
        id: s.id, name: s.name, rank: s.rank, marks_percentage: s.marks_percentage,
        former_class: s.former_class, classId: c.id, className: `${c.p_level?.name ?? ''}${c.name}`,
      }))
    ).filter(r => {
      if (seenStudentIds.has(r.id)) return false;
      seenStudentIds.add(r.id);
      return true;
    });
  }, [classes]);

  useEffect(() => {
    setStudentEdits(Object.fromEntries(allRows.map((row) => [row.id, {
      name: row.name,
      former_class: row.former_class ?? '',
      rank: row.rank != null ? String(row.rank) : '',
      marks_percentage: row.marks_percentage != null ? String(row.marks_percentage) : '',
    }])));
  }, [allRows]);

  const visibleRows = allRows
    .filter(r => classFilter === "all" || String(r.classId) === classFilter)
    .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || a.name.localeCompare(b.name));

  const enrolledCount = visibleRows.filter(r => enrolled[r.id]).length;
  const notEnrolledIds = Array.from(new Set(visibleRows.filter(r => !enrolled[r.id]).map(r => r.id)));
  const paidCount = Object.keys(enrolled).length;
  const dueSoonCount = visibleRows.filter((row) => {
    const info = enrolled[row.id];
    if (!info?.expiry_date) return false;
    const today = new Date();
    const expiry = new Date(info.expiry_date);
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff >= 0 && diff <= 5;
  }).length;

  const stats = [
    { label: 'Students', value: visibleRows.length, note: 'in view' },
    { label: 'Enrolled', value: enrolledCount, note: `${enrollType} service` },
    { label: 'Not Yet Enrolled', value: Math.max(0, visibleRows.length - enrolledCount), note: 'awaiting import' },
    { label: 'Due Soon', value: dueSoonCount, note: 'within 5 days' },
  ];

  const selectedClassId = classFilter === 'all' ? (classes[0]?.id ?? null) : Number(classFilter);

  const handleAddStudentsToClass = async () => {
    if (!selectedClassId) return;
    const names = manualStudentNames
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.length) { toast.error('Enter at least one student name'); return; }
    try {
      await api.post(`/api/v1/academics/classes/${selectedClassId}/students`, { students: names.map((name) => ({ name })) });
      toast.success(`Added ${names.length} student${names.length > 1 ? 's' : ''}`);
      setManualStudentNames('');
      await loadBase();
      if (classFilter !== 'all') {
        setSearchTerm('');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add students');
    }
  };

  const handleStudentEditChange = (studentId: number, field: 'name' | 'former_class' | 'rank' | 'marks_percentage', value: string) => {
    setStudentEdits((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {
          name: '',
          former_class: '',
          rank: '',
          marks_percentage: '',
        }),
        [field]: value,
      },
    }));
  };

  const handleSaveStudent = async (student: StudentRow) => {
    const draft = studentEdits[student.id] ?? {
      name: student.name,
      former_class: student.former_class ?? '',
      rank: student.rank != null ? String(student.rank) : '',
      marks_percentage: student.marks_percentage != null ? String(student.marks_percentage) : '',
    };
    const payload = {
      name: draft.name.trim(),
      former_class: draft.former_class.trim() || null,
      rank: draft.rank === '' ? null : Number(draft.rank),
      marks_percentage: draft.marks_percentage === '' ? null : Number(draft.marks_percentage),
    };

    if (!payload.name) {
      toast.error('Student name is required');
      return;
    }

    try {
      await api.put(`/api/v1/academics/students/${student.id}`, payload);
      toast.success(`${student.name} updated`);
      setEditingStudentId(null);
      await loadBase();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update student');
    }
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const openEnroll = () => {
    setMealType("both");
    setZoneId(zones[0] ? String(zones[0].id) : "");
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setDurationDays("30");
    setShowEnroll(true);
  };

  const handleBulkEnroll = async () => {
    if (notEnrolledIds.length === 0) { toast.info('All visible students are already imported'); return; }
    setSaving(true);
    try {
      const res = await api.post<any>('/api/v1/accountant/enrollments/bulk', {
        student_ids: notEnrolledIds,
        type: enrollType,
        zone_id: enrollType === 'transport' && zoneId ? +zoneId : undefined,
      });
      const created = res?.created ?? notEnrolledIds.length;
      toast.success(`${created} student${created !== 1 ? 's' : ''} imported into ${enrollType}. Set payments in the ${enrollType} screen.`);
      setShowEnroll(false);
      await loadEnrollments();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to import');
    } finally {
      setSaving(false);
    }
  };

  const handleWaive = async (studentId: number, name: string) => {
    try {
      await api.delete(`/api/v1/accountant/enrollments/by-student/${studentId}?type=${enrollType}`);
      toast.success(`${name} waived from ${enrollType}`);
      await loadEnrollments();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to waive');
    }
  };

  const handleDeleteClass = async (cls: ClassData) => {
    const studentCount = cls.students?.length ?? 0;
    if (studentCount > 0) {
      toast.error(`Cannot drop class ${cls.p_level?.name ?? ''}${cls.name}: it still has ${studentCount} student${studentCount > 1 ? 's' : ''}. Please reassign students first.`);
      return;
    }
    setDeletingClass(true);
    try {
      await api.delete(`/api/v1/academics/classes/${cls.id}`);
      toast.success(`Class ${cls.p_level?.name ?? ''}${cls.name} has been dropped`);
      setClassToDelete(null);
      if (classFilter === String(cls.id)) {
        setClassFilter('all');
      }
      await loadBase();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to drop class');
    } finally {
      setDeletingClass(false);
    }
  };

  const TypeIcon = enrollType === 'feeding' ? Utensils : Bus;

  if (loading) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/accountant/class-lists")}
          style={{ color: "var(--maroon)" }}>
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/accountant/class-lists")}
          style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back to P-Levels
        </Button>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
            {pLevelName} — Class List
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Enroll distributed students into a service, then waive anyone who opts out.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowManageClasses(true)}
            className="h-11"
            style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}
          >
            <Layers size={18} className="mr-2" />
            Manage Classes ({classes.length})
          </Button>
          <Button onClick={openEnroll} className="h-11"
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            <Plus size={18} className="mr-2" />
            Import to {enrollType === 'feeding' ? 'Feeding' : 'Transport'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} style={{ borderColor: "var(--border)" }}>
            <CardContent className="p-5">
              <p className="text-sm" style={{ color: "var(--mid-gray)" }}>{stat.label}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>{stat.value}</p>
              <p className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>{stat.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <Label>Add students to this P-Level</Label>
              <Input
                className="mt-2 h-11"
                placeholder="Type names, one per line or separated by commas"
                value={manualStudentNames}
                onChange={(e) => setManualStudentNames(e.target.value)}
              />
            </div>
            <Button onClick={handleAddStudentsToClass} disabled={!manualStudentNames.trim() || !selectedClassId} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              Add Students
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter / context bar */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-4 space-y-4">
          {/* Service toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: "var(--dark-gray)" }}>Service:</span>
            <div className="inline-flex rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              {(["feeding", "transport"] as EnrollType[]).map(t => {
                const Icon = t === 'feeding' ? Utensils : Bus;
                const active = enrollType === t;
                return (
                  <button key={t} onClick={() => setEnrollType(t)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      backgroundColor: active ? "var(--maroon)" : "#FFFFFF",
                      color: active ? "#FFFFFF" : "var(--mid-gray)",
                    }}>
                    <Icon size={16} /> {t === 'feeding' ? 'Feeding' : 'Transport'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Class filter + search + drop class */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-64 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{pLevelName} — All Classes ({classes.reduce((sum, c) => sum + (c.students?.length ?? 0), 0)} students)</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.p_level?.name}{c.name} ({c.students?.length ?? 0} student{c.students?.length !== 1 ? 's' : ''})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {classFilter !== 'all' && (() => {
              const selectedClass = classes.find(c => String(c.id) === classFilter);
              if (!selectedClass) return null;
              return (
                <Button
                  variant="outline"
                  onClick={() => setClassToDelete(selectedClass)}
                  className="h-11 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 whitespace-nowrap"
                  title="Drop or delete this class if duplicated or not in use"
                >
                  <Trash2 size={16} className="mr-1.5" />
                  Drop Class
                </Button>
              );
            })()}

            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search student name..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
          </div>

          {/* Summary line */}
          <div className="flex items-center gap-4 text-sm flex-wrap" style={{ color: "var(--mid-gray)" }}>
            <span className="flex items-center gap-1"><Users size={14} /> {visibleRows.length} students</span>
            <span className="flex items-center gap-1" style={{ color: "var(--success-green)" }}>
              <CheckCircle2 size={14} /> {enrolledCount} enrolled in {enrollType}
            </span>
            <span style={{ color: "var(--warning-amber)" }}>{visibleRows.length - enrolledCount} not enrolled</span>
          </div>
        </CardContent>
      </Card>

      {/* Student list — slide-to-reveal waive */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-0">
          {/* header row */}
          <div className="flex items-center gap-3 px-4 py-3 text-white text-sm font-semibold rounded-t-lg"
            style={{ backgroundColor: "var(--navy-blue)" }}>
            <span className="w-8">#</span>
            <span className="flex-1">Name</span>
            <span className="w-20 hidden sm:block">Class</span>
            <span className="w-16 text-center hidden sm:block">Rank</span>
            <span className="w-40 text-right">Status</span>
          </div>

          {visibleRows.length === 0 ? (
            <div className="text-center py-12">
              <TypeIcon size={40} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
              <p style={{ color: "var(--mid-gray)" }}>No students found.</p>
            </div>
          ) : (
            visibleRows.map((r, index) => {
              const info = enrolled[r.id];
              const isEnrolled = !!info;
              const isEditing = editingStudentId === r.id;
              const draft = studentEdits[r.id] ?? {
                name: r.name,
                former_class: r.former_class ?? '',
                rank: r.rank != null ? String(r.rank) : '',
                marks_percentage: r.marks_percentage != null ? String(r.marks_percentage) : '',
              };
              return (
                <div key={r.id} className="group/row relative overflow-hidden border-b last:border-b-0"
                  style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3 px-4 py-3 transition-transform duration-200 group-hover/row:-translate-x-16"
                    style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#F9F9FB" }}>
                    <span className="w-8 text-sm" style={{ color: "var(--mid-gray)" }}>{index + 1}</span>
                    <span className="flex-1 font-medium" style={{ color: "var(--dark-gray)" }}>
                      {isEditing ? <Input value={draft.name} onChange={(e) => handleStudentEditChange(r.id, 'name', e.target.value)} className="h-9" /> : r.name}
                    </span>
                    <span className="w-24 hidden sm:block">
                      {isEditing ? (
                        <Input value={draft.former_class} onChange={(e) => handleStudentEditChange(r.id, 'former_class', e.target.value)} className="h-9" placeholder="Former class" />
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold text-white"
                          style={{ backgroundColor: "var(--navy-blue)" }}>{r.className}</span>
                      )}
                    </span>
                    <span className="w-16 text-center text-sm hidden sm:block" style={{ color: "var(--dark-gray)" }}>
                      {isEditing ? (
                        <Input type="number" min="0" step="1" value={draft.rank} onChange={(e) => handleStudentEditChange(r.id, 'rank', e.target.value)} className="h-9" />
                      ) : (r.rank ?? '—')}
                    </span>
                    <span className="w-24 text-center text-sm hidden lg:block" style={{ color: "var(--dark-gray)" }}>
                      {isEditing ? (
                        <Input type="number" min="0" max="100" step="0.01" value={draft.marks_percentage} onChange={(e) => handleStudentEditChange(r.id, 'marks_percentage', e.target.value)} className="h-9" />
                      ) : (r.marks_percentage != null ? `${r.marks_percentage}%` : '—')}
                    </span>
                    <span className="w-40 text-right">
                      {isEditing ? (
                        <Button variant="outline" size="sm" onClick={() => handleSaveStudent(r)} style={{ color: 'var(--navy-blue)', borderColor: 'var(--navy-blue)' }}>Save</Button>
                      ) : isEnrolled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: "color-mix(in srgb, var(--success-green) 13%, transparent)", color: "var(--success-green)" }}>
                          <CheckCircle2 size={12} /> Enrolled · exp {new Date(info.expiry_date).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: "var(--light-gray)", color: "var(--mid-gray)" }}>
                          Not enrolled
                        </span>
                      )}
                    </span>
                  </div>

                  <button
                    onClick={() => isEnrolled ? handleWaive(r.id, r.name) : undefined}
                    disabled={!isEnrolled}
                    title={isEnrolled ? `Waive ${r.name} from ${enrollType}` : 'Not enrolled'}
                    className="absolute top-0 right-0 h-full w-16 flex items-center justify-center translate-x-full transition-transform duration-200 group-hover/row:translate-x-0"
                    style={{ backgroundColor: isEnrolled ? "var(--danger-red)" : "var(--mid-gray)", color: "#FFFFFF" }}>
                    <Trash2 size={18} />
                  </button>
                  {!isEditing && (
                    <button
                      onClick={() => setEditingStudentId(r.id)}
                      className="absolute top-2 right-20 h-8 px-2 rounded text-xs font-medium border"
                      style={{ backgroundColor: '#fff', borderColor: 'var(--border)', color: 'var(--navy-blue)' }}>
                      Edit
                    </button>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-center" style={{ color: "var(--mid-gray)" }}>
        Tip: hover a student row to reveal the waive (remove) action.
      </p>

      {/* Enroll dialog */}
      <Dialog open={showEnroll} onOpenChange={setShowEnroll}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Import to {enrollType === 'feeding' ? 'Feeding' : 'Transport'}
            </DialogTitle>
            <DialogDescription>
              {notEnrolledIds.length} student{notEnrolledIds.length !== 1 ? 's' : ''} in the current view
              {classFilter === 'all' ? ` (${pLevelName} — all classes)` : ' (selected class)'} will be enrolled.
              Already-enrolled students are skipped.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {enrollType === 'transport' && (
              <div>
                <Label>Default Transport Zone <span style={{ color: "var(--mid-gray)" }}>(optional — can change per student later)</span></Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger className="w-full h-11 mt-2">
                    <SelectValue placeholder="No zone yet" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map(z => (
                      <SelectItem key={z.id} value={String(z.id)}>
                        {z.name} — {z.price.toLocaleString()} RWF
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--light-gray)" }}>
              <p className="text-sm" style={{ color: "var(--dark-gray)" }}>
                These students will be added to <strong>{enrollType === 'feeding' ? 'School Feeding' : 'Transport'}</strong>.
                Tick the monthly payment boxes afterwards in the {enrollType === 'feeding' ? 'Feeding' : 'Transport'} screen.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEnroll(false)}>Cancel</Button>
            <Button onClick={handleBulkEnroll}
              disabled={saving || notEnrolledIds.length === 0}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {notEnrolledIds.length} Student{notEnrolledIds.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Classes Dialog */}
      <Dialog open={showManageClasses} onOpenChange={setShowManageClasses}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle style={{ color: "var(--dark-gray)" }}>
              Manage Classes — {pLevelName}
            </DialogTitle>
            <DialogDescription>
              View classes in {pLevelName}. You can drop or delete duplicate or unused classes (must have 0 active students).
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-3 py-2">
            {classes.length === 0 ? (
              <p className="text-sm text-center py-6 text-gray-500">No classes found in {pLevelName}.</p>
            ) : (
              <div className="divide-y border rounded-lg overflow-hidden" style={{ borderColor: "var(--border)" }}>
                {classes.map((cls) => {
                  const studentCount = cls.students?.length ?? 0;
                  return (
                    <div key={cls.id} className="flex items-center justify-between p-3.5 hover:bg-black/[0.02] transition-colors">
                      <div>
                        <div className="font-semibold text-sm" style={{ color: "var(--dark-gray)" }}>
                          {cls.p_level?.name}{cls.name}
                        </div>
                        <div className="text-xs mt-0.5 text-gray-500">
                          {studentCount === 0 ? (
                            <span className="text-amber-600 font-medium">0 students (Not in use / Duplicate)</span>
                          ) : (
                            <span>{studentCount} student{studentCount > 1 ? 's' : ''}</span>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowManageClasses(false);
                          setClassToDelete(cls);
                        }}
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-9"
                        title={studentCount > 0 ? "Class must have 0 students to drop" : "Drop this class"}
                      >
                        <Trash2 size={15} className="mr-1.5" />
                        Drop Class
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManageClasses(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Drop Class Dialog */}
      <Dialog open={!!classToDelete} onOpenChange={(open) => !open && setClassToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-600" />
              <DialogTitle className="text-red-600">Drop Class</DialogTitle>
            </div>
            <DialogDescription>
              Are you sure you want to drop or delete class{" "}
              <strong className="text-gray-900">{classToDelete?.p_level?.name}{classToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>

          {classToDelete && (classToDelete.students?.length ?? 0) > 0 ? (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm">
              <p className="font-semibold">Cannot drop: Class has active students</p>
              <p className="mt-1 text-xs leading-relaxed">
                This class currently has {classToDelete.students.length} student{classToDelete.students.length > 1 ? 's' : ''}.
                To delete or drop this class, please reassign or remove all students first.
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-md bg-gray-50 border border-gray-200 text-gray-700 text-sm">
              <p className="font-medium">Class has 0 students</p>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                This will deactivate the class and remove it from active class lists. Use this to clean up duplicate classes or classes created in error.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClassToDelete(null)} disabled={deletingClass}>
              Cancel
            </Button>
            <Button
              onClick={() => classToDelete && handleDeleteClass(classToDelete)}
              disabled={deletingClass || !classToDelete || (classToDelete.students?.length ?? 0) > 0}
              style={{ backgroundColor: "var(--danger-red)", color: "#FFFFFF" }}
            >
              {deletingClass ? <Loader2 className="animate-spin h-4 w-4 mr-1.5" /> : <Trash2 size={16} className="mr-1.5" />}
              Confirm Drop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
