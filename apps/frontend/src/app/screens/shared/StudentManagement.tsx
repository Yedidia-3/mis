import {
  AlertCircle,
  ArrowRight,
  Bell,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { api, BASE_URL } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../../components/ui/hover-card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";

interface StudentRecord {
  id: number;
  student_id_number: string | null;
  name: string;
  academic_year_id: number;
  academic_year_name?: string;
  current_class_id: number | null;
  class_name?: string;
  p_level_id?: number | null;
  p_level_name?: string;
  former_class?: string | null;
  rank?: number | null;
  marks_percentage?: number | null;
  status: "active" | "repeating" | "promoted" | "transferred";
  is_imported?: boolean;
  approval_status?: "pending" | "approved" | "rejected";
  imported_at?: string;
  imported_by_user_id?: number | null;
  imported_by?: { id: number; name: string; email?: string; role?: string } | null;
  created_at: string;
  updated_at: string;
}

interface AcademicYear {
  id: number;
  name: string;
  status: string;
}

interface PLevel {
  id: number;
  name: string;
  academic_year_id: number;
  classes?: Array<{ id: number; name: string }>;
}

interface ClassItem {
  id: number;
  name: string;
  p_level_id: number;
}

interface ImportResponse {
  success: boolean;
  total_rows: number;
  new_count: number;
  updated_count: number;
  unchanged_count: number;
  new_students: Array<{ id: number; name: string; student_id_number: string | null }>;
  classes_affected: string[];
  p_levels_affected: string[];
  message: string;
  warnings?: string[];
}

export function StudentManagement() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data states
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>(searchParams.get("academic_year_id") ?? "");
  const [pLevels, setPLevels] = useState<PLevel[]>([]);
  const [selectedPLevelId, setSelectedPLevelId] = useState<string>("all");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modals
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<StudentRecord | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  // Form states
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [currentEditStudent, setCurrentEditStudent] = useState<StudentRecord | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    student_id_number: "",
    p_level_id: "",
    class_id: "",
    former_class: "",
    rank: "",
    marks_percentage: "",
    status: "active",
  });

  // Import states
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportResponse | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // 1. Load Academic Years
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await api.get<any>("/api/v1/academics/academic-years");
        const list: AcademicYear[] = Array.isArray(res) ? res : res.data ?? [];
        setAcademicYears(list);
        if (!selectedYearId && list.length > 0) {
          const active = list.find((y) => y.status === "active") ?? list[0];
          setSelectedYearId(String(active.id));
        }
      } catch (err) {
        toast.error("Failed to load academic years");
      }
    };
    fetchYears();
  }, []);

  // 2. Load P-Levels and Classes for Selected Year
  useEffect(() => {
    if (!selectedYearId) return;
    const fetchPLevelsAndClasses = async () => {
      try {
        const res = await api.get<any>(`/api/v1/academics/p-levels?academic_year_id=${selectedYearId}`);
        const plList: PLevel[] = Array.isArray(res) ? res : res.data ?? [];
        setPLevels(plList);

        // Flatten all classes
        const allClasses: ClassItem[] = [];
        plList.forEach((pl) => {
          if (pl.classes) {
            pl.classes.forEach((c) => {
              allClasses.push({ id: c.id, name: c.name, p_level_id: pl.id });
            });
          }
        });
        setClasses(allClasses);
      } catch {
        toast.error("Failed to load classes");
      }
    };
    fetchPLevelsAndClasses();
  }, [selectedYearId]);

  // 3. Load Students
  const loadStudents = useCallback(async () => {
    if (!selectedYearId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("academic_year_id", selectedYearId);
      if (selectedPLevelId !== "all") params.append("p_level_id", selectedPLevelId);
      if (selectedClassId !== "all") params.append("class_id", selectedClassId);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("limit", "1500");

      const res = await api.get<any>(`/api/v1/academics/students?${params.toString()}`);
      const list = res.data ?? res.students ?? (Array.isArray(res) ? res : []);
      setStudents(list);
      setTotalCount(res.total ?? list.length);
      setSelectedIds([]);
    } catch {
      toast.error("Failed to load student roster");
    } finally {
      setLoading(false);
    }
  }, [selectedYearId, selectedPLevelId, selectedClassId, statusFilter, searchQuery]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleApproveStudent = async (studentId: number) => {
    try {
      await api.post(`/api/v1/academics/students/${studentId}/approve`);
      toast.success("Student approved successfully");
      await loadStudents();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to approve student");
    }
  };

  const handleRejectStudent = async (studentId: number) => {
    try {
      await api.post(`/api/v1/academics/students/${studentId}/reject`);
      toast.success("Student rejected and removed");
      await loadStudents();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reject student");
    }
  };

  // Filter classes based on selected P-Level
  const filteredClasses = useMemo(() => {
    if (selectedPLevelId === "all") return classes;
    return classes.filter((c) => String(c.p_level_id) === selectedPLevelId);
  }, [classes, selectedPLevelId]);

  // Form helpers
  const handleOpenAdd = () => {
    setFormData({
      name: "",
      student_id_number: "",
      p_level_id: selectedPLevelId !== "all" ? selectedPLevelId : (pLevels[0]?.id?.toString() ?? ""),
      class_id: selectedClassId !== "all" ? selectedClassId : "",
      former_class: "",
      rank: "",
      marks_percentage: "",
      status: "active",
    });
    setAddOpen(true);
  };

  const handleOpenEdit = (student: StudentRecord) => {
    setCurrentEditStudent(student);
    setFormData({
      name: student.name,
      student_id_number: student.student_id_number ?? "",
      p_level_id: student.p_level_id ? String(student.p_level_id) : "",
      class_id: student.current_class_id ? String(student.current_class_id) : "",
      former_class: student.former_class ?? "",
      rank: student.rank !== null && student.rank !== undefined ? String(student.rank) : "",
      marks_percentage: student.marks_percentage !== null && student.marks_percentage !== undefined ? String(student.marks_percentage) : "",
      status: student.status,
    });
    setEditOpen(true);
  };

  const handleSaveStudent = async (isEdit: boolean) => {
    if (!formData.name.trim()) {
      toast.error("Student name is required");
      return;
    }
    setFormSubmitting(true);
    try {
      const payload: any = {
        name: formData.name.trim(),
        student_id_number: formData.student_id_number.trim() || null,
        academic_year_id: +selectedYearId,
        current_class_id: formData.class_id ? +formData.class_id : null,
        former_class: formData.former_class.trim() || null,
        rank: formData.rank ? +formData.rank : null,
        marks_percentage: formData.marks_percentage ? +formData.marks_percentage : null,
        status: formData.status,
      };

      if (isEdit && currentEditStudent) {
        await api.put(`/api/v1/academics/students/${currentEditStudent.id}`, payload);
        toast.success(`Updated student ${formData.name}`);
        setEditOpen(false);
      } else {
        await api.post("/api/v1/academics/students", payload);
        toast.success(`Registered new student ${formData.name}. Dean was notified.`);
        setAddOpen(false);
      }
      loadStudents();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save student record");
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDeleteSingle = async () => {
    if (!studentToDelete) return;
    try {
      await api.delete(`/api/v1/academics/students/${studentToDelete.id}`);
      toast.success(`Student ${studentToDelete.name} deleted`);
      setDeleteConfirmOpen(false);
      setStudentToDelete(null);
      loadStudents();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete student");
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    try {
      await api.post("/api/v1/academics/students/bulk-delete", { ids: selectedIds });
      toast.success(`Deleted ${selectedIds.length} student records`);
      setBulkDeleteConfirmOpen(false);
      setSelectedIds([]);
      loadStudents();
    } catch (err: any) {
      toast.error(err.message ?? "Bulk delete failed");
    }
  };

  // Import handler
  const handleUploadAndRun = async (dryRun: boolean) => {
    if (!importFile) {
      toast.error("Please choose a file to import (.xlsx, .xls, or .csv)");
      return;
    }
    setImportLoading(true);
    setImportError(null);
    try {
      const data = new FormData();
      data.append("file", importFile);

      const params = new URLSearchParams();
      if (selectedYearId) params.append("academic_year_id", selectedYearId);
      if (selectedPLevelId !== "all") params.append("p_level_id", selectedPLevelId);
      if (dryRun) params.append("dry_run", "true");

      const result = await api.upload<ImportResponse>(
        `/api/v1/academics/students/import?${params.toString()}`,
        data,
      );
      if (dryRun) {
        setImportPreview(result);
        toast.info("Preview ready. Review duplicates and comparison below.");
      } else {
        toast.success(result.message);
        setImportOpen(false);
        setImportFile(null);
        setImportPreview(null);
        loadStudents();
      }
    } catch (err: any) {
      setImportError(err.message ?? "Import failed");
    } finally {
      setImportLoading(false);
    }
  };

  // Export current list to CSV
  const handleExportCSV = () => {
    if (!students.length) {
      toast.error("No students to export");
      return;
    }
    const headers = ["Student ID", "Name", "Academic Year", "P-Level", "Class", "Former Class", "Rank", "Marks %", "Status"];
    const rows = students.map((s) => [
      s.student_id_number ?? "",
      `"${s.name.replace(/"/g, '""')}"`,
      s.academic_year_name ?? "",
      s.p_level_name ?? "",
      s.class_name ? `${s.p_level_name ?? ""} ${s.class_name}`.trim() : "",
      s.former_class ?? "",
      s.rank ?? "",
      s.marks_percentage ?? "",
      s.status,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Jericho_Students_${selectedYearId}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded student roster CSV");
  };

  // Selection toggles
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(students.map((s) => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--dark-gray)" }}>
              Student Directory & Import
            </h1>
            <Badge variant="outline" className="font-semibold text-xs border-amber-300 bg-amber-50 text-amber-800">
              Auto-Deduplication
            </Badge>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Import spreadsheets with duplicate checking, manage student records, and auto-notify Deans for new entrants.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-10 text-xs font-semibold gap-1.5"
            style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}
          >
            <Download size={15} /> Export
          </Button>

          <Button
            onClick={() => {
              setImportFile(null);
              setImportPreview(null);
              setImportError(null);
              setImportOpen(true);
            }}
            className="h-10 text-xs font-semibold gap-1.5 shadow-sm"
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
          >
            <Upload size={15} /> Import Excel / CSV
          </Button>

          <Button
            onClick={handleOpenAdd}
            className="h-10 text-xs font-semibold gap-1.5 shadow-sm"
            style={{ backgroundColor: "var(--navy-blue, #001F5B)", color: "#FFFFFF" }}
          >
            <Plus size={15} /> Add Student
          </Button>
        </div>
      </div>

      {/* Filters Card */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Academic Year */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Academic Year</Label>
              <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                <SelectTrigger className="h-9 mt-1 w-full text-xs">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map((ay) => (
                    <SelectItem key={ay.id} value={String(ay.id)}>
                      {ay.name} {ay.status === "active" ? "(Current)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* P-Level */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">P-Level</Label>
              <Select
                value={selectedPLevelId}
                onValueChange={(val) => {
                  setSelectedPLevelId(val);
                  setSelectedClassId("all");
                }}
              >
                <SelectTrigger className="h-9 mt-1 w-full text-xs">
                  <SelectValue placeholder="All P-Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All P-Levels</SelectItem>
                  {pLevels.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Class / Stream</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-9 mt-1 w-full text-xs">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {filteredClasses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 mt-1 w-full text-xs">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="repeating">Repeating</SelectItem>
                  <SelectItem value="promoted">Promoted</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground">Search</Label>
              <div className="relative mt-1">
                <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="ID or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                Total Loaded: <strong className="text-foreground">{totalCount}</strong>
              </span>
              <span>
                Filtered: <strong className="text-foreground">{students.length}</strong>
              </span>
              {selectedIds.length > 0 && (
                <span className="font-semibold text-primary">
                  {selectedIds.length} selected
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                  className="h-7 text-xs px-2.5 gap-1"
                >
                  <Trash2 size={13} /> Delete Selected ({selectedIds.length})
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadStudents}
                className="h-7 text-xs px-2 gap-1 text-muted-foreground"
              >
                <RefreshCw size={13} /> Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Students Table */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 size={32} className="animate-spin mx-auto text-muted-foreground mb-2" />
              <p className="text-xs text-muted-foreground">Loading student roster...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={40} className="mx-auto text-muted-foreground opacity-40 mb-3" />
              <h3 className="font-semibold text-base mb-1" style={{ color: "var(--dark-gray)" }}>
                No students found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
                No student records match the selected filters. You can upload an Excel/CSV sheet or add students manually.
              </p>
              <Button
                size="sm"
                onClick={() => setImportOpen(true)}
                style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
              >
                <Upload size={14} className="mr-1.5" /> Import Excel / CSV
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={selectedIds.length === students.length && students.length > 0}
                      onCheckedChange={(c) => handleSelectAll(!!c)}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Student ID</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Student Name</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Class / Level</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Academic Year</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Rank / Marks</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-center">Status</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const isChecked = selectedIds.includes(s.id);
                  return (
                    <TableRow key={s.id} className={isChecked ? "bg-amber-50/40" : undefined}>
                      <TableCell className="text-center">
                        <Checkbox checked={isChecked} onCheckedChange={() => handleToggleSelect(s.id)} />
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-700">
                        {s.student_id_number ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border text-slate-800">
                            {s.student_id_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-sm flex items-center gap-2 flex-wrap" style={{ color: "var(--dark-gray)" }}>
                          <span>{s.name}</span>
                          {s.approval_status === 'pending' && (
                            <Popover>
                              <HoverCard openDelay={150}>
                                <HoverCardTrigger asChild>
                                  <PopoverTrigger asChild>
                                    <span
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold cursor-pointer transition-all hover:scale-105 shadow-xs animate-pulse"
                                      style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FCD34D' }}
                                    >
                                      ⚠️ Imported!
                                    </span>
                                  </PopoverTrigger>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-72 p-3 border shadow-md rounded-xl bg-white text-left" align="start">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between border-b pb-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Imported Student</span>
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Pending Review</span>
                                    </div>
                                    <p className="text-xs font-bold text-gray-900">{s.name}</p>
                                    <p className="text-xs text-gray-600">
                                      <strong>Imported by:</strong> {s.imported_by?.name || 'Staff member'} ({s.imported_by?.role || 'Staff'})
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      <strong>Imported on:</strong> {s.imported_at ? new Date(s.imported_at).toLocaleString() : 'N/A'}
                                    </p>
                                    <p className="text-[11px] text-amber-700 italic pt-1">Click badge to Approve or Reject.</p>
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                              <PopoverContent className="w-80 p-4 border shadow-xl rounded-xl bg-white text-left" align="start">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Review Imported Student</span>
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">Pending</span>
                                  </div>
                                  <div className="text-xs space-y-1 text-gray-700">
                                    <p className="text-sm font-bold text-gray-900">{s.name}</p>
                                    {s.student_id_number && <p><span className="text-gray-500">Student ID:</span> {s.student_id_number}</p>}
                                    <p><span className="text-gray-500">Imported by:</span> <strong>{s.imported_by?.name || 'Staff member'}</strong> ({s.imported_by?.role || 'Staff'})</p>
                                    <p><span className="text-gray-500">Imported at:</span> {s.imported_at ? new Date(s.imported_at).toLocaleString() : 'N/A'}</p>
                                  </div>
                                  {(user?.role === 'dean' || user?.role === 'principal' || user?.role === 'super_admin') && (
                                    <div className="border-t pt-3 flex gap-2">
                                      <Button
                                        size="sm"
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 rounded-lg"
                                        onClick={() => handleApproveStudent(s.id)}
                                      >
                                        <CheckCircle2 size={14} className="mr-1" /> Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs h-9 rounded-lg"
                                        onClick={() => handleRejectStudent(s.id)}
                                      >
                                        <XCircle size={14} className="mr-1" /> Reject
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )}
                        </div>
                        {s.former_class && (
                          <span className="text-[11px] text-muted-foreground">
                            Former: {s.former_class}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.class_name ? (
                          <Badge variant="secondary" className="font-medium text-xs">
                            {s.p_level_name ? `${s.p_level_name} ` : ""}
                            {s.class_name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {s.academic_year_name ?? selectedYearId}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {s.rank ? (
                          <span className="font-semibold text-slate-800">#{s.rank}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {s.marks_percentage !== null && s.marks_percentage !== undefined && (
                          <span className="text-muted-foreground ml-1.5">({s.marks_percentage}%)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[11px] capitalize ${
                            s.status === "active"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : s.status === "repeating"
                              ? "border-amber-300 bg-amber-50 text-amber-800"
                              : s.status === "promoted"
                              ? "border-blue-300 bg-blue-50 text-blue-800"
                              : "border-red-300 bg-red-50 text-red-800"
                          }`}
                        >
                          {s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical size={15} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(s)}>
                              <Pencil size={14} className="mr-2 text-muted-foreground" /> Edit Student
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setStudentToDelete(s);
                                setDeleteConfirmOpen(true);
                              }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 size={14} className="mr-2" /> Delete Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── IMPORT MODAL ───────────────────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Upload size={20} className="text-primary" /> Import Students Spreadsheet
            </DialogTitle>
            <DialogDescription>
              Upload Excel (.xlsx, .xls) or CSV files. The system automatically compares student records by
              Student ID and Name to avoid duplicates and update classes accurately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Supported Formats Info Banner */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                <AlertCircle size={15} className="text-amber-700" /> Supported File Structures:
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-amber-900/90">
                <li><strong>Collective list:</strong> Single sheet with columns: <code>Student ID, Name, Academic Year, Class</code> (e.g. P1 A, P1 B, P1 C).</li>
                <li><strong>School-level multi-sheet:</strong> Sheets named <code>P1, P2, P3...</code> containing student class rosters.</li>
                <li><strong>P-level class sheets:</strong> Worksheets named <code>A, B, C</code> representing class streams.</li>
              </ul>
            </div>

            {/* Notification Badge Info */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 font-medium">
              <Bell size={15} className="text-blue-600 shrink-0" />
              <span><strong>Dean Notification:</strong> The Dean is automatically notified whenever any non-existing students are added.</span>
            </div>

            {/* File Dropzone */}
            <div
              onClick={() => document.getElementById("student-file-input")?.click()}
              className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors border-slate-300"
            >
              <input
                id="student-file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    setImportFile(e.target.files[0]);
                    setImportPreview(null);
                    setImportError(null);
                  }
                }}
                className="hidden"
              />
              {importFile ? (
                <div className="space-y-1">
                  <FileSpreadsheet size={36} className="mx-auto text-emerald-600 mb-1" />
                  <p className="font-semibold text-sm text-foreground">{importFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Upload size={36} className="mx-auto text-slate-400 mb-1" />
                  <p className="font-semibold text-sm text-foreground">Click to browse or drag and drop spreadsheet</p>
                  <p className="text-xs text-muted-foreground">Accepts .xlsx, .xls, and .csv files</p>
                </div>
              )}
            </div>

            {/* Errors */}
            {importError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <XCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <strong>Import Error:</strong> {importError}
                </div>
              </div>
            )}

            {/* Dry Run Preview Summary */}
            {importPreview && (
              <div className="p-4 rounded-xl border bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Comparison Preview</span>
                  <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300">
                    Zero Duplicates
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg bg-white border">
                    <div className="text-xl font-bold text-emerald-700">+{importPreview.new_count}</div>
                    <div className="text-[11px] font-medium text-muted-foreground">New Students</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border">
                    <div className="text-xl font-bold text-blue-700">{importPreview.updated_count}</div>
                    <div className="text-[11px] font-medium text-muted-foreground">Updated / Reassigned</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white border">
                    <div className="text-xl font-bold text-slate-700">{importPreview.unchanged_count}</div>
                    <div className="text-[11px] font-medium text-muted-foreground">Already Current</div>
                  </div>
                </div>

                {importPreview.classes_affected.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <strong>Target Classes:</strong> {importPreview.classes_affected.join(", ")}
                  </div>
                )}

                {importPreview.new_students.length > 0 && (
                  <div className="max-h-28 overflow-y-auto border rounded bg-white p-2 text-xs space-y-1">
                    <span className="font-semibold text-slate-800">New students to be added ({importPreview.new_students.length}):</span>
                    <div className="text-muted-foreground">
                      {importPreview.new_students.map((s, i) => (
                        <span key={i} className="inline-block mr-2">
                          • {s.name} {s.student_id_number ? `(${s.student_id_number})` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setImportOpen(false)} disabled={importLoading}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleUploadAndRun(true)}
                disabled={!importFile || importLoading}
                className="text-xs font-semibold"
              >
                {importLoading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                Preview & Compare
              </Button>
              <Button
                onClick={() => handleUploadAndRun(false)}
                disabled={!importFile || importLoading}
                style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
                className="text-xs font-semibold shadow-sm"
              >
                {importLoading ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                Confirm & Import
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ADD / EDIT STUDENT MODAL ─────────────────────────────────────────────────── */}
      <Dialog
        open={addOpen || editOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddOpen(false);
            setEditOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {editOpen ? "Edit Student Record" : "Register New Student"}
            </DialogTitle>
            <DialogDescription>
              {editOpen
                ? "Update student identifiers, class stream, or academic information."
                : "Add a single student directly to the database roster."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            <div>
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                placeholder="e.g. ATETE Gianna Briella"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Student ID / Registration No.</Label>
              <Input
                placeholder="e.g. 20232412464"
                value={formData.student_id_number}
                onChange={(e) => setFormData({ ...formData, student_id_number: e.target.value })}
                className="h-9 mt-1 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">P-Level</Label>
                <Select
                  value={formData.p_level_id}
                  onValueChange={(val) => setFormData({ ...formData, p_level_id: val, class_id: "" })}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {pLevels.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Class / Stream</Label>
                <Select
                  value={formData.class_id}
                  onValueChange={(val) => setFormData({ ...formData, class_id: val })}
                >
                  <SelectTrigger className="h-9 mt-1 text-xs">
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes
                      .filter((c) => !formData.p_level_id || String(c.p_level_id) === formData.p_level_id)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-semibold">Former Class</Label>
                <Input
                  placeholder="e.g. NUR-A"
                  value={formData.former_class}
                  onChange={(e) => setFormData({ ...formData, former_class: e.target.value })}
                  className="h-9 mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Rank</Label>
                <Input
                  type="number"
                  placeholder="e.g. 1"
                  value={formData.rank}
                  onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  className="h-9 mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Marks %</Label>
                <Input
                  type="number"
                  placeholder="e.g. 95"
                  value={formData.marks_percentage}
                  onChange={(e) => setFormData({ ...formData, marks_percentage: e.target.value })}
                  className="h-9 mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Enrolment Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({ ...formData, status: val })}
              >
                <SelectTrigger className="h-9 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="repeating">Repeating</SelectItem>
                  <SelectItem value="promoted">Promoted</SelectItem>
                  <SelectItem value="transferred">Transferred</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setAddOpen(false);
                setEditOpen(false);
              }}
              disabled={formSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSaveStudent(editOpen)}
              disabled={formSubmitting}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
              className="text-xs font-semibold"
            >
              {formSubmitting ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
              {editOpen ? "Save Changes" : "Register Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE SINGLE CONFIRMATION ────────────────────────────────────────────── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student Record?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{studentToDelete?.name}</strong>? This action will remove
              the student and their associated records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSingle} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── BULK DELETE CONFIRMATION ──────────────────────────────────────────────── */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} Student Records?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {selectedIds.length} selected students? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete All Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
