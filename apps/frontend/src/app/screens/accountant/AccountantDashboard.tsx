import { useState, useEffect, useCallback } from "react";
import { Users, Utensils, Bus, AlertCircle, Wallet, BadgeCheck, ArrowRight } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";

interface Enrollment {
  id: number;
  type: 'feeding' | 'transport';
  student_id: number;
  expiry_date: string;
  payments?: Record<string, any>;
  student: { id: number; name: string } | null;
}

export function AccountantDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [feeding, setFeeding] = useState<Enrollment[]>([]);
  const [transport, setTransport] = useState<Enrollment[]>([]);
  const [expiring, setExpiring] = useState<Enrollment[]>([]);
  const [classCount, setClassCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const years = await api.get<any>('/api/v1/academics/academic-years').catch(() => []);
      const yearList = Array.isArray(years) ? years : years.data ?? [];
      const active = yearList.find((y: any) => y.status === 'active');

      const [f, t, e, classes] = await Promise.all([
        api.get<any>('/api/v1/accountant/enrollments?type=feeding').catch(() => []),
        api.get<any>('/api/v1/accountant/enrollments?type=transport').catch(() => []),
        api.get<any>('/api/v1/accountant/enrollments/expiring?days=3').catch(() => []),
        active ? api.get<any>(`/api/v1/academics/all-classes?academic_year_id=${active.id}`).catch(() => []) : Promise.resolve([]),
      ]);
      setFeeding(Array.isArray(f) ? f : f.data ?? []);
      setTransport(Array.isArray(t) ? t : t.data ?? []);
      setExpiring(Array.isArray(e) ? e : e.data ?? []);
      const classList = Array.isArray(classes) ? classes : classes.data ?? [];
      setClassCount(classList.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const all = [...feeding, ...transport];
  const totalEnrolled = all.length;
  const hasPaid = (en: Enrollment) => en.payments && Object.keys(en.payments).length > 0;
  const studentsPaid = new Set(all.filter(hasPaid).map(en => en.student_id)).size;
  const unpaid = new Set(all.filter(en => !hasPaid(en)).map(en => en.student_id)).size;
  const expiringSoon = expiring.length;
  const today = new Date().toISOString().split('T')[0];
  const expiringToday = expiring.filter(e => e.expiry_date === today).length;

  const firstName = (user?.name ?? "Accountant").split(" ")[0];

  const stats = [
    { label: "Total Enrolled", value: totalEnrolled, sub: `${feeding.length} feeding · ${transport.length} transport`, icon: Users, color: "var(--navy-blue)" },
    { label: "Students Paid", value: studentsPaid, sub: `${unpaid} not yet paid`, icon: BadgeCheck, color: "var(--success-green)" },
    { label: "Expiring (3 days)", value: expiringSoon, sub: expiringToday > 0 ? `${expiringToday} today` : "none today", icon: AlertCircle, color: "var(--warning-amber)" },
    { label: "Class Lists", value: classCount, sub: "available", icon: Wallet, color: "var(--maroon)" },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="rounded-xl p-6 text-white relative overflow-hidden"
        style={{ background: "linear-gradient(120deg, var(--navy-blue) 0%, var(--navy-light) 100%)" }}>
        <div className="absolute right-0 top-0 w-40 h-40 rounded-full opacity-10"
          style={{ backgroundColor: "var(--gold)", transform: "translate(30%, -30%)" }} />
        <h2 className="text-2xl font-bold relative z-10">Welcome, {firstName}</h2>
        <p className="mt-1 relative z-10" style={{ color: "rgba(255,255,255,0.8)" }}>
          {expiringSoon > 0
            ? `${expiringSoon} subscription${expiringSoon !== 1 ? 's' : ''} expiring within 3 days — consider sending reminders`
            : "No subscriptions expiring soon — finances are on track"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} style={{ borderColor: "var(--border)" }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm" style={{ color: "var(--mid-gray)" }}>{stat.label}</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>
                      {loading ? "—" : stat.value}
                    </p>
                    <p className="text-xs mt-1 truncate" style={{ color: "var(--mid-gray)" }}>{stat.sub}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 13%, transparent)` }}>
                    <Icon size={24} style={{ color: stat.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Service breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--navy-blue) 13%, transparent)" }}>
                <Utensils size={20} style={{ color: "var(--navy-blue)" }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: "var(--dark-gray)" }}>School Feeding</p>
                <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
                  {feeding.filter(hasPaid).length} paid · {feeding.length} enrolled
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/accountant/enrollment/feeding")}
                style={{ color: "var(--maroon)" }}>Open <ArrowRight size={14} className="ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 13%, transparent)" }}>
                <Bus size={20} style={{ color: "var(--maroon)" }} />
              </div>
              <div className="flex-1">
                <p className="font-semibold" style={{ color: "var(--dark-gray)" }}>Transport</p>
                <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
                  {transport.filter(hasPaid).length} paid · {transport.length} enrolled
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/accountant/enrollment/transport")}
                style={{ color: "var(--maroon)" }}>Open <ArrowRight size={14} className="ml-1" /></Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--dark-gray)" }}>Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Class Lists", icon: Users, path: "/accountant/class-lists" },
            { label: "Feeding", icon: Utensils, path: "/accountant/enrollment/feeding" },
            { label: "Transport", icon: Bus, path: "/accountant/enrollment/transport" },
            { label: "Communiqué", icon: AlertCircle, path: "/accountant/communique" },
          ].map(({ label, icon: Icon, path }) => (
            <Button key={label} onClick={() => navigate(path)}
              className="h-20 flex flex-col items-center justify-center gap-2 bg-white"
              variant="outline" style={{ borderColor: "var(--border)" }}>
              <Icon size={24} style={{ color: "var(--gold)" }} />
              <span style={{ color: "var(--dark-gray)" }}>{label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
