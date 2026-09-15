import { useState, useEffect } from "react";
import { Search, Loader2, ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { api } from "../../../lib/api";
import { toast } from "sonner";

interface ClassItem {
  id: number;
  name: string;
  p_level_id: number;
}

interface PLevel {
  id: number;
  name: string;
  classes: ClassItem[];
}

interface Student {
  id: number;
  name: string;
  former_class: string | null;
  rank: number | null;
  marks_percentage: number | null;
  current_class_id: number;
}

export function MidTermAdjustment() {
  const [loading, setLoading] = useState(true);
  const [pLevels, setPLevels] = useState<PLevel[]>([]);
  const [selectedPLevelId, setSelectedPLevelId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const years = await api.get<any>('/api/v1/academics/academic-years');
        const yearsList = Array.isArray(years) ? years : (years as any).data ?? [];
        const activeYear = yearsList.find((y: any) => y.status === 'active');
        if (!activeYear) {
          toast.error('No active academic year found');
          setLoading(false);
          return;
        }
        const res = await api.get<any>(`/api/v1/academics/p-levels?academic_year_id=${activeYear.id}`);
        const levels: PLevel[] = Array.isArray(res) ? res : res.data ?? [];
        setPLevels(levels);
        if (levels.length > 0) {
          setSelectedPLevelId(String(levels[0].id));
          if (levels[0].classes?.length > 0) {
            setSelectedClassId(String(levels[0].classes[0].id));
          }
        }
      } catch {
        toast.error('Failed to load p-levels');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const loadStudents = async (classId: string) => {
    setStudentsLoading(true);
    setStudents([]);
    try {
      const res = await api.get<any>(`/api/v1/academics/classes/${classId}/students`);
      setStudents(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      toast.error('Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedClassId) loadStudents(selectedClassId);
  }, [selectedClassId]);

  const handlePLevelChange = (pLevelId: string) => {
    setSelectedPLevelId(pLevelId);
    setStudents([]);
    setSearchTerm("");
    const pl = pLevels.find(p => String(p.id) === pLevelId);
    if (pl?.classes?.length) {
      setSelectedClassId(String(pl.classes[0].id));
    } else {
      setSelectedClassId("");
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setSearchTerm("");
  };

  const handleMoveStudent = async () => {
    if (!selectedStudent || !targetClassId) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/academics/students/${selectedStudent.id}/move`, { new_class_id: +targetClassId });
      toast.success(`${selectedStudent.name} moved successfully`);
      setShowMoveDialog(false);
      setSelectedStudent(null);
      setTargetClassId("");
      await loadStudents(selectedClassId);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to move student');
    } finally {
      setSaving(false);
    }
  };

  const openMoveDialog = (student: Student) => {
    setSelectedStudent(student);
    setTargetClassId("");
    setShowMoveDialog(true);
  };

  const selectedPLevel = pLevels.find(pl => String(pl.id) === selectedPLevelId);
  const otherClasses = selectedPLevel?.classes?.filter(c => String(c.id) !== selectedClassId) ?? [];
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
          Mid-Term Class Adjustments
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
          Move students between classes
        </p>
      </div>

      {pLevels.length === 0 ? (
        <div className="text-center py-16 border rounded-lg" style={{ borderColor: "var(--border)" }}>
          <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No P-Levels Available</p>
          <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
            No p-levels found for the current academic year.
          </p>
        </div>
      ) : (
        <Tabs value={selectedPLevelId} onValueChange={handlePLevelChange}>
          <TabsList>
            {pLevels.map(pl => (
              <TabsTrigger key={pl.id} value={String(pl.id)}>{pl.name}</TabsTrigger>
            ))}
          </TabsList>

          {pLevels.map(pl => (
            <TabsContent key={pl.id} value={String(pl.id)}>
              <Card style={{ borderColor: "var(--border)" }}>
                <CardContent className="p-6">
                  {(!pl.classes || pl.classes.length === 0) ? (
                    <p className="text-center py-8" style={{ color: "var(--mid-gray)" }}>
                      No classes in {pl.name}
                    </p>
                  ) : (
                    <Tabs value={selectedClassId} onValueChange={handleClassChange}>
                      <div className="flex items-center justify-between mb-6">
                        <TabsList>
                          {pl.classes.map(cls => (
                            <TabsTrigger key={cls.id} value={String(cls.id)}>
                              {pl.name}{cls.name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>

                      {pl.classes.map(cls => (
                        <TabsContent key={cls.id} value={String(cls.id)}>
                          <div className="mb-4 relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2"
                              style={{ color: "var(--mid-gray)" }} />
                            <Input placeholder="Search student name..." value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11" />
                          </div>

                          {studentsLoading ? (
                            <div className="flex justify-center py-8">
                              <Loader2 className="animate-spin" size={24} style={{ color: "var(--navy-blue)" }} />
                            </div>
                          ) : (
                            <>
                              <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
                                <Table>
                                  <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                                    <TableRow>
                                      <TableHead className="text-white w-10">#</TableHead>
                                      <TableHead className="text-white">Name</TableHead>
                                      <TableHead className="text-white">Former Class</TableHead>
                                      <TableHead className="text-white">Rank</TableHead>
                                      <TableHead className="text-white">Marks %</TableHead>
                                      <TableHead className="text-white text-right">Actions</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {filteredStudents.length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8"
                                          style={{ color: "var(--mid-gray)" }}>
                                          No students in this class
                                        </TableCell>
                                      </TableRow>
                                    ) : filteredStudents.map((student, index) => (
                                      <TableRow key={student.id}
                                        style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                                        <TableCell className="text-sm" style={{ color: "var(--mid-gray)" }}>
                                          {index + 1}
                                        </TableCell>
                                        <TableCell className="font-medium" style={{ color: "var(--dark-gray)" }}>
                                          {student.name}
                                        </TableCell>
                                        <TableCell style={{ color: "var(--dark-gray)" }}>
                                          {student.former_class ?? '—'}
                                        </TableCell>
                                        <TableCell style={{ color: "var(--dark-gray)" }}>
                                          {student.rank ?? '—'}
                                        </TableCell>
                                        <TableCell style={{ color: "var(--dark-gray)" }}>
                                          {student.marks_percentage != null ? `${student.marks_percentage}%` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Button variant="ghost" size="sm"
                                            onClick={() => openMoveDialog(student)}
                                            style={{ color: "var(--maroon)" }}>
                                            <ArrowLeftRight size={16} className="mr-1" />
                                            Move
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <p className="text-sm mt-3" style={{ color: "var(--mid-gray)" }}>
                                {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
                              </p>
                            </>
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Move Student Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move {selectedStudent?.name}</DialogTitle>
            <DialogDescription>
              Select a target class within {selectedPLevel?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Target Class</Label>
            <Select value={targetClassId} onValueChange={setTargetClassId}>
              <SelectTrigger className="w-full h-11 mt-2">
                <SelectValue placeholder="Select target class" />
              </SelectTrigger>
              <SelectContent>
                {otherClasses.map(cls => (
                  <SelectItem key={cls.id} value={String(cls.id)}>
                    {selectedPLevel?.name}{cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {otherClasses.length === 0 && (
              <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
                No other classes available in {selectedPLevel?.name}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowMoveDialog(false)}>Cancel</Button>
            <Button onClick={handleMoveStudent} disabled={!targetClassId || saving}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Move Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
