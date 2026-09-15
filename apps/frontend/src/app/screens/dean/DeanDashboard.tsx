import { useEffect, useState, useCallback } from "react";
import { GraduationCap, Users, CheckCircle, Share2, Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";
import { pLevelStatus } from "../../../lib/plevelStatus";

interface AcademicYear { id: number; name: string; status: string; }
interface PLevel { id: number; name: string; status: string; classes: { id: number; students?: any[]; student_count?: number }[]; student_count?: number; }
interface ShuffleSession { id: number; status: string; p_level: { id: number; name: string }; student_count?: number; }

const statusColor: Record<string, string> = {
  distributed: "var(--success-green)",
  approved: "var(--success-green)",
  pending_approval: "var(--warning-amber)",
  in_progress: "var(--gold)",
  active: "var(--navy-blue)",
  rejected: "var(--danger-red)",
};

const statusLabel: Record<string, string> = {
  distributed: "Distributed",
  approved: "Approved",
  pending_approval: "Pending Approval",
  in_progress: "In Progress",
  active: "Active",
  rejected: "Rejected",
};

export function DeanDashboard() {
  const navigate = useNavigate();
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [pLevels, setPLevels] = useState<PLevel[]>([]);
  const [sessions, setSessions] = useState<ShuffleSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const years = await api.get<any>('/api/v1/academics/academic-years');
      const yearList: AcademicYear[] = Array.isArray(years) ? years : years.data ?? [];
      const active = yearList.find(y => y.status === 'active') ?? null;
      setActiveYear(active);
      if (active) {
        const [pl, sess] = await Promise.all([
          api.get<any>(`/api/v1/academics/p-levels?academic_year_id=${active.id}`),
          // Dean-accessible: every shuffle session with its live status
          api.get<any>('/api/v1/academics/shuffle/sessions').catch(() => []),
        ]);
        setPLevels(Array.isArray(pl) ? pl : pl.data ?? []);
        setSessions(Array.isArray(sess) ? sess : sess.data ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const totalStudents = pLevels.reduce((sum, pl) =>
    sum + (pl.student_count ?? pl.classes?.reduce((s, c) => s + (c.student_count ?? c.students?.length ?? 0), 0) ?? 0), 0);
  const pendingCount     = sessions.filter(s => s.status === 'pending_approval').length;
  const approvedCount    = sessions.filter(s => s.status === 'approved').length;
  const distributedCount = sessions.filter(s => s.status === 'distributed').length;

  const stats = [
    { label: "Total P-Levels", value: loading ? "—" : String(pLevels.length), icon: GraduationCap, color: "var(--navy-blue)" },
    { label: "Pending Approval", value: loading ? "—" : String(pendingCount), icon: CheckCircle, color: "var(--warning-amber)" },
    { label: "Ready / Distributed", value: loading ? "—" : String(approvedCount + distributedCount), icon: Share2, color: "var(--success-green)" },
    { label: "Total Students", value: loading ? "—" : String(totalStudents), icon: Users, color: "var(--maroon)" },
  ];

  return (
    <div className="space-y-6">
      {activeYear && (
        <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Academic Year: <strong style={{ color: "var(--dark-gray)" }}>{activeYear.name}</strong></p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="interactive-card border-black/[0.06] shadow-xs">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                    <p className="text-3xl font-bold mt-2 tabular-nums tracking-tight" style={{ color: "var(--dark-gray)" }}>{stat.value}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform active:scale-95"
                    style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 12%, transparent)` }}>
                    <Icon size={22} style={{ color: stat.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-muted-foreground" size={32} />
        </div>
      ) : (
        <>
          {pLevels.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold tracking-[-0.015em]" style={{ color: "var(--dark-gray)" }}>P-Level Overview</h3>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{pLevels.length} active level{pLevels.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid gap-2.5">
                {pLevels.map((pl) => {
                  const status = pLevelStatus(pl as any);
                  return (
                    <div key={pl.id} className="group flex items-center justify-between p-4 rounded-xl border border-black/[0.06] bg-card hover:bg-black/[0.015] transition-all shadow-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-base font-bold tracking-tight" style={{ color: "var(--dark-gray)" }}>{pl.name}</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: status.bg, color: status.color }}>
                          {status.label}
                        </span>
                      </div>
                      <Button variant="outline" size="sm"
                        onClick={() => navigate(`/dean/p-levels/${pl.id}/classes`)}
                        style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}
                        className="rounded-lg font-medium text-xs h-8 px-3">
                        Manage
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <Button onClick={() => navigate("/dean/import")} className="h-20 rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm"
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              <span className="text-base font-semibold">Import Excel Data</span>
              <span className="text-xs font-normal opacity-85">Upload student rosters from spreadsheet</span>
            </Button>
            <Button onClick={() => navigate("/dean/p-levels")} className="h-20 rounded-2xl flex flex-col items-center justify-center gap-1" variant="outline"
              style={{ color: "var(--navy-blue)", borderColor: "var(--navy-blue)" }}>
              <span className="text-base font-semibold">Manage P-Levels</span>
              <span className="text-xs font-normal opacity-85">Configure primary levels and classroom sections</span>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
