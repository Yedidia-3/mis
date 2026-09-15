import { useEffect, useState } from "react";
import { Calendar, AlertTriangle, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { toast } from "sonner";
import { api } from "../../../lib/api";

interface AcademicYear { id: number; name: string; status: string; archived_at: string | null; created_at: string; deletion_status?: 'none' | 'pending' | 'rejected'; }

export function AcademicYearManagement() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [newYearName, setNewYearName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await api.get<any>('/api/v1/admin/academic-years');
      setYears(Array.isArray(res) ? res : res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const activeYear = years.find(y => y.status === 'active');
  const archivedYears = years.filter(y => y.status === 'archived');

  const handleCreate = async () => {
    if (!newYearName.trim()) return;
    setSaving(true);
    try {
      await api.post('/api/v1/admin/academic-years', { name: newYearName.trim() });
      toast.success(`Academic year ${newYearName} created`);
      setShowAddDialog(false);
      setNewYearName("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create year');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestDeletion = async (year: AcademicYear) => {
    if (!confirm(`Request deletion of ${year.name}? The Principal must approve before it is permanently deleted.`)) return;
    try {
      await api.post(`/api/v1/admin/academic-years/${year.id}/request-deletion`, {});
      toast.success(`Deletion request for ${year.name} sent to the Principal`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to request deletion');
    }
  };

  const handleArchive = async () => {
    if (!activeYear || confirmText !== activeYear.name) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/admin/academic-years/${activeYear.id}/archive`, {});
      toast.success(`${activeYear.name} archived successfully`);
      setShowArchiveDialog(false);
      setConfirmText("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to archive');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Academic Year Management</h1>
        <Button onClick={() => setShowAddDialog(true)} style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>
          <Plus size={18} className="mr-2" /> New Year
        </Button>
      </div>

      {/* Active Year */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardHeader><CardTitle>Current Academic Year</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} /></div>
          ) : activeYear ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 13%, transparent)" }}>
                  <Calendar size={32} style={{ color: "var(--maroon)" }} />
                </div>
                <div>
                  <h3 className="text-3xl font-bold" style={{ color: "var(--dark-gray)" }}>{activeYear.name}</h3>
                  <span className="mt-2 inline-block px-3 py-1 rounded-full text-sm font-semibold text-white" style={{ backgroundColor: "var(--success-green)" }}>Active</span>
                </div>
              </div>
              <div className="pt-2">
                <Button onClick={() => setShowArchiveDialog(true)} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                  Archive This Year
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm mb-4" style={{ color: "var(--mid-gray)" }}>No active academic year. Create one to get started.</p>
              <Button onClick={() => setShowAddDialog(true)} style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>
                <Plus size={18} className="mr-2" /> Create Academic Year
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archived Years */}
      {archivedYears.length > 0 && (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardHeader><CardTitle>Archived Years</CardTitle></CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                  <TableRow>
                    <TableHead className="text-white">Year</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white">Archived Date</TableHead>
                    <TableHead className="text-white text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedYears.map((y, i) => (
                    <TableRow key={y.id} style={{ backgroundColor: i % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                      <TableCell className="font-semibold" style={{ color: "var(--dark-gray)" }}>{y.name}</TableCell>
                      <TableCell>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: "var(--mid-gray)" }}>Archived</span>
                      </TableCell>
                      <TableCell style={{ color: "var(--mid-gray)" }}>
                        {y.archived_at ? new Date(y.archived_at).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {y.deletion_status === 'pending' ? (
                          <span className="text-xs font-semibold" style={{ color: "var(--warning-amber)" }}>
                            Pending Principal approval
                          </span>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleRequestDeletion(y)}
                            style={{ color: "var(--danger-red)", borderColor: "var(--danger-red)" }}>
                            Request Deletion
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Year Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Academic Year</DialogTitle>
            <DialogDescription>e.g. 2025-2026</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Year Name</Label>
            <Input className="mt-2 h-11" placeholder="2025-2026" value={newYearName}
              onChange={e => setNewYearName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      {activeYear && (
        <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--warning-amber) 13%, transparent)" }}>
                  <AlertTriangle size={32} style={{ color: "var(--warning-amber)" }} />
                </div>
              </div>
              <DialogTitle className="text-center">Archive {activeYear.name}?</DialogTitle>
              <DialogDescription className="text-center">
                This will lock all data for this year. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label>Type <strong>{activeYear.name}</strong> to confirm</Label>
              <Input className="mt-2 h-11" placeholder={activeYear.name}
                value={confirmText} onChange={e => setConfirmText(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowArchiveDialog(false); setConfirmText(""); }}>Cancel</Button>
              <Button onClick={handleArchive} disabled={confirmText !== activeYear.name || saving}
                style={{ backgroundColor: "var(--danger-red)", color: "#fff" }}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Archive Year
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
