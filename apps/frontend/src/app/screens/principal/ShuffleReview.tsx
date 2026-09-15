import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { Search, AlertTriangle, CheckCircle, ArrowLeft, Loader2, Download } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { ExportClassListDialog } from "../../components/ExportClassListDialog";

interface StudentResult {
  result_id: number;
  name: string;
  former_class: string | null;
  rank: number;
  marks_percentage: number | null;
  new_class: string;
  new_class_id: number;
}

interface PreviewData {
  session: {
    id: number;
    p_level: { id: number; name: string; };
    algorithm: string;
    status: string;
    submitted_at: string | null;
    submitted_by_user?: { name: string; };
  };
  grouped: Record<string, StudentResult[]>;
  summary: { class: string; count: number; }[];
}

interface StaffUser { id: number; name: string; role: string; }

const CLASS_COLORS = ["var(--maroon)", "var(--navy-blue)", "var(--gold)", "var(--success-green)", "var(--info-blue)", "#6B21A8"];

export function ShuffleReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [deans, setDeans] = useState<StaffUser[]>([]);
  const [allStudents, setAllStudents] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [selectedDeanId, setSelectedDeanId] = useState<string>("");

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [data, staff] = await Promise.all([
        api.get<any>(`/api/v1/academics/shuffle/${sessionId}/preview`),
        api.get<any>('/api/v1/admin/staff?role=dean'),
      ]);
      setPreview(data);
      setAllStudents(Object.values(data.grouped as Record<string, StudentResult[]>).flat());
      const deanList: StaffUser[] = Array.isArray(staff) ? staff : staff.data ?? [];
      setDeans(deanList);
      if (deanList.length === 1) setSelectedDeanId(deanList[0].id.toString());
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const classNames = preview ? Object.keys(preview.grouped) : [];
  const classColorMap: Record<string, string> = {};
  classNames.forEach((cn, i) => { classColorMap[cn] = CLASS_COLORS[i % CLASS_COLORS.length]; });

  const filteredStudents = allStudents.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchClass = classFilter === "all" || s.new_class === classFilter;
    return matchSearch && matchClass;
  });

  const handleApprove = async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/academics/shuffle/${sessionId}/approve`, {
        dean_id: selectedDeanId ? +selectedDeanId : undefined,
      });
      toast.success('Class list approved — Dean notified');
      setShowApproveDialog(false);
      setTimeout(() => navigate('/principal/approvals'), 800);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim()) { toast.error("Please provide a rejection note"); return; }
    if (!sessionId) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/academics/shuffle/${sessionId}/reject`, {
        note: rejectionNote,
        dean_id: selectedDeanId ? +selectedDeanId : undefined,
      });
      toast.success('Class list rejected — Dean notified');
      setShowRejectDialog(false);
      setTimeout(() => navigate('/principal/approvals'), 800);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to reject');
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
    <div className="text-center py-20"><p style={{ color: "var(--mid-gray)" }}>Session not found.</p></div>
  );

  const pLevelName = preview.session.p_level?.name ?? '';
  const isPending = preview.session.status === 'pending_approval';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/principal/approvals")} style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back to Approvals
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Review — {pLevelName} Class List</h1>
        <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>Approvals &gt; {pLevelName}</p>
      </div>

      {isPending ? (
        <Card style={{ borderColor: "var(--warning-amber)", backgroundColor: "#FEF3E8" }}>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle size={24} style={{ color: "var(--warning-amber)" }} />
            <div>
              <p className="font-semibold" style={{ color: "var(--warning-amber)" }}>Pending your approval</p>
              <p className="text-sm" style={{ color: "#B45309" }}>
                Submitted by {preview.session.submitted_by_user?.name ?? 'Dean'}
                {preview.session.submitted_at ? ` on ${new Date(preview.session.submitted_at).toLocaleDateString()}` : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card style={{ borderColor: "var(--border)", backgroundColor: "var(--light-gray)" }}>
          <CardContent className="p-4">
            <p className="text-sm font-semibold" style={{ color: "var(--dark-gray)" }}>
              Status: {preview.session.status?.replace(/_/g, ' ')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card style={{ borderColor: "var(--border)", backgroundColor: "var(--light-gray)" }}>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            {preview.summary.map(s => (
              <div key={s.class} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: classColorMap[s.class] ?? "var(--mid-gray)" }} />
                <span className="font-semibold" style={{ color: "var(--dark-gray)" }}>{s.class}:</span>
                <span style={{ color: "var(--mid-gray)" }}>{s.count} students</span>
              </div>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <span className="font-semibold" style={{ color: "var(--dark-gray)" }}>Algorithm:</span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: "color-mix(in srgb, var(--gold) 13%, transparent)", color: "var(--gold)" }}>
                {preview.session.algorithm?.replace(/_/g, ' ') ?? '—'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review Table */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search student name..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-48 h-11"><SelectValue placeholder="Filter by class" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classNames.map(cn => <SelectItem key={cn} value={cn}>{cn}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowExportDialog(true)}
              variant="outline" className="h-11" style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
              <Download size={18} className="mr-2" /> Export
            </Button>
          </div>

          <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
            <Table>
              <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                <TableRow>
                  <TableHead className="text-white">Name</TableHead>
                  <TableHead className="text-white">Former Class</TableHead>
                  <TableHead className="text-white">Rank</TableHead>
                  <TableHead className="text-white">Marks %</TableHead>
                  <TableHead className="text-white">New Class</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s, index) => (
                  <TableRow key={s.result_id} style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                    <TableCell className="font-medium" style={{ color: "var(--dark-gray)" }}>{s.name}</TableCell>
                    <TableCell>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: "var(--mid-gray)" }}>{s.former_class ?? '—'}</span>
                    </TableCell>
                    <TableCell style={{ color: "var(--dark-gray)" }}>{s.rank ?? '—'}</TableCell>
                    <TableCell style={{ color: "var(--dark-gray)" }}>{s.marks_percentage != null ? `${s.marks_percentage}%` : '—'}</TableCell>
                    <TableCell>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: classColorMap[s.new_class] ?? "var(--mid-gray)" }}>{s.new_class}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm mt-3" style={{ color: "var(--mid-gray)" }}>{filteredStudents.length} of {allStudents.length} students</p>
        </CardContent>
      </Card>

      {/* Dean selector for notifications */}
      {deans.length > 1 && (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-4">
            <Label>Notify Dean</Label>
            <Select value={selectedDeanId} onValueChange={setSelectedDeanId}>
              <SelectTrigger className="w-full h-11 mt-2"><SelectValue placeholder="Select dean..." /></SelectTrigger>
              <SelectContent>
                {deans.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => navigate("/principal/approvals")} className="h-11">Back to Approvals</Button>
        {isPending && (
          <div className="flex gap-3">
            <Button onClick={() => setShowRejectDialog(true)} className="h-11"
              style={{ backgroundColor: "var(--danger-red)", color: "#FFFFFF" }}>Reject</Button>
            <Button onClick={() => setShowApproveDialog(true)} className="h-11"
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>Approve</Button>
          </div>
        )}
      </div>

      <ExportClassListDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        title={`${pLevelName} Class List`}
        exportUrl={`/api/v1/academics/shuffle/${sessionId}/export`}
      />

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--success-green) 13%, transparent)" }}>
                <CheckCircle size={32} style={{ color: "var(--success-green)" }} />
              </div>
            </div>
            <DialogTitle className="text-center">Approve {pLevelName} Class List?</DialogTitle>
            <DialogDescription className="text-center">
              The Dean will be notified and can proceed with distribution.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={saving} style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--danger-red) 13%, transparent)" }}>
                <AlertTriangle size={32} style={{ color: "var(--danger-red)" }} />
              </div>
            </div>
            <DialogTitle className="text-center">Reject {pLevelName} Class List?</DialogTitle>
            <DialogDescription className="text-center">Provide feedback for the Dean on what needs to be changed</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-note">Rejection Note (Required)</Label>
            <Textarea id="rejection-note" value={rejectionNote}
              onChange={e => setRejectionNote(e.target.value)}
              placeholder="Explain what needs to be changed..." className="mt-2 min-h-32" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
            <Button onClick={handleReject} disabled={saving} style={{ backgroundColor: "var(--danger-red)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Reject & Notify Dean
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
