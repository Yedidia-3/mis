import { ArrowRight, Check, ClipboardCheck, Clock, GraduationCap, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

interface Summary {
  classes: number;
  students: number;
  present: number;
  absent: number;
  late: number;
  classes_marked: number;
  classes_pending: number;
}

export function TeacherDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/academics/teacher/today-summary');
      setSummary(res?.data ?? res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const firstName = (user?.name ?? "Teacher").split(" ")[0];
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const s = summary;

  const stats = [
    { label: "My Classes", value: s?.classes ?? 0, icon: GraduationCap, color: "var(--navy-blue)" },
    { label: "Total Students", value: s?.students ?? 0, icon: Users, color: "var(--maroon)" },
    { label: "Present Today", value: s?.present ?? 0, icon: Check, color: "var(--success-green)" },
    { label: "Absent Today", value: s?.absent ?? 0, icon: X, color: "var(--danger-red)" },
  ];

  // A friendly headline insight
  const insight = (() => {
    if (!s) return "";
    if (s.classes === 0) return "No classes assigned yet — the Dean will distribute your class soon.";
    if (s.classes_pending > 0) return `You still have ${s.classes_pending} class${s.classes_pending !== 1 ? 'es' : ''} to mark today.`;
    if (s.absent > 0) return `${s.absent} student${s.absent !== 1 ? 's were' : ' was'} absent today across your classes.`;
    return "All present today — great attendance!";
  })();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="rounded-xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--navy-blue) 0%, var(--navy-light) 100%)" }}>
        <div className="absolute right-0 top-0 w-40 h-40 rounded-full opacity-10"
          style={{ backgroundColor: "var(--gold)", transform: "translate(30%, -30%)" }} />
        <h2 className="text-2xl font-bold relative z-10">Welcome back, {firstName} 👋</h2>
        <p className="mt-1 relative z-10" style={{ color: "rgba(255,255,255,0.75)" }}>{todayLabel}</p>
        {!loading && <p className="mt-3 text-sm relative z-10" style={{ color: "rgba(255,255,255,0.9)" }}>{insight}</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} style={{ borderColor: "var(--border)" }}>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>{stat.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>
                    {loading ? "—" : stat.value}
                  </p>
                </div>
                <div className="w-11 h-11 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 13%, transparent)` }}>
                  <Icon size={22} style={{ color: stat.color }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Today's attendance progress */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "color-mix(in srgb, var(--gold) 13%, transparent)" }}>
                <ClipboardCheck size={22} style={{ color: "var(--gold)" }} />
              </div>
              <div>
                <p className="font-semibold" style={{ color: "var(--dark-gray)" }}>Today's Attendance</p>
                {loading ? (
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Loading…</p>
                ) : (
                  <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
                    {s?.classes_marked ?? 0} of {s?.classes ?? 0} classes marked
                    {(s?.late ?? 0) > 0 && (
                      <span> · <Clock size={12} className="inline" style={{ color: "var(--warning-amber)" }} /> {s?.late} late</span>
                    )}
                  </p>
                )}
              </div>
            </div>
            <Button onClick={() => navigate("/teacher/my-classes")}
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              Go to My Classes <ArrowRight size={16} className="ml-2" />
            </Button>
          </div>

          {/* progress bar */}
          {!loading && (s?.classes ?? 0) > 0 && (
            <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--light-gray)" }}>
              <div className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.round(((s?.classes_marked ?? 0) / (s?.classes || 1)) * 100)}%`,
                  backgroundColor: (s?.classes_pending ?? 0) === 0 ? "var(--success-green)" : "var(--warning-amber)",
                }} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timetable feature removed */}
    </div>
  );
}
