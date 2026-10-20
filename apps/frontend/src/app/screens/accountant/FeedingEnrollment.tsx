import { ArrowLeft, Download, Loader2, MoreVertical, Plus, Search, Utensils } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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

interface FeedingPrices { breakfast: number; lunch: number; }

interface Enrollment {
  id: number;
  student_id: number;
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
const MEALS: { key: "B" | "L"; label: string }[] = [
  { key: "B", label: "B" },
  { key: "L", label: "L" },
];

function classLabel(e: Enrollment): string {
  const cc = e.student?.current_class;
  if (!cc) return "—";
  return `${cc.p_level?.name ?? ""}${cc.name}`;
}
function pLevelName(e: Enrollment): string {
  return e.student?.current_class?.p_level?.name ?? "";
}

export function FeedingEnrollment() {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [pLevelFilter, setPLevelFilter] = useState<string>("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [prices, setPrices] = useState<FeedingPrices>({ breakfast: 0, lunch: 0 });
  const [priceDraft, setPriceDraft] = useState<{ breakfast: string; lunch: string }>({ breakfast: "", lunch: "" });
  const [savingPrices, setSavingPrices] = useState(false);

  // Payment dialog (opens when ticking an unpaid box)
  const [payTarget, setPayTarget] = useState<{ e: Enrollment; key: string; label: string; meal: "B" | "L" } | null>(null);
  const [payDate, setPayDate] = useState("");
  const [payMonths, setPayMonths] = useState<string>("1");
  const [payKind, setPayKind] = useState<"full" | "partial">("full");
  const [amountPaid, setAmountPaid] = useState("");

  const load = useCallback(async () => {
    try {
      const [res, priceRes] = await Promise.all([
        api.get<any>('/api/v1/accountant/enrollments?type=feeding'),
        api.get<FeedingPrices>('/api/v1/accountant/feeding-prices').catch(() => ({ breakfast: 0, lunch: 0 })),
      ]);
      setEnrollments(Array.isArray(res) ? res : res.data ?? []);
      const nextPrices = {
        breakfast: Number(priceRes?.breakfast) || 0,
        lunch: Number(priceRes?.lunch) || 0,
      };
      setPrices(nextPrices);
      setPriceDraft({
        breakfast: nextPrices.breakfast ? String(nextPrices.breakfast) : "",
        lunch: nextPrices.lunch ? String(nextPrices.lunch) : "",
      });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  // Distinct P-levels and classes for the filter dropdowns
  const pLevels = Array.from(new Set(enrollments.map(pLevelName).filter(Boolean))).sort();
  const classesForFilter = Array.from(
    new Set(
      enrollments
        .filter(e => pLevelFilter === "all" || pLevelName(e) === pLevelFilter)
        .map(classLabel)
        .filter(c => c !== "—")
    )
  ).sort();

  const filtered = enrollments.filter(e => {
    const matchSearch = (e.student?.name ?? "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchPLevel = pLevelFilter === "all" || pLevelName(e) === pLevelFilter;
    const matchClass = classFilter === "all" || classLabel(e) === classFilter;
    return matchSearch && matchPLevel && matchClass;
  });

  const today = new Date();
  const soonCutoff = new Date(); soonCutoff.setDate(today.getDate() + 5);
  const paymentCells = filtered.flatMap((e) => Object.values(e.payments ?? {}));
  const unpaidCount = filtered.filter((e) => Object.keys(e.payments ?? {}).length === 0).length;
  const dueSoonCount = paymentCells.filter((cell) => {
    if (!cell?.expires_on) return false;
    const expiry = new Date(`${cell.expires_on}T00:00:00`);
    return expiry >= today && expiry <= soonCutoff;
  }).length;
  const expiredCount = paymentCells.filter((cell) => cell?.expires_on && new Date(`${cell.expires_on}T00:00:00`) < today).length;

  const stats = [
    { label: 'Enrolled', value: filtered.length, note: 'students in view' },
    { label: 'Not Yet Paid', value: unpaidCount, note: 'no payment recorded' },
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

  const savePrices = async () => {
    const breakfast = roundMoney(Number(priceDraft.breakfast || 0));
    const lunch = roundMoney(Number(priceDraft.lunch || 0));
    if (breakfast < 0 || lunch < 0 || Number.isNaN(breakfast) || Number.isNaN(lunch)) {
      toast.error('Enter a valid amount for each meal.');
      return;
    }
    setSavingPrices(true);
    try {
      const saved = await api.put<FeedingPrices>('/api/v1/accountant/feeding-prices', { breakfast, lunch });
      const next = { breakfast: Number(saved.breakfast) || 0, lunch: Number(saved.lunch) || 0 };
      setPrices(next);
      setPriceDraft({
        breakfast: next.breakfast ? String(next.breakfast) : "",
        lunch: next.lunch ? String(next.lunch) : "",
      });
      toast.success('Meal prices saved. New ticks will load these amounts.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save prices');
    } finally {
      setSavingPrices(false);
    }
  };

  const onToggle = (e: Enrollment, month: number, meal: "B" | "L") => {
    const key = `${month}${meal}`;
    if (e.payments?.[key]) {
      const next = { ...e.payments };
      delete next[key];
      savePayments(e, next);
    } else {
      const unit = meal === "B" ? prices.breakfast : prices.lunch;
      if (!(unit > 0)) {
        toast.error(`Set the ${meal === "B" ? "breakfast" : "lunch"} price first.`);
        return;
      }
      setPayTarget({
        e, key, meal,
        label: `${e.student?.name ?? ''} · Month ${month} ${meal === 'B' ? 'Breakfast' : 'Lunch'}`,
      });
      setPayDate(new Date().toISOString().split('T')[0]);
      setPayMonths("1");
      setPayKind("full");
      setAmountPaid("");
    }
  };

  const unitPrice = payTarget ? (payTarget.meal === "B" ? prices.breakfast : prices.lunch) : 0;
  const fullAmount = roundMoney(unitPrice * (+payMonths || 1));
  const paidNumber = roundMoney(Number(amountPaid));
  const partialInvalid = payKind === "partial" && (!(paidNumber > 0) || paidNumber > fullAmount);
  const balance = payKind === "partial" && paidNumber > 0 && paidNumber <= fullAmount
    ? roundMoney(fullAmount - paidNumber)
    : 0;

  const confirmPayment = () => {
    if (!payTarget || !payDate || partialInvalid || !(unitPrice > 0)) return;
    const months = +payMonths;
    // Omit the price snapshot so the server loads the saved meal price.
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

  const handleWaive = async (e: Enrollment) => {
    try {
      await api.delete(`/api/v1/accountant/enrollments/${e.id}`);
      toast.success(`${e.student?.name ?? 'Student'} removed from feeding`);
      load();
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove');
    }
  };

  const handleExport = () => {
    const header = "Name,Class," + MONTHS.flatMap(m => [`M${m} Breakfast`, `M${m} Lunch`]).join(",") + "\n";
    const rows = filtered.map(e => {
      const describe = (cell?: PaymentCell) => {
        if (!cell?.expires_on) return "";
        if (cell.kind === "partial") return `partial paid ${cell.amount_paid ?? ""} left ${cell.balance ?? ""} exp ${cell.expires_on}`;
        if (cell.kind === "full") return `full ${cell.full_amount ?? ""} exp ${cell.expires_on}`;
        return `exp ${cell.expires_on}`;
      };
      const cells = MONTHS.flatMap(m => [describe(e.payments?.[`${m}B`]), describe(e.payments?.[`${m}L`])]);
      return `"${e.student?.name ?? ''}","${classLabel(e)}",${cells.map(c => `"${c}"`).join(",")}`;
    }).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'feeding-enrollments.csv'; a.click();
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
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>School Feeding</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Tick Breakfast (B) and Lunch (L). Each tick loads the price saved below.
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

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-5">
          <p className="font-semibold" style={{ color: "var(--dark-gray)" }}>Meal prices</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--mid-gray)" }}>
            Set these once. A breakfast tick loads the breakfast amount, a lunch tick loads the lunch amount, multiplied by the months selected.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <div>
              <Label>Breakfast (RWF)</Label>
              <Input type="number" min={0} step="1" inputMode="decimal" placeholder="Not set"
                value={priceDraft.breakfast}
                onChange={e => setPriceDraft(d => ({ ...d, breakfast: e.target.value }))}
                className="mt-2 h-11" />
            </div>
            <div>
              <Label>Lunch (RWF)</Label>
              <Input type="number" min={0} step="1" inputMode="decimal" placeholder="Not set"
                value={priceDraft.lunch}
                onChange={e => setPriceDraft(d => ({ ...d, lunch: e.target.value }))}
                className="mt-2 h-11" />
            </div>
            <Button className="h-11" onClick={savePrices} disabled={savingPrices}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {savingPrices ? <Loader2 className="animate-spin" size={18} /> : "Save prices"}
            </Button>
          </div>
          {(!(prices.breakfast > 0) || !(prices.lunch > 0)) && (
            <p className="text-sm mt-3" style={{ color: "var(--warning-amber)" }}>
              {!(prices.breakfast > 0) && !(prices.lunch > 0)
                ? "Both prices are still empty, so payment ticks stay locked."
                : !(prices.breakfast > 0)
                  ? "Breakfast is not priced yet. Lunch ticks can be recorded."
                  : "Lunch is not priced yet. Breakfast ticks can be recorded."}
            </p>
          )}
        </CardContent>
      </Card>

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
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3 mb-6">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search student name..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={pLevelFilter} onValueChange={(v) => { setPLevelFilter(v); setClassFilter("all"); }}>
              <SelectTrigger className="w-full md:w-44 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All P-Levels</SelectItem>
                {pLevels.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full md:w-44 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classesForFilter.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Utensils size={48} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
              <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No students in feeding</p>
              <p className="text-sm mt-2 mb-4" style={{ color: "var(--mid-gray)" }}>
                Import students from <strong>Class Lists</strong> → toggle a P-Level → "Import to Feeding".
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
                    <TableHead className="text-white sticky left-0" style={{ backgroundColor: "var(--navy-blue)" }}>Name</TableHead>
                    <TableHead className="text-white">Class</TableHead>
                    {MONTHS.map(m => (
                      <TableHead key={m} className="text-white text-center" colSpan={2}>
                        {m === 1 ? "1st" : m === 2 ? "2nd" : m === 3 ? "3rd" : "4th"} Month
                      </TableHead>
                    ))}
                    <TableHead className="text-white text-right">Actions</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="sticky left-0" style={{ backgroundColor: "var(--navy-blue)" }}></TableHead>
                    <TableHead></TableHead>
                    {MONTHS.map(m => MEALS.map(meal => (
                      <TableHead key={`${m}${meal.key}`} className="text-white text-center text-xs">{meal.label}</TableHead>
                    )))}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e, index) => (
                    <TableRow key={e.id} style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                      <TableCell className="font-medium sticky left-0"
                        style={{ color: "var(--dark-gray)", backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                        {e.student?.name ?? '—'}
                        {savingId === e.id && <Loader2 className="inline ml-2 h-3 w-3 animate-spin" />}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs font-semibold text-white"
                          style={{ backgroundColor: "var(--navy-blue)" }}>{classLabel(e)}</span>
                      </TableCell>
                      {MONTHS.map(m => MEALS.map(meal => {
                        const key = `${m}${meal.key}`;
                        const cell = e.payments?.[key];
                        const state = cellState(cell);
                        const title = !cell
                          ? "Not paid"
                          : cell.kind === "partial"
                            ? `Partial · paid ${rwf(cell.amount_paid ?? 0)} · left ${rwf(cell.balance ?? 0)} · expires ${cell.expires_on}`
                            : cell.kind === "full"
                              ? `Full · ${rwf(cell.amount_paid ?? cell.full_amount ?? 0)} · expires ${cell.expires_on}`
                              : `Paid ${cell.paid_on} · expires ${cell.expires_on}`;
                        return (
                          <TableCell key={key} className="text-center">
                            <div className="flex flex-col items-center gap-0.5" title={title}>
                              <Checkbox
                                checked={!!cell}
                                onCheckedChange={() => onToggle(e, m, meal.key)}
                              />
                              {cell?.kind === "partial" && (
                                <span className="text-[10px] font-semibold leading-none" style={{ color: "var(--warning-amber)" }}>P</span>
                              )}
                              {cell?.kind === "full" && (
                                <span className="text-[10px] font-semibold leading-none" style={{ color: STATE_COLOR[state] }}>F</span>
                              )}
                              {cell && !cell.kind && (
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATE_COLOR[state] }} />
                              )}
                            </div>
                          </TableCell>
                        );
                      }))}
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm"><MoreVertical size={16} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-red-600" onClick={() => handleWaive(e)}>
                              Remove from Feeding
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
          {!loading && (
            <p className="text-sm mt-3" style={{ color: "var(--mid-gray)" }}>
              {filtered.length} student{filtered.length !== 1 ? 's' : ''} in feeding
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
                {payTarget?.meal === "L" ? "Lunch" : "Breakfast"} · {payMonths} month{payMonths === "1" ? "" : "s"}
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
    </div>
  );
}
