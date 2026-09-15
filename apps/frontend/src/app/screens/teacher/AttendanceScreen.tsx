import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Loader2, Check, X, Clock, Save, Users, Lock, RotateCcw, History } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../components/ui/dialog";
import { api } from "../../../lib/api";
import { toast } from "sonner";

type Status = "present" | "absent" | "late";

interface AttendanceRow {
  student_id: number;
  name: string;
  rank: number | null;
  status: Status;
}

const STATUS_META: Record<Status, { label: string; color: string; Icon: any }> = {
  present: { label: "Present", color: "var(--success-green)", Icon: Check },
  absent:  { label: "Absent",  color: "var(--danger-red)", Icon: X },
  late:    { label: "Late",    color: "var(--warning-amber)", Icon: Clock },
};

export function AttendanceScreen() {
  const { classId } = useParams<{ classId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const className = searchParams.get("name") ?? `Class ${classId}`;

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(searchParams.get("date") || today);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);

  const load = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/api/v1/academics/classes/${classId}/attendance?date=${date}`);
      setRows(res.records ?? []);
      setLocked(!!res.locked);
      setSubmittedAt(res.submitted_at ?? null);
    } catch {
      toast.error("Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => { load(); }, [load]);

  const setStatus = (studentId: number, status: Status) => {
    if (locked) return;
    setRows(rs => rs.map(r => r.student_id === studentId ? { ...r, status } : r));
  };
  const markAll = (status: Status) => {
    if (locked) return;
    setRows(rs => rs.map(r => ({ ...r, status })));
  };

  const counts = {
    present: rows.filter(r => r.status === "present").length,
    absent: rows.filter(r => r.status === "absent").length,
    late: rows.filter(r => r.status === "late").length,
  };

  const handleSave = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/academics/classes/${classId}/attendance`, {
        date,
        records: rows.map(r => ({ student_id: r.student_id, status: r.status })),
      });
      toast.success(`Attendance submitted to the Dean · ${counts.present} present, ${counts.absent} absent, ${counts.late} late`);
      setLocked(true);
      setSubmittedAt(new Date().toISOString());
    } catch (err: any) {
      toast.error(err.message ?? "Failed to submit attendance");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      await api.post(`/api/v1/academics/classes/${classId}/attendance/reset`, { date });
      toast.success("Attendance reset — you can record it again");
      setShowReset(false);
      setLocked(false);
      setSubmittedAt(null);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reset");
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back to Dashboard
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/attendance-history")}
          style={{ color: "var(--navy-blue)" }}>
          <History size={16} className="mr-2" /> Attendance History
        </Button>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
            {className} — Attendance
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>{fmtDate(date)}</p>
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--mid-gray)" }}>Date</label>
          <Input type="date" value={date} max={today}
            onChange={e => setDate(e.target.value)} className="h-11 w-44" />
        </div>
      </div>

      {/* Locked banner */}
      {locked && (
        <Card style={{ borderColor: "var(--success-green)", backgroundColor: "#F0FDF4" }}>
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <Lock size={20} style={{ color: "var(--success-green)" }} />
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--success-green)" }}>
                  Submitted &amp; sent to the Dean
                </p>
                <p className="text-xs" style={{ color: "#15803D" }}>
                  This day is locked. Made a mistake? Reset to record it again.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setShowReset(true)}
              style={{ color: "var(--danger-red)", borderColor: "var(--danger-red)" }}>
              <RotateCcw size={16} className="mr-2" /> Reset
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {(["present", "absent", "late"] as Status[]).map(s => {
          const meta = STATUS_META[s];
          return (
            <Card key={s} style={{ borderColor: "var(--border)" }}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>{meta.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>
                    {loading ? "—" : counts[s]}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}>
                  <meta.Icon size={20} style={{ color: meta.color }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12">
              <Users size={44} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
              <p className="font-semibold" style={{ color: "var(--dark-gray)" }}>No students in this class</p>
            </div>
          ) : (
            <>
              {!locked && (
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <span className="text-sm" style={{ color: "var(--mid-gray)" }}>{rows.length} students</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => markAll("present")}
                      style={{ color: "var(--success-green)", borderColor: "var(--success-green)" }}>
                      Mark all present
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => markAll("absent")}
                      style={{ color: "var(--danger-red)", borderColor: "var(--danger-red)" }}>
                      Mark all absent
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {rows.map((r, index) => (
                  <div key={r.student_id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ borderColor: "var(--border)", backgroundColor: index % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                    <span className="text-sm w-6 flex-shrink-0" style={{ color: "var(--mid-gray)" }}>{index + 1}</span>
                    <span className="flex-1 font-medium min-w-0 truncate" style={{ color: "var(--dark-gray)" }}>
                      {r.name}
                    </span>
                    <div className="inline-flex rounded-lg border overflow-hidden flex-shrink-0"
                      style={{ borderColor: "var(--border)", opacity: locked ? 0.85 : 1 }}>
                      {(["present", "absent", "late"] as Status[]).map(s => {
                        const meta = STATUS_META[s];
                        const active = r.status === s;
                        return (
                          <button key={s} onClick={() => setStatus(r.student_id, s)} disabled={locked}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed"
                            style={{
                              backgroundColor: active ? meta.color : "#FFFFFF",
                              color: active ? "#FFFFFF" : "var(--mid-gray)",
                            }}>
                            <meta.Icon size={14} />
                            <span className="hidden sm:inline">{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && !loading && !locked && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="h-11"
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save size={18} className="mr-2" />}
            Submit Attendance
          </Button>
        </div>
      )}

      {/* Reset confirmation */}
      <Dialog open={showReset} onOpenChange={setShowReset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset this day's attendance?</DialogTitle>
            <DialogDescription>
              This clears the submitted attendance for {fmtDate(date)} so you can record it again.
              The Dean will be notified of the correction.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowReset(false)}>Cancel</Button>
            <Button onClick={handleReset} disabled={saving}
              style={{ backgroundColor: "var(--danger-red)", color: "#FFFFFF" }}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw size={16} className="mr-2" />}
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
