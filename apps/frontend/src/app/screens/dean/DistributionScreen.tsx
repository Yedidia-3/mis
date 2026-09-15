import { ArrowLeft, Briefcase, CheckCircle, Loader2, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

interface StudentResult {
  result_id: number;
  name: string;
  new_class: string;
  new_class_id: number;
}

interface PreviewClassInfo {
  id: number;
  name: string;
  teacher_id: number | null;
  distributed_at: string | null;
  is_served: boolean;
}

interface PreviewData {
  session: { id: number; p_level: { name: string }; status: string; };
  grouped: Record<string, StudentResult[]>;
  summary: { class: string; count: number; }[];
  classes: PreviewClassInfo[];
}

interface StaffUser { id: number; name: string; role: string; }

export function DistributionScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [teachers, setTeachers] = useState<StaffUser[]>([]);
  const [seniorStaff, setSeniorStaff] = useState<StaffUser[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<Record<string, string>>({});
  const [selectedSeniorStaffId, setSelectedSeniorStaffId] = useState<string>("");
  const [distributionMode, setDistributionMode] = useState<'senior_staff' | 'teachers'>('senior_staff');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [data, staff] = await Promise.all([
        api.get<any>(`/api/v1/academics/shuffle/${sessionId}/preview`),
        api.get<any>('/api/v1/admin/staff'),
      ]);
      setPreview(data);
      const staffList: StaffUser[] = Array.isArray(staff) ? staff : staff.data ?? [];
      const teacherList = staffList.filter(s => s.role === 'teacher');
      const seniorList = staffList.filter(s => s.role === 'principal' || s.role === 'accountant');
      setTeachers(teacherList);
      setSeniorStaff(seniorList);
      if (seniorList.length === 1) setSelectedSeniorStaffId(seniorList[0].id.toString());
    } catch {
      toast.error('Failed to load distribution data');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  // Get unique classes from summary
  const classes = preview?.summary ?? [];
  const classIds: Record<string, number> = {};
  if (preview) {
    for (const [className, students] of Object.entries(preview.grouped)) {
      if (students.length > 0) classIds[className] = students[0].new_class_id;
    }
  }

  const allAssigned = classes.every(c => !!teacherAssignments[c.class]);
  const seniorStaffReady = !!selectedSeniorStaffId;
  const allClassesServed = (preview?.classes ?? []).length > 0 && (preview?.classes ?? []).every(c => !!c.distributed_at && !!c.teacher_id);
  const canDistributeAgain = preview && (preview.session.status === 'approved' || preview.session.status === 'distributed') && !allClassesServed;
  const canSubmitDistribution = canDistributeAgain && (distributionMode === 'senior_staff' ? seniorStaffReady : allAssigned);

  const handleDistribute = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = { distribution_mode: distributionMode };
      if (distributionMode === 'senior_staff') {
        payload.senior_staff_id = selectedSeniorStaffId ? +selectedSeniorStaffId : undefined;
      } else {
        payload.teacher_assignments = Object.entries(teacherAssignments).map(([className, teacherId]) => ({
          class_id: classIds[className],
          teacher_id: +teacherId,
        }));
      }
      await api.post(`/api/v1/academics/shuffle/${sessionId}/distribute`, payload);
      toast.success('Class list distributed successfully');
      setShowDialog(false);
      setTimeout(() => navigate('/dean/dashboard'), 800);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to distribute');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <Loader2 className="animate-spin" size={36} style={{ color: "var(--navy-blue)" }} />
    </div>
  );

  if (!preview) return (
    <div className="text-center py-20">
      <p style={{ color: "var(--mid-gray)" }}>Session not found.</p>
    </div>
  );

  const pLevelName = preview.session.p_level?.name ?? '';
  const isApproved = preview.session.status === 'approved';
  const isDistributed = preview.session.status === 'distributed';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back
        </Button>
      </div>

      <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
        Distribute — {pLevelName} Classes
      </h1>

      {isApproved || isDistributed ? (
        <Card style={{ borderColor: allClassesServed ? "var(--info-blue)" : "var(--success-green)", backgroundColor: allClassesServed ? "#EFF6FF" : "#F0FDF4" }}>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle size={24} style={{ color: allClassesServed ? "var(--info-blue)" : "var(--success-green)" }} />
            <div>
              <p className="font-semibold" style={{ color: allClassesServed ? "var(--info-blue)" : "var(--success-green)" }}>
                {allClassesServed ? 'All required class recipients are already served.' : `${pLevelName} is ready for redistribution to missing recipients.`}
              </p>
              <p className="text-sm" style={{ color: allClassesServed ? "#1D4ED8" : "#15803D" }}>
                {allClassesServed
                  ? 'This list is fully distributed, so the action is now locked.'
                  : 'Some classes or recipients are still missing access, so a fresh distribution is allowed.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ borderColor: "var(--warning-amber)", backgroundColor: "#FEF3E8" }}>
          <CardContent className="p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--warning-amber)" }}>
              Status: {preview.session.status?.replace(/_/g, ' ')} — Distribution is only allowed after Principal approval.
            </p>
          </CardContent>
        </Card>
      )}

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <Label className="mb-3 block">Distribution Route</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              type="button"
              variant={distributionMode === 'senior_staff' ? 'default' : 'outline'}
              onClick={() => setDistributionMode('senior_staff')}
              className="justify-start h-12"
              style={{
                backgroundColor: distributionMode === 'senior_staff' ? 'var(--maroon)' : 'transparent',
                color: distributionMode === 'senior_staff' ? '#FFFFFF' : 'var(--dark-gray)',
                borderColor: 'var(--border)',
              }}
            >
              <Briefcase size={16} className="mr-2" /> Senior Staff
            </Button>
            <Button
              type="button"
              variant={distributionMode === 'teachers' ? 'default' : 'outline'}
              onClick={() => setDistributionMode('teachers')}
              className="justify-start h-12"
              style={{
                backgroundColor: distributionMode === 'teachers' ? 'var(--maroon)' : 'transparent',
                color: distributionMode === 'teachers' ? '#FFFFFF' : 'var(--dark-gray)',
                borderColor: 'var(--border)',
              }}
            >
              <Users size={16} className="mr-2" /> Teachers
            </Button>
          </div>
        </CardContent>
      </Card>

      {distributionMode === 'senior_staff' ? (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-6">
            <Label>Assign class list to a senior staff member</Label>
            <Select value={selectedSeniorStaffId} onValueChange={setSelectedSeniorStaffId}>
              <SelectTrigger className="w-full h-11 mt-2">
                <SelectValue placeholder="Select principal or accountant..." />
              </SelectTrigger>
              <SelectContent>
                {seniorStaff.length === 0 ? (
                  <SelectItem value="__none" disabled>No senior staff available</SelectItem>
                ) : (
                  seniorStaff.map(member => (
                    <SelectItem key={member.id} value={member.id.toString()}>{member.name} ({member.role})</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardHeader><CardTitle>Assign each teacher to their concerned classes</CardTitle></CardHeader>
          <CardContent>
            {!allAssigned && (
              <div className="mb-4 p-3 rounded-lg" style={{ backgroundColor: "#FEF3E8" }}>
                <p className="text-sm" style={{ color: "var(--warning-amber)" }}>
                  <strong>Warning:</strong> Every class must have a teacher assigned before distributing to teachers.
                </p>
              </div>
            )}
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                  <TableRow>
                    <TableHead className="text-white">Class</TableHead>
                    <TableHead className="text-white">Students</TableHead>
                    <TableHead className="text-white">Assigned Teacher</TableHead>
                    <TableHead className="text-white">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((c, index) => (
                    <TableRow key={c.class} style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                      <TableCell className="font-semibold" style={{ color: "var(--dark-gray)" }}>{c.class}</TableCell>
                      <TableCell style={{ color: "var(--dark-gray)" }}>{c.count}</TableCell>
                      <TableCell>
                        {teacherAssignments[c.class] ? (
                          <span className="font-medium" style={{ color: "var(--success-green)" }}>
                            {teachers.find(t => t.id.toString() === teacherAssignments[c.class])?.name ?? 'Assigned'}
                          </span>
                        ) : (
                          <span className="italic" style={{ color: "var(--mid-gray)" }}>Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select value={teacherAssignments[c.class] ?? undefined}
                          onValueChange={(teacherId) => setTeacherAssignments(prev => ({ ...prev, [c.class]: teacherId }))}>
                          <SelectTrigger className="w-48 h-9">
                            <SelectValue placeholder="Select teacher" />
                          </SelectTrigger>
                          <SelectContent>
                            {teachers.length === 0 ? (
                              <SelectItem value="__none" disabled>No teachers available</SelectItem>
                            ) : (
                              teachers.map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => navigate(-1)} className="h-11">Back</Button>
        <Button onClick={() => setShowDialog(true)} disabled={!canSubmitDistribution} className="h-11"
          style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
          {allClassesServed ? 'Already Distributed' : 'Distribute Classes'}
        </Button>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Distribute {pLevelName} class list?</DialogTitle>
            <DialogDescription>
              This will send class lists to assigned teachers and the accountant. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleDistribute} disabled={saving}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Distribute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
