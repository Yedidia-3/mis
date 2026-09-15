import { ArrowLeft, ArrowLeftRight, Loader2, MoreVertical, Plus, Search, Upload, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";
import { ExportClassListDialog } from "../../components/ExportClassListDialog";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

interface ClassData {
  id: number;
  name: string;
  teacher_id: number | null;
  teacher: { id: number; name: string } | null;
  students?: any[];
  student_count?: number;
  status: string;
}

interface PLevel {
  id: number;
  name: string;
  academic_year_id: number;
}

interface StaffUser {
  id: number;
  name: string;
  role: string;
}

export function ClassManagement() {
  const { pLevelId } = useParams<{ pLevelId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isPrincipal = user?.role === "principal";
  const routePrefix = isPrincipal ? "/principal" : "/dean";

  const [pLevel, setPLevel] = useState<PLevel | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [newClassName, setNewClassName] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [manualStudentNames, setManualStudentNames] = useState("");
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [classViewMode, setClassViewMode] = useState<'view' | 'update'>('view');
  const [studentEdits, setStudentEdits] = useState<Record<number, { name: string; former_class: string; rank: string; marks_percentage: string }>>({});

  const load = useCallback(async () => {
    if (!pLevelId) return;
    try {
      const [pl, cls, staff] = await Promise.all([
        api.get<any>(`/api/v1/academics/p-levels/${pLevelId}`),
        api.get<any>(`/api/v1/academics/p-levels/${pLevelId}/classes`),
        api.get<any>('/api/v1/admin/staff?role=teacher'),
      ]);
      setPLevel(pl);
      setClasses(Array.isArray(cls) ? cls : cls.data ?? []);
      setTeachers(Array.isArray(staff) ? staff : staff.data ?? []);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, [pLevelId]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const handleAddClass = async () => {
    if (!newClassName.trim() || !pLevelId) return;
    setSaving(true);
    try {
      await api.post('/api/v1/academics/classes', { name: newClassName.trim(), p_level_id: +pLevelId });
      toast.success(`Class ${newClassName} created`);
      setShowAddDialog(false);
      setNewClassName("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create class');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!selectedClass) return;
    setSaving(true);
    try {
      await api.delete(`/api/v1/academics/classes/${selectedClass.id}`);
      toast.success(`Class ${selectedClass.name} removed`);
      setShowDeleteDialog(false);
      setSelectedClass(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete class');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedClass || !selectedTeacherId) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/academics/classes/${selectedClass.id}/assign-teacher`, { teacher_id: +selectedTeacherId });
      toast.success(`Teacher assigned to ${selectedClass.name}`);
      setShowAssignDialog(false);
      setSelectedTeacherId("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to assign teacher');
    } finally {
      setSaving(false);
    }
  };

  const buildStudentEditState = (student: any) => ({
    name: student?.name ?? '',
    former_class: student?.former_class ?? '',
    rank: student?.rank != null ? String(student.rank) : '',
    marks_percentage: student?.marks_percentage != null ? String(student.marks_percentage) : '',
  });

  const loadClassStudents = useCallback(async (classId: number) => {
    setStudentsLoading(true);
    try {
      const res = await api.get<any>(`/api/v1/academics/classes/${classId}/students`);
      const nextStudents = Array.isArray(res) ? res : res.data ?? [];
      setClassStudents(nextStudents);
      setStudentEdits(
        Object.fromEntries(nextStudents.map((student) => [student.id, buildStudentEditState(student)])),
      );
    } catch {
      toast.error('Failed to load class list');
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  const handleStudentEditChange = (studentId: number, field: 'name' | 'former_class' | 'rank' | 'marks_percentage', value: string) => {
    setStudentEdits((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? buildStudentEditState(classStudents.find((student) => student.id === studentId) ?? {})),
        [field]: value,
      },
    }));
  };

  const handleSaveStudent = async (student: any) => {
    const draft = studentEdits[student.id] ?? buildStudentEditState(student);
    const payload: any = {
      name: draft.name.trim(),
      former_class: draft.former_class.trim() || null,
      rank: draft.rank === '' ? null : Number(draft.rank),
      marks_percentage: draft.marks_percentage === '' ? null : Number(draft.marks_percentage),
    };

    if (!payload.name) {
      toast.error('Student name is required');
      return;
    }

    if (payload.rank !== null && (!Number.isFinite(payload.rank) || payload.rank < 0)) {
      toast.error('Rank must be a non-negative number');
      return;
    }

    if (payload.marks_percentage !== null && (!Number.isFinite(payload.marks_percentage) || payload.marks_percentage < 0 || payload.marks_percentage > 100)) {
      toast.error('Marks must be between 0 and 100');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/api/v1/academics/students/${student.id}`, payload);
      toast.success(`${student.name} updated`);
      await loadClassStudents(selectedClass!.id);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update student');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudentsToClass = async () => {
    if (!selectedClass) return;
    const names = manualStudentNames
      .split(/[\n,]+/)
      .map((name) => name.trim())
      .filter(Boolean);

    if (!names.length) {
      toast.error('Enter at least one student name');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/api/v1/academics/classes/${selectedClass.id}/students`, { students: names.map((name) => ({ name })) });
      toast.success(`Added ${names.length} student${names.length > 1 ? 's' : ''} to ${selectedClass.name}`);
      setManualStudentNames('');
      await Promise.all([load(), loadClassStudents(selectedClass.id)]);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to add students');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveStudent = async () => {
    if (!selectedStudent || !targetClassId) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/academics/students/${selectedStudent.id}/move`, { new_class_id: +targetClassId });
      toast.success(`${selectedStudent.name} moved successfully`);
      setShowMoveDialog(false);
      setSelectedStudent(null);
      setTargetClassId('');
      await Promise.all([load(), loadClassStudents(selectedClass.id)]);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to move student');
    } finally {
      setSaving(false);
    }
  };

  const openMoveDialog = (student: any) => {
    setSelectedStudent(student);
    setTargetClassId('');
    setShowMoveDialog(true);
  };

  const otherClasses = classes.filter((classItem) => classItem.id !== selectedClass?.id);
  const filteredStudents = classStudents.filter((student) =>
    student.name.toLowerCase().includes(studentSearch.toLowerCase()),
  );

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin" size={36} style={{ color: "var(--navy-blue)" }} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(`${routePrefix}/p-levels`)} style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back to P-Levels
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
            {pLevel?.name ?? `P-Level ${pLevelId}`} — Classes
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            {classes.length} class{classes.length !== 1 ? 'es' : ''}
          </p>
        </div>
        {!isPrincipal && (
          <div className="flex gap-2">
            <Button onClick={() => navigate(`/dean/import`)} variant="outline" className="h-11"
              style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
              <Upload size={18} className="mr-2" /> Import Excel
            </Button>
            <Button onClick={() => setShowAddDialog(true)} className="h-11"
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              <Plus size={18} className="mr-2" /> Create Class List
            </Button>
          </div>
        )}
      </div>

      {selectedClass && (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-6 space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-wide" style={{ color: "var(--mid-gray)" }}>Class list</p>
                <h2 className="text-2xl font-bold" style={{ color: "var(--dark-gray)" }}>{pLevel?.name}{selectedClass.name}</h2>
              </div>
              {!isPrincipal && (
                <div className="flex flex-wrap gap-2">
                  <Button variant={classViewMode === 'view' ? 'default' : 'outline'} onClick={() => setClassViewMode('view')} style={classViewMode === 'view' ? { backgroundColor: 'var(--maroon)', color: '#fff' } : { color: 'var(--maroon)', borderColor: 'var(--maroon)' }}>
                    View Class List
                  </Button>
                  <Button variant={classViewMode === 'update' ? 'default' : 'outline'} onClick={() => { setClassViewMode('update'); if (!classStudents.length) loadClassStudents(selectedClass.id); }} style={classViewMode === 'update' ? { backgroundColor: 'var(--navy-blue)', color: '#fff' } : { color: 'var(--navy-blue)', borderColor: 'var(--navy-blue)' }}>
                    Update Class List
                  </Button>
                </div>
              )}
            </div>

            {!isPrincipal && classViewMode === 'update' && (
              <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--light-gray)' }}>
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="flex-1">
                    <Label>Add students to this class</Label>
                    <Input
                      className="mt-2 h-11"
                      placeholder="Type names, one per line or separated by commas"
                      value={manualStudentNames}
                      onChange={(e) => setManualStudentNames(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddStudentsToClass(); } }}
                    />
                  </div>
                  <Button onClick={handleAddStudentsToClass} disabled={saving || !manualStudentNames.trim()} style={{ backgroundColor: 'var(--maroon)', color: '#fff' }}>
                    Add Students
                  </Button>
                </div>
              </div>
            )}

            <div className="mb-4 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--mid-gray)' }} />
              <Input placeholder="Search student name..." value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="pl-10 h-11" />
            </div>

            {studentsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={24} style={{ color: 'var(--navy-blue)' }} /></div>
            ) : (
              <div className="border rounded-lg overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
                <Table>
                  <TableHeader style={{ backgroundColor: 'var(--navy-blue)' }}>
                    <TableRow>
                      <TableHead className="text-white w-10">#</TableHead>
                      <TableHead className="text-white">Name</TableHead>
                      <TableHead className="text-white">Former Class</TableHead>
                      <TableHead className="text-white">Rank</TableHead>
                      <TableHead className="text-white">Marks %</TableHead>
                      {!isPrincipal && <TableHead className="text-white text-right">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isPrincipal ? 5 : 6} className="text-center py-8" style={{ color: 'var(--mid-gray)' }}>
                          No students in this class
                        </TableCell>
                      </TableRow>
                    ) : filteredStudents.map((student, index) => {
                      const draft = studentEdits[student.id] ?? buildStudentEditState(student);
                      return (
                        <TableRow key={student.id} style={{ backgroundColor: index % 2 === 0 ? '#FFFFFF' : 'var(--light-gray)' }}>
                          <TableCell className="text-sm" style={{ color: 'var(--mid-gray)' }}>{index + 1}</TableCell>
                          {!isPrincipal && classViewMode === 'update' ? (
                            <>
                              <TableCell className="font-medium" style={{ color: 'var(--dark-gray)' }}>
                                <Input value={draft.name} onChange={(e) => handleStudentEditChange(student.id, 'name', e.target.value)} className="h-9" />
                              </TableCell>
                              <TableCell>
                                <Input value={draft.former_class} onChange={(e) => handleStudentEditChange(student.id, 'former_class', e.target.value)} className="h-9" placeholder="Former class" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" min="0" step="1" value={draft.rank} onChange={(e) => handleStudentEditChange(student.id, 'rank', e.target.value)} className="h-9" />
                              </TableCell>
                              <TableCell>
                                <Input type="number" min="0" max="100" step="0.01" value={draft.marks_percentage} onChange={(e) => handleStudentEditChange(student.id, 'marks_percentage', e.target.value)} className="h-9" />
                              </TableCell>
                              <TableCell className="text-right space-x-2">
                                <Button variant="outline" size="sm" onClick={() => handleSaveStudent(student)} disabled={saving} style={{ color: 'var(--navy-blue)', borderColor: 'var(--navy-blue)' }}>
                                   Save
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => openMoveDialog(student)} style={{ color: 'var(--maroon)' }}>
                                  <ArrowLeftRight size={16} className="mr-1" /> Move
                                </Button>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-medium" style={{ color: 'var(--dark-gray)' }}>{student.name}</TableCell>
                              <TableCell style={{ color: 'var(--dark-gray)' }}>{student.former_class ?? '—'}</TableCell>
                              <TableCell style={{ color: 'var(--dark-gray)' }}>{student.rank ?? '—'}</TableCell>
                              <TableCell style={{ color: 'var(--dark-gray)' }}>{student.marks_percentage != null ? `${student.marks_percentage}%` : '—'}</TableCell>
                              {!isPrincipal && (
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" onClick={() => openMoveDialog(student)} style={{ color: 'var(--maroon)' }}>
                                    <ArrowLeftRight size={16} className="mr-1" /> Move
                                  </Button>
                                </TableCell>
                              )}
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {classes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No classes yet</p>
          <p className="text-sm mt-2 mb-4" style={{ color: "var(--mid-gray)" }}>
            {isPrincipal ? `No classes have been added for ${pLevel?.name ?? 'this P-Level'} yet.` : `Add the first class for ${pLevel?.name}.`}
          </p>
          {!isPrincipal && (
            <Button onClick={() => setShowAddDialog(true)} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              <Plus size={18} className="mr-2" /> Add Class
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((classItem) => {
            const studentCount = classItem.student_count ?? classItem.students?.length ?? 0;
            return (
              <Card key={classItem.id} style={{ borderColor: "var(--border)" }}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold" style={{ color: "var(--dark-gray)" }}>{pLevel?.name}{classItem.name}</h3>
                    </div>
                    {!isPrincipal && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreVertical size={18} /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedClass(classItem); setClassViewMode('view'); void loadClassStudents(classItem.id); }}>
                            View Class List
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedClass(classItem); setClassViewMode('update'); void loadClassStudents(classItem.id); }}>
                            Update Class List
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedClass(classItem); setShowExportDialog(true); }}>
                            Download Class List
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600"
                            onClick={() => { setSelectedClass(classItem); setShowDeleteDialog(true); }}>
                            Delete Class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm mb-1" style={{ color: "var(--mid-gray)" }}>Assigned Teacher</p>
                      {classItem.teacher ? (
                        <p className="font-medium" style={{ color: "var(--dark-gray)" }}>{classItem.teacher.name}</p>
                      ) : (
                        <p className="italic" style={{ color: "var(--mid-gray)" }}>Unassigned</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 13%, transparent)" }}>
                        <Users size={20} style={{ color: "var(--maroon)" }} />
                      </div>
                      <div>
                        <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Students</p>
                        <p className="text-xl font-bold" style={{ color: "var(--dark-gray)" }}>{studentCount}</p>
                      </div>
                    </div>
                  </div>

                  {isPrincipal ? (
                    <Button onClick={() => { setSelectedClass(classItem); setClassViewMode('view'); void loadClassStudents(classItem.id); }}
                      className="w-full mt-6" variant="outline"
                      style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
                      View Class List
                    </Button>
                  ) : (
                    <div className="mt-6 grid grid-cols-2 gap-2">
                      <Button onClick={() => { setSelectedClass(classItem); setClassViewMode('view'); void loadClassStudents(classItem.id); }}
                        className="w-full" variant="outline"
                        style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
                        View
                      </Button>
                      <Button onClick={() => { setSelectedClass(classItem); setClassViewMode('update'); void loadClassStudents(classItem.id); }}
                        className="w-full" variant="outline"
                        style={{ color: "var(--navy-blue)", borderColor: "var(--navy-blue)" }}>
                        Update
                      </Button>
                    </div>
                  )}
                  <Button onClick={() => { setSelectedClass(classItem); setShowExportDialog(true); }}
                    className="w-full mt-3" variant="outline"
                    style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
                    Download Class List
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Class Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>Create a new class for {pLevel?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Class Letter</Label>
              <Input className="mt-2 h-11" placeholder={`e.g., A`} value={newClassName}
                onChange={e => setNewClassName(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleAddClass()} />
              {newClassName && <p className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>Will be named: {pLevel?.name}{newClassName}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowAddDialog(false); setNewClassName(""); }}>Cancel</Button>
            <Button onClick={handleAddClass} disabled={saving || !newClassName.trim()}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add Class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedClass && (
        <ExportClassListDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          title={`${pLevel?.name ?? ''}${selectedClass.name}`}
          exportUrl={`/api/v1/academics/classes/${selectedClass.id}/export`}
        />
      )}

      {/* Assign Teacher Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Teacher to {pLevel?.name}{selectedClass?.name}</DialogTitle>
            <DialogDescription>Select a teacher for this class</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label>Teacher</Label>
            <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
              <SelectTrigger className="w-full h-11 mt-2">
                <SelectValue placeholder="Select teacher..." />
              </SelectTrigger>
              <SelectContent>
                {teachers.length === 0 ? (
                  <SelectItem value="__none" disabled>No teachers available</SelectItem>
                ) : (
                  teachers.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowAssignDialog(false); setSelectedTeacherId(""); }}>Cancel</Button>
            <Button onClick={handleAssignTeacher} disabled={saving || !selectedTeacherId}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {selectedStudent?.name}</DialogTitle>
            <DialogDescription>Select a target class within {pLevel?.name}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Target Class</Label>
            <Select value={targetClassId} onValueChange={setTargetClassId}>
              <SelectTrigger className="w-full h-11 mt-2">
                <SelectValue placeholder="Select target class" />
              </SelectTrigger>
              <SelectContent>
                {otherClasses.map((classItem) => (
                  <SelectItem key={classItem.id} value={String(classItem.id)}>
                    {pLevel?.name}{classItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {otherClasses.length === 0 && (
              <p className="text-sm mt-2" style={{ color: 'var(--mid-gray)' }}>
                No other classes are available in {pLevel?.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowMoveDialog(false)}>Cancel</Button>
            <Button onClick={handleMoveStudent} disabled={!targetClassId || saving} style={{ backgroundColor: 'var(--maroon)', color: '#fff' }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Move Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {pLevel?.name}{selectedClass?.name}?</DialogTitle>
            <DialogDescription>This cannot be undone. Classes with students cannot be deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onClick={handleDeleteClass} disabled={saving} style={{ backgroundColor: "var(--danger-red)", color: "#fff" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
