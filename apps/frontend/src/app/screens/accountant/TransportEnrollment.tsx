import { ArrowLeft, Bus, Download, Loader2, MoreVertical, Plus, Search, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

interface Zone { id: number; name: string; price: number; }

interface PaymentCell {
  paid_on: string;
  months: number;
  expires_on: string;
  kind?: "full" | "partial";
  unit_price?: number;
  full_amount?: number;
  amount_paid?: number;
  balance?: number;
}

interface Enrollment {
  id: number;
  student_id: number;
  zone_id: number | null;
  payments: Record<string, PaymentCell>;
  student: {
    id: number;
    name: string;
    current_class: { id: number; name: string; p_level: { id: number; name: string } | null } | null;
  } | null;
}

// Timezone-safe: parse YYYY-MM-DD as a LOCAL date (not UTC) so the expiry
// stays in sync with the exact date the accountant picked.
function addMonths(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + months, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
function fmtLocal(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function rwf(n: number): string {
  return `RWF ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function roundMoney(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}
function cellState(cell?: PaymentCell): "none" | "active" | "soon" | "expired" {
  if (!cell) return "none";
  const today = new Date().toISOString().split('T')[0];
  if (cell.expires_on < today) return "expired";
  const soon = new Date(); soon.setDate(soon.getDate() + 3);
  if (cell.expires_on <= soon.toISOString().split('T')[0]) return "soon";
  return "active";
}
const STATE_COLOR: Record<string, string> = { active: "var(--success-green)", soon: "var(--warning-amber)", expired: "var(--danger-red)" };
const DURATION_OPTIONS = [
  { label: "1 month", months: 1 },
  { label: "2 months", months: 2 },
  { label: "3 months", months: 3 },
  { label: "Full term (4 months)", months: 4 },
];

const MONTHS = [1, 2, 3, 4];
const MONTH_LABEL = ["1st", "2nd", "3rd", "4th"];

function classLabel(e: Enrollment): string {
  const cc = e.student?.current_class;
  if (!cc) return "—";
  return `${cc.p_level?.name ?? ""}${cc.name}`;
}

export function TransportEnrollment() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const [payTarget, setPayTarget] = useState<{ e: Enrollment; key: string; label: string } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [payMonths, setPayMonths] = useState<string>("1");
  const [payKind, setPayKind] = useState<"full" | "partial">("full");
  const [amountPaid, setAmountPaid] = useState("");

  const load = useCallback(async () => {
    try {
      const [enrollRes, zoneRes] = await Promise.all([
        api.get<any>('/api/v1/accountant/enrollments?type=transport'),
        api.get<any>('/api/v1/accountant/zones').catch(() => []),
      ]);
      setEnrollments(Array.isArray(enrollRes) ? enrollRes : enrollRes.data ?? []);
      setZones(Array.isArray(zoneRes) ? zoneRes : zoneRes.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const zoneName = (id: number | null) => zones.find(z => z.id === id)?.name ?? null;
  const zoneKey = (e: Enrollment) => (e.zone_id != null && zoneName(e.zone_id) ? String(e.zone_id) : "none");
  const zoneTitle = (e: Enrollment) => zoneName(e.zone_id) ?? "No zone";
  const hasPayment = (e: Enrollment) => Object.keys(e.payments ?? {}).length > 0;

  const zoneCards = [
    {
      id: "all",
      name: "All zones",
      price: null as number | null,
      students: enrollments.length,
      paid: enrollments.filter(hasPayment).length,
    },
    ...[...zones].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })).map((z) => {
      const rows = enrollments.filter((e) => e.zone_id === z.id);
      return {
        id: String(z.id),
        name: z.name,
        price: z.price,
        students: rows.length,
        paid: rows.filter(hasPayment).length,
      };
    }),
    ...(enrollments.some((e) => e.zone_id == null || !zoneName(e.zone_id))
      ? [{
          id: "none",
          name: "No zone",
          price: null as number | null,
          students: enrollments.filter((e) => e.zone_id == null || !zoneName(e.zone_id)).length,
          paid: enrollments.filter((e) => (e.zone_id == null || !zoneName(e.zone_id)) && hasPayment(e)).length,
        }]
      : []),
  ];

  const filtered = enrollments
    .filter((e) => {
      const matchSearch = (e.student?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchZone = zoneFilter === "all" || zoneKey(e) === zoneFilter;
      return matchSearch && matchZone;
    })
    .sort((a, b) => zoneTitle(a).localeCompare(zoneTitle(b)) || (a.student?.name ?? "").localeCompare(b.student?.name ?? ""));

  const today = new Date();
  const soonCutoff = new Date(); soonCutoff.setDate(today.getDate() + 5);
  const paymentCells = filtered.flatMap((e) => Object.values(e.payments ?? {}));
  const unpaidCount = filtered.filter((e) => Object.keys(e.payments ?? {}).length === 0).length;
  const partialCount = paymentCells.filter((cell) => cell?.kind === "partial").length;
  const partialLeft = paymentCells
    .filter((cell) => cell?.kind === "partial")
    .reduce((sum, cell) => sum + Number(cell.balance ?? 0), 0);
  const dueSoonCount = paymentCells.filter((cell) => {
    if (!cell?.expires_on) return false;
    const expiry = new Date(`${cell.expires_on}T00:00:00`);
    return expiry >= today && expiry <= soonCutoff;
  }).length;
  const expiredCount = paymentCells.filter((cell) => cell?.expires_on && new Date(`${cell.expires_on}T00:00:00`) < today).length;

  const stats = [
    { label: 'Enrolled', value: filtered.length, note: 'students in view' },
    { label: 'Not Yet Paid', value: unpaidCount, note: 'no payment recorded' },
    { label: 'Partial Payments', value: partialCount, note: partialLeft > 0 ? `${rwf(partialLeft)} still due` : 'none outstanding' },
    { label: 'Due in 5 Days', value: dueSoonCount, note: 'payment window closing' },
    { label: 'Expired', value: expiredCount, note: 'already due' },
  ];

  const savePayments = async (e: Enrollment, next: Record<string, PaymentCell>) => {
    setEnrollments(prev => prev.map(x => x.id === e.id ? { ...x, payments: next } : x));
    setSavingId(e.id);
    try {
      const saved = await api.put<{ payments: Record<string, PaymentCell> }>(
        `/api/v1/accountant/enrollments/${e.id}/payments`,
        { payments: next },
      );
      if (saved?.payments) {
        setEnrollments(prev => prev.map(x => x.id === e.id ? { ...x, payments: saved.payments } : x));
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update payment');
      load();
    } finally {
      setSavingId(null);
    }
  };

  const onToggle = (e: Enrollment, month: number) => {
    if (!e.zone_id) { toast.error('Assign a zone before recording payment'); return; }
    const unit = Number(zones.find(z => z.id === e.zone_id)?.price) || 0;
    if (!(unit > 0)) {
      toast.error('Set the zone price before recording a payment.');
      return;
    }
    const key = `${month}`;
    if (e.payments?.[key]) {
      const next = { ...e.payments };
      delete next[key];
      savePayments(e, next);
    } else {
      setPayTarget({ e, key, label: `${e.student?.name ?? ''} · Month ${month} Transport` });
      setPayDate(new Date().toISOString().split('T')[0]);
      setPayMonths("1");
      setPayKind("full");
      setAmountPaid("");
    }
  };

  const unitPrice = payTarget
    ? (Number(zones.find(z => z.id === payTarget.e.zone_id)?.price) || 0)
    : 0;
  const fullAmount = roundMoney(unitPrice * (+payMonths || 1));
  const paidNumber = roundMoney(Number(amountPaid));
  const partialInvalid = payKind === "partial" && (!(paidNumber > 0) || paidNumber > fullAmount);
  const balance = payKind === "partial" && paidNumber > 0 && paidNumber <= fullAmount
    ? roundMoney(fullAmount - paidNumber)
    : 0;

  const confirmPayment = () => {
    if (!payTarget || !payDate || partialInvalid || !(unitPrice > 0)) return;
    const months = +payMonths;
    // Omit the price snapshot so the server loads the saved zone price.
    const cell: PaymentCell = {
      paid_on: payDate,
      months,
      expires_on: addMonths(payDate, months),
      kind: payKind,
      ...(payKind === "partial" ? { amount_paid: paidNumber } : {}),
    };
    const next = { ...(payTarget.e.payments ?? {}), [payTarget.key]: cell };
    savePayments(payTarget.e, next);
    setPayTarget(null);
  };

  const setZone = async (e: Enrollment, zoneId: string) => {
    setEnrollments(prev => prev.map(x => x.id === e.id ? { ...x, zone_id: +zoneId } : x));
    try {
      await api.put(`/api/v1/accountant/enrollments/${e.id}/zone`, { zone_id: +zoneId });
      toast.success('Zone updated');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to set zone');
      load();
    }
  };

  const handleWaive = async (e: Enrollment) => {
    try {
      await api.delete(`/api/v1/accountant/enrollments/${e.id}`);
      toast.success(`${e.student?.name ?? 'Student'} removed from transport`);
      setSelectedIds((ids) => ids.filter((id) => id !== e.id));
      load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove');
    }
  };

  const selectedInView = selectedIds.filter((id) => filtered.some((e) => e.id === id));
  const allVisibleSelected = filtered.length > 0 && filtered.every((e) => selectedIds.includes(e.id));
  const toggleAll = () => {
    const visibleIds = filtered.map((e) => e.id);
    setSelectedIds((prev) => allVisibleSelected
      ? prev.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...prev, ...visibleIds])));
  };
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const removeSelected = async () => {
    if (!selectedInView.length) return;
    setRemoving(true);
    try {
      const res = await api.post<{ removed: number }>('/api/v1/accountant/enrollments/bulk-remove', { ids: selectedInView });
      toast.success(`${res?.removed ?? selectedInView.length} student${selectedInView.length === 1 ? '' : 's'} removed from transport`);
      setSelectedIds((ids) => ids.filter((id) => !selectedInView.includes(id)));
      setConfirmRemove(false);
      load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove selected students');
    } finally {
      setRemoving(false);
    }
  };

  const handleExport = () => {
    const header = "Name,Class,Zone," + MONTHS.map(m => `M${m}`).join(",") + "\n";
    const rows = filtered.map(e => {
      const describe = (cell?: PaymentCell) => {
        if (!cell?.expires_on) return "";
        if (cell.kind === "partial") return `partial paid ${cell.amount_paid ?? ""} left ${cell.balance ?? ""} exp ${cell.expires_on}`;
        if (cell.kind === "full") return `full ${cell.full_amount ?? ""} exp ${cell.expires_on}`;
        return `exp ${cell.expires_on}`;
      };
      const cells = MONTHS.map(m => describe(e.payments?.[`${m}`]));
      return `"${e.student?.name ?? ''}","${classLabel(e)}","${zoneName(e.zone_id) ?? ''}",${cells.map(c => `"${c}"`).join(",")}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'transport-enrollments.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/accountant/enrollment')}
            style={{ color: "var(--maroon)" }}>
            <ArrowLeft size={16} className="mr-2" /> Back to Enrollments
          </Button>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Transport</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Students are grouped by transport zone. Tick a month to record a full or partial payment from that zone's price.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-11" onClick={handleExport}
            style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
            <Download size={18} className="mr-2" /> Download
          </Button>
          <Button className="h-11" onClick={() => navigate('/accountant/class-lists')}
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            <Plus size={18} className="mr-2" /> Add Students (from Class Lists)
          </Button>
        </div>
      </div>

      {!loading && (zones.length === 0 ? (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold" style={{ color: "var(--dark-gray)" }}>No transport zones yet</p>
              <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
                Add each route under Zones. Students then appear under the zone you assign, the way feeding lists each class.
              </p>
            </div>
            <Button onClick={() => navigate("/accountant/zones")} style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              Manage zones
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zoneCards.map((card) => {
            const active = zoneFilter === card.id;
            const priceLabel = card.price == null ? null : `${Number(card.price).toLocaleString()} RWF`;
            return (
              <Card key={card.id} style={{ borderColor: active ? "var(--maroon)" : "var(--border)", borderWidth: active ? 2 : 1 }}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "color-mix(in srgb, var(--navy-blue) 13%, transparent)" }}>
                      <Bus size={28} style={{ color: "var(--navy-blue)" }} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold" style={{ color: "var(--dark-gray)" }}>{card.name}</h3>
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold text-white mt-1"
                        style={{ backgroundColor: active ? "var(--maroon)" : "var(--success-green)" }}>
                        {active ? "Viewing" : card.id === "none" ? "Unassigned" : "Zone"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: "var(--mid-gray)" }}>Students:</span>
                      <span className="font-semibold" style={{ color: "var(--dark-gray)" }}>{card.students}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: "var(--mid-gray)" }}>Paid:</span>
                      <span className="font-semibold" style={{ color: "var(--dark-gray)" }}>{card.paid}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm" style={{ color: "var(--mid-gray)" }}>Price:</span>
                      <span className="font-semibold" style={{ color: "var(--dark-gray)" }}>
                        {priceLabel ?? (card.id === "none" ? "—" : "All")}
                      </span>
                    </div>
                  </div>
                  <Button onClick={() => setZoneFilter(card.id)} className="w-full"
                    style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                    {active ? "Showing this zone" : "View students"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ))}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
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
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search student name..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={zoneFilter} onValueChange={setZoneFilter}>
              <SelectTrigger className="w-full md:w-52 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {zoneCards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-11" disabled={selectedInView.length === 0}
              onClick={() => setConfirmRemove(true)}
              style={{ borderColor: "var(--danger-red)", color: "var(--danger-red)" }}>
              <Trash2 size={16} className="mr-2" />
              Remove selected{selectedInView.length ? ` (${selectedInView.length})` : ""}
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Bus size={48} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
              <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No students in transport</p>
              <p className="text-sm mt-2 mb-4" style={{ color: "var(--mid-gray)" }}>
                Select students on a class list, then import them into transport.
              </p>
              <Button onClick={() => navigate('/accountant/class-lists')}
                style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                Go to Class Lists
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                  <TableRow>
                    <TableHead className="text-white w-16 sticky left-0 z-20" style={{ backgroundColor: "var(--navy-blue)" }}>
                      <div className="flex flex-col items-center gap-1">
                        <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} className="bg-white" aria-label="Select all students in view" />
                        <span className="text-[10px] font-semibold leading-none">Select</span>
                      </div>
                    </TableHead>
                    <TableHead className="text-white sticky left-16 z-10" style={{ backgroundColor: "var(--navy-blue)" }}>Name</TableHead>
                    <TableHead className="text-white">Zone</TableHead>
                    {MONTHS.map((m, i) => (
                      <TableHead key={m} className="text-white text-center">{MONTH_LABEL[i]} Month</TableHead>
                    ))}
                    <TableHead className="text-white text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e, index) => {
                    const showZoneHeader = zoneFilter === "all" && (index === 0 || zoneKey(filtered[index - 1]) !== zoneKey(e));
                    const zoneCount = filtered.filter((row) => zoneKey(row) === zoneKey(e)).length;
                    return (
                    <Fragment key={e.id}>
                    {showZoneHeader && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-2" style={{ backgroundColor: "#EEF1F6" }}>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--navy-blue)" }}>{zoneTitle(e)}</span>
                          <span className="text-xs ml-2" style={{ color: "var(--mid-gray)" }}>{zoneCount} student{zoneCount === 1 ? "" : "s"}</span>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                      <TableCell className="sticky left-0 z-20" style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                        <Checkbox checked={selectedIds.includes(e.id)} onCheckedChange={() => toggleOne(e.id)} aria-label={`Select ${e.student?.name ?? "student"} for removal`} />
                      </TableCell>
                      <TableCell className="font-medium sticky left-16 z-10"
                        style={{ color: "var(--dark-gray)", backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                        {e.student?.name ?? '—'}
                        {savingId === e.id && <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />}
                      </TableCell>
                      <TableCell>
                        <Select value={e.zone_id != null ? String(e.zone_id) : undefined} onValueChange={(v) => setZone(e, v)}>
                          <SelectTrigger className="w-36 h-9">
                            <SelectValue placeholder="Select zone" />
                          </SelectTrigger>
                          <SelectContent>
                            {zones.length === 0 ? (
                              <SelectItem value="__none" disabled>No zones</SelectItem>
                            ) : zones.map(z => (
                              <SelectItem key={z.id} value={String(z.id)}>{z.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      {MONTHS.map(m => {
                        const cell = e.payments?.[`${m}`];
                        const state = cellState(cell);
                        const title = !cell
                          ? (e.zone_id ? "Not paid" : "Assign a zone first")
                          : cell.kind === "partial"
                            ? `Partial · paid ${rwf(cell.amount_paid ?? 0)} · left ${rwf(cell.balance ?? 0)} · expires ${cell.expires_on}`
                            : cell.kind === "full"
                              ? `Full · ${rwf(cell.amount_paid ?? cell.full_amount ?? 0)} · expires ${cell.expires_on}`
                              : `Paid ${cell.paid_on} · expires ${cell.expires_on}`;
                        return (
                          <TableCell key={m} className="text-center">
                            <div className="flex flex-col items-center gap-0.5" title={title}>
                              <Checkbox
                                checked={!!cell}
                                disabled={!e.zone_id}
                                onCheckedChange={() => onToggle(e, m)}
                              />
                              {cell?.kind === "partial" && (
                                <span className="text-[10px] font-semibold leading-none" style={{ color: "var(--warning-amber)" }}>P</span>
                              )}
                              {cell?.kind === "full" && (
                                <span className="text-[10px] font-semibold leading-none" style={{ color: STATE_COLOR[state] }}>F</span>
                              )}
                              {cell && !cell.kind && (
                                <span className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: STATE_COLOR[state] }} />
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-red-600" onClick={() => handleWaive(e)}>
                              Remove from Transport
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && (
            <p className="text-sm mt-3" style={{ color: "var(--mid-gray)" }}>
              {filtered.length} student{filtered.length !== 1 ? 's' : ''} in transport
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payment date dialog */}
      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>{payTarget?.label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Payment Date</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="mt-2 h-11" />
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={payMonths} onValueChange={setPayMonths}>
                <SelectTrigger className="w-full h-11 mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map(o => (
                    <SelectItem key={o.months} value={String(o.months)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--light-gray)" }}>
              <p className="text-xs" style={{ color: "var(--mid-gray)" }}>
                {payTarget ? (zoneName(payTarget.e.zone_id) ?? "Zone") : "Zone"} · {payMonths} month{payMonths === "1" ? "" : "s"}
              </p>
              <p className="text-lg font-semibold mt-1" style={{ color: "var(--dark-gray)" }}>{rwf(fullAmount)}</p>
              <p className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>
                {rwf(unitPrice)} × {payMonths}
              </p>
            </div>
            <div>
              <Label>Payment</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(["full", "partial"] as const).map(kind => (
                  <button key={kind} type="button" onClick={() => setPayKind(kind)}
                    className="h-11 rounded-md border text-sm font-medium"
                    style={{
                      borderColor: payKind === kind ? "var(--maroon)" : "var(--border)",
                      backgroundColor: payKind === kind ? "var(--maroon)" : "#FFFFFF",
                      color: payKind === kind ? "#FFFFFF" : "var(--dark-gray)",
                    }}>
                    {kind === "full" ? "Full payment" : "Partial payment"}
                  </button>
                ))}
              </div>
            </div>
            {payKind === "partial" && (
              <div>
                <Label>Amount paid (RWF)</Label>
                <Input type="number" min={1} max={fullAmount} step="1" inputMode="decimal"
                  value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                  placeholder={`Up to ${fullAmount}`} className="mt-2 h-11" />
                {amountPaid !== "" && paidNumber > fullAmount && (
                  <p className="text-sm mt-2" style={{ color: "var(--danger-red)" }}>
                    Amount paid cannot exceed {rwf(fullAmount)}.
                  </p>
                )}
                {paidNumber > 0 && paidNumber <= fullAmount && (
                  <p className="text-sm mt-2" style={{ color: "var(--dark-gray)" }}>
                    Left to pay: <strong>{rwf(balance)}</strong>
                  </p>
                )}
              </div>
            )}
            {payDate && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: "#F0FDF4" }}>
                <p className="text-sm" style={{ color: "var(--success-green)" }}>
                  Paid <strong>{fmtLocal(payDate)}</strong> → expires <strong>{fmtLocal(addMonths(payDate, +payMonths))}</strong>
                </p>
                <p className="text-xs mt-1" style={{ color: "#15803D" }}>
                  {payKind === "full"
                    ? `${rwf(fullAmount)} recorded in full.`
                    : paidNumber > 0 && paidNumber <= fullAmount
                      ? `${rwf(paidNumber)} received · ${rwf(balance)} left.`
                      : "Enter the amount received."}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button onClick={confirmPayment} disabled={!payDate || partialInvalid}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              Save Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove selected students</DialogTitle>
            <DialogDescription>
              {selectedInView.length} student{selectedInView.length === 1 ? "" : "s"} will be removed from transport.
              Their payment history stays archived.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRemove(false)} disabled={removing}>Cancel</Button>
            <Button onClick={removeSelected} disabled={removing || selectedInView.length === 0}
              style={{ backgroundColor: "var(--danger-red)", color: "#FFFFFF" }}>
              {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove {selectedInView.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
