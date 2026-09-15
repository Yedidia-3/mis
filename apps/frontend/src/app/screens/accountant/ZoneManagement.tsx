import { useState, useEffect, useCallback } from "react";
import { Plus, MoreVertical, Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { toast } from "sonner";
import { api } from "../../../lib/api";

interface Zone {
  id: number;
  name: string;
  price: number;
  status: string;
}

export function ZoneManagement() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [zoneName, setZoneName] = useState("");
  const [zonePrice, setZonePrice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/accountant/zones');
      setZones(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      toast.error('Failed to load zones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!zoneName.trim() || !zonePrice) { toast.error("Please fill all fields"); return; }
    setSaving(true);
    try {
      await api.post('/api/v1/accountant/zones', { name: zoneName.trim(), price: +zonePrice });
      toast.success(`Zone ${zoneName} created`);
      setShowAddDialog(false);
      setZoneName(""); setZonePrice("");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create zone');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedZone || !zoneName.trim() || !zonePrice) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/accountant/zones/${selectedZone.id}`, { name: zoneName.trim(), price: +zonePrice });
      toast.success(`Zone ${zoneName} updated`);
      setShowEditDialog(false);
      setZoneName(""); setZonePrice(""); setSelectedZone(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update zone');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedZone) return;
    setSaving(true);
    try {
      await api.delete(`/api/v1/accountant/zones/${selectedZone.id}`);
      toast.success(`Zone ${selectedZone.name} removed`);
      setShowDeleteDialog(false);
      setSelectedZone(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to delete zone');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (zone: Zone) => {
    setSelectedZone(zone);
    setZoneName(zone.name);
    setZonePrice(zone.price.toString());
    setShowEditDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Transport Zones</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>Manage transport zones and pricing</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="h-11"
          style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
          <Plus size={18} className="mr-2" /> Add Zone
        </Button>
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : zones.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No zones yet</p>
              <p className="text-sm mt-2 mb-4" style={{ color: "var(--mid-gray)" }}>Create the first transport zone.</p>
              <Button onClick={() => setShowAddDialog(true)} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                <Plus size={18} className="mr-2" /> Add Zone
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                  <TableRow>
                    <TableHead className="text-white">Zone Name</TableHead>
                    <TableHead className="text-white">Price (RWF)</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zones.map((zone, index) => (
                    <TableRow key={zone.id} style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                      <TableCell className="font-semibold" style={{ color: "var(--dark-gray)" }}>{zone.name}</TableCell>
                      <TableCell style={{ color: "var(--dark-gray)" }}>{zone.price.toLocaleString()} RWF</TableCell>
                      <TableCell>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: zone.status === 'active' ? "var(--success-green)" : "var(--mid-gray)" }}>
                          {zone.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(zone)}>Edit Zone</DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600"
                              onClick={() => { setSelectedZone(zone); setShowDeleteDialog(true); }}>
                              Delete Zone
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Zone</DialogTitle>
            <DialogDescription>Create a new transport zone</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Zone Name</Label>
              <Input value={zoneName} onChange={e => setZoneName(e.target.value)}
                placeholder="e.g., Zone 4" className="mt-2 h-11" />
            </div>
            <div>
              <Label>Price (RWF)</Label>
              <Input type="number" value={zonePrice} onChange={e => setZonePrice(e.target.value)}
                placeholder="e.g., 15000" className="mt-2 h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowAddDialog(false); setZoneName(""); setZonePrice(""); }}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving} style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Add Zone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Zone</DialogTitle>
            <DialogDescription>Update zone details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Zone Name</Label>
              <Input value={zoneName} onChange={e => setZoneName(e.target.value)} className="mt-2 h-11" />
            </div>
            <div>
              <Label>Price (RWF)</Label>
              <Input type="number" value={zonePrice} onChange={e => setZonePrice(e.target.value)} className="mt-2 h-11" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving} style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {selectedZone?.name}?</DialogTitle>
            <DialogDescription>Zones with active enrollments cannot be deleted.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={saving} style={{ backgroundColor: "var(--danger-red)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
