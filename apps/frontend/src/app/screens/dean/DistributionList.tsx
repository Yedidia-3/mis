import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Share2, Clock, CheckCircle2, AlertTriangle, Loader2,
  Users, UserCheck, RefreshCw, Send, Download, FileText
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { api, BASE_URL } from "../../../lib/api";
import { toast } from "sonner";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";

interface TeacherStaff {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface ClassDistributionItem {
  id: number;
  name: string;
  p_level_id: number;
  p_level_name: string;
  academic_year_id: number;
  academic_year_name: string;
  teacher_id: number | null;
  teacher: { id: number; name: string; email: string } | null;
  distributed_at: string | null;
  student_count: number;
  pending_imported_count: number;
  approved_student_count: number;
  status: "pending_approval" | "ready" | "distributed";
}

interface SummaryData {
  academic_year: { id: number; name: string; status: string };
  classes: ClassDistributionItem[];
}

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function DistributionList() {
  const navigate = useNavigate();
  const [data, setData] = useState<SummaryData | null>(null);
  const [teachers, setTeachers] = useState<TeacherStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [distributingClassId, setDistributingClassId] = useState<number | null>(null);
  const [distributingPLevelId, setDistributingPLevelId] = useState<number | null>(null);
  const [selectedTeachers, setSelectedTeachers] = useState<Record<number, number | null>>({});

  const load = useCallback(async () => {
    try {
      const [summaryRes, staffRes] = await Promise.all([
        api.get<SummaryData>('/api/v1/academics/distribution/summary'),
        api.get<any>('/api/v1/admin/staff?role=teacher').catch(() => []),
      ]);

      const summary = summaryRes as SummaryData;
      setData(summary);

      const staffList: TeacherStaff[] = Array.isArray(staffRes) ? staffRes : staffRes?.data ?? [];
      setTeachers(staffList);

      // Pre-fill selected teachers from class teacher_id
      const teacherMap: Record<number, number | null> = {};
      (summary.classes ?? []).forEach(c => {
        teacherMap[c.id] = c.teacher_id;
      });
      setSelectedTeachers(teacherMap);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load distribution data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const classes = data?.classes ?? [];

  // Group classes by P-Level
  const pLevelGroups = classes.reduce((acc, c) => {
    if (!acc[c.p_level_name]) {
      acc[c.p_level_name] = {
        p_level_id: c.p_level_id,
        p_level_name: c.p_level_name,
        classes: [],
      };
    }
    acc[c.p_level_name].classes.push(c);
    return acc;
  }, {} as Record<string, { p_level_id: number; p_level_name: string; classes: ClassDistributionItem[] }>);

  // Group stats
  const totalClasses = classes.length;
  const pendingClasses = classes.filter(c => c.status === 'pending_approval').length;
  const readyClasses = classes.filter(c => c.status === 'ready').length;
  const distributedClasses = classes.filter(c => c.status === 'distributed').length;

  const handleTeacherChange = (classId: number, teacherIdStr: string) => {
    const tid = teacherIdStr === 'none' ? null : Number(teacherIdStr);
    setSelectedTeachers(prev => ({ ...prev, [classId]: tid }));
  };

  const handleDistributeClass = async (cls: ClassDistributionItem) => {
    if (cls.pending_imported_count > 0) {
      toast.error(`Cannot distribute ${cls.p_level_name} ${cls.name}: ${cls.pending_imported_count} imported student(s) pending approval.`);
      return;
    }

    setDistributingClassId(cls.id);
    try {
      const teacherId = selectedTeachers[cls.id] ?? undefined;
      const res = await api.post<any>('/api/v1/academics/distribution/distribute-class', {
        class_id: cls.id,
        teacher_id: teacherId,
      });
      toast.success(res.message || `Class ${cls.p_level_name} ${cls.name} distributed successfully!`);
      load();
    } catch (err: any) {
      toast.error(err.message || 'Failed to distribute class');
    } finally {
      setDistributingClassId(null);
    }
  };

  const handleDistributePLevel = async (pLevelId: number, pLevelName: string, levelClasses: ClassDistributionItem[]) => {
    const unapproved = levelClasses.filter(c => c.pending_imported_count > 0);
    if (unapproved.length > 0) {
      toast.error(`Cannot distribute ${pLevelName}: some classes have unapproved imported students.`);
      return;
    }

    setDistributingPLevelId(pLevelId);
    try {
      const teacherAssignments = levelClasses
        .map(c => ({
          class_id: c.id,
          teacher_id: selectedTeachers[c.id],
        }))
        .filter((ta): ta is { class_id: number; teacher_id: number } => !!ta.teacher_id);

      const res = await api.post<any>('/api/v1/academics/distribution/distribute-plevel', {
        p_level_id: pLevelId,
        teacher_assignments: teacherAssignments,
      });
      toast.success(res.message || `All classes in ${pLevelName} distributed successfully!`);
      load();
    } catch (err: any) {
      toast.error(err.message || `Failed to distribute ${pLevelName}`);
    } finally {
      setDistributingPLevelId(null);
    }
  };

  const handleExportClass = (classId: number, format: 'xlsx' | 'docx') => {
    const token = localStorage.getItem('token');
    const url = `${BASE_URL}/api/v1/academics/classes/${classId}/export?format=${format}`;
    window.open(`${url}&token=${token}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
              Active Class Distribution
            </h1>
            {data?.academic_year && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: "var(--maroon)" }}>
                Academic Year {data.academic_year.name}
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Assign teachers, confirm approved rosters, and distribute active classes to Teachers and Accountants.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="flex items-center gap-2">
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Total Classes</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>
                  {loading ? "—" : totalClasses}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                <Users size={20} className="text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Pending Approval</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "var(--warning-amber)" }}>
                  {loading ? "—" : pendingClasses}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FEF3E8" }}>
                <Clock size={20} style={{ color: "var(--warning-amber)" }} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Ready to Distribute</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "var(--navy-blue)" }}>
                  {loading ? "—" : readyClasses}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50">
                <Share2 size={20} className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Active / Distributed</p>
                <p className="text-3xl font-bold mt-1" style={{ color: "var(--success-green)" }}>
                  {loading ? "—" : distributedClasses}
                </p>
              </div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#F0FDF4" }}>
                <CheckCircle2 size={20} style={{ color: "var(--success-green)" }} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main List grouped by P-Level */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
        </div>
      ) : Object.keys(pLevelGroups).length === 0 ? (
        <div className="text-center py-16 border rounded-lg" style={{ borderColor: "var(--border)" }}>
          <Share2 size={48} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No classes found</p>
          <p className="text-sm mt-2 mb-4" style={{ color: "var(--mid-gray)" }}>
            Please ensure an active academic year exists and classes are configured under P-Levels.
          </p>
          <Button onClick={() => navigate('/dean/p-levels')} style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            Go to P-Levels Management
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.values(pLevelGroups).map(group => {
            const levelClasses = group.classes;
            const totalStudents = levelClasses.reduce((sum, c) => sum + c.student_count, 0);
            const hasPending = levelClasses.some(c => c.pending_imported_count > 0);
            const isDistributingThisLevel = distributingPLevelId === group.p_level_id;

            return (
              <div key={group.p_level_name} className="space-y-4">
                {/* P-Level Group Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-gray-200 gap-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold" style={{ color: "var(--navy-blue)" }}>
                      {group.p_level_name}
                    </h2>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-700">
                      {levelClasses.length} class{levelClasses.length !== 1 ? 'es' : ''} · {totalStudents} student{totalStudents !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      disabled={hasPending || isDistributingThisLevel}
                      onClick={() => handleDistributePLevel(group.p_level_id, group.p_level_name, levelClasses)}
                      style={{
                        backgroundColor: hasPending ? undefined : "var(--maroon)",
                        color: "#FFFFFF"
                      }}
                    >
                      {isDistributingThisLevel ? (
                        <>
                          <Loader2 size={14} className="animate-spin mr-1.5" /> Distributing...
                        </>
                      ) : (
                        <>
                          <Send size={14} className="mr-1.5" /> Distribute All {group.p_level_name}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Class cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {levelClasses.map(cls => {
                    const isPending = cls.pending_imported_count > 0;
                    const isDistributed = !!cls.distributed_at && !isPending;
                    const isSavingThisClass = distributingClassId === cls.id;
                    const currentTeacherId = selectedTeachers[cls.id];

                    return (
                      <Card
                        key={cls.id}
                        className="transition-all hover:shadow-md"
                        style={{
                          borderColor: isPending ? "var(--warning-amber)" : isDistributed ? "var(--success-green)" : "var(--border)",
                          backgroundColor: isPending ? "#FFFDF5" : "#FFFFFF"
                        }}
                      >
                        <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between space-y-0">
                          <div>
                            <CardTitle className="text-lg font-bold" style={{ color: "var(--dark-gray)" }}>
                              {cls.p_level_name} {cls.name}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Class ID #{cls.id}
                            </p>
                          </div>

                          {/* Status Badge */}
                          {isPending ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                              style={{ backgroundColor: "#FEF3E8", color: "var(--warning-amber)" }}>
                              <AlertTriangle size={13} />
                              Pending ({cls.pending_imported_count})
                            </span>
                          ) : isDistributed ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
                              style={{ backgroundColor: "#F0FDF4", color: "var(--success-green)" }}>
                              <CheckCircle2 size={13} />
                              Distributed
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-blue-50 text-blue-700">
                              <Share2 size={13} />
                              Ready
                            </span>
                          )}
                        </CardHeader>

                        <CardContent className="px-5 pb-4 space-y-4">
                          {/* Student stats */}
                          <div className="flex items-center justify-between text-sm py-2 px-3 bg-gray-50 rounded-md border border-gray-100">
                            <span className="text-gray-600 flex items-center gap-1.5">
                              <Users size={15} /> Total Students:
                            </span>
                            <span className="font-bold text-gray-800">
                              {cls.student_count}
                            </span>
                          </div>

                          {/* Teacher Selection */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                              <UserCheck size={14} /> Assigned Class Teacher
                            </label>
                            <Select
                              value={currentTeacherId ? String(currentTeacherId) : "none"}
                              onValueChange={(val) => handleTeacherChange(cls.id, val)}
                            >
                              <SelectTrigger className="w-full text-sm bg-white">
                                <SelectValue placeholder="Select Teacher..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">-- Unassigned --</SelectItem>
                                {teachers.map(t => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.name} ({t.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Warning Banner if pending unapproved students */}
                          {isPending && (
                            <div className="p-2.5 rounded text-xs bg-amber-50 text-amber-800 border border-amber-200 space-y-2">
                              <p className="font-medium flex items-center gap-1">
                                <AlertTriangle size={13} /> {cls.pending_imported_count} imported student(s) waiting for Dean approval.
                              </p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full h-7 text-xs border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                                onClick={() => navigate(`/dean/class/${cls.id}`)}
                              >
                                Review & Approve in Class Management
                              </Button>
                            </div>
                          )}

                          {/* Distribution Info & Date */}
                          {isDistributed && cls.distributed_at && (
                            <p className="text-xs text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 size={12} /> Distributed on {fmtDate(cls.distributed_at)}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="pt-2 flex items-center gap-2">
                            <Button
                              className="flex-1 text-xs"
                              size="sm"
                              disabled={isPending || isSavingThisClass}
                              onClick={() => handleDistributeClass(cls)}
                              style={{
                                backgroundColor: isPending ? undefined : "var(--maroon)",
                                color: "#FFFFFF"
                              }}
                            >
                              {isSavingThisClass ? (
                                <>
                                  <Loader2 size={13} className="animate-spin mr-1" /> Saving...
                                </>
                              ) : isDistributed ? (
                                <>
                                  <RefreshCw size={13} className="mr-1" /> Re-Distribute
                                </>
                              ) : (
                                <>
                                  <Send size={13} className="mr-1" /> Distribute Class
                                </>
                              )}
                            </Button>

                            <DropdownMenuExport onExport={(fmt) => handleExportClass(cls.id, fmt)} />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DropdownMenuExport({ onExport }: { onExport: (fmt: 'xlsx' | 'docx') => void }) {
  return (
    <div className="relative group">
      <Button variant="outline" size="sm" className="px-2.5 text-xs text-gray-700">
        <Download size={13} />
      </Button>
      <div className="absolute right-0 bottom-full mb-1 hidden group-hover:flex flex-col bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[120px] py-1">
        <button
          onClick={() => onExport('xlsx')}
          className="px-3 py-1.5 text-xs text-left hover:bg-gray-100 flex items-center gap-2 text-gray-700"
        >
          <FileText size={13} className="text-green-600" /> Excel (.xlsx)
        </button>
        <button
          onClick={() => onExport('docx')}
          className="px-3 py-1.5 text-xs text-left hover:bg-gray-100 flex items-center gap-2 text-gray-700"
        >
          <FileText size={13} className="text-blue-600" /> Word (.docx)
        </button>
      </div>
    </div>
  );
}
