import { useEffect, useState } from "react";
import { Users, UserCheck, Calendar, Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router";
import { api } from "../../../lib/api";

interface UserRow { id: number; name: string; role: string; status: string; last_login: string | null; }
interface AcademicYear { id: number; name: string; status: string; }

function timeAgo(date: string | null) {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<any>('/api/v1/admin/users'),
      api.get<any>('/api/v1/admin/academic-years'),
    ]).then(([u, y]) => {
      setUsers(Array.isArray(u) ? u : u.data ?? []);
      setYears(Array.isArray(y) ? y : y.data ?? []);
    }).finally(() => setLoading(false));
  }, []);

  const activeYear = years.find(y => y.status === 'active');
  const activeUsers = users.filter(u => u.status === 'active').length;
  const recentLogins = users
    .filter(u => u.last_login)
    .sort((a, b) => new Date(b.last_login!).getTime() - new Date(a.last_login!).getTime())
    .slice(0, 5);

  const stats = [
    { label: "Total Users", value: loading ? "—" : String(users.length), icon: Users, color: "var(--navy-blue)" },
    { label: "Active Users", value: loading ? "—" : String(activeUsers), icon: UserCheck, color: "var(--success-green)" },
    { label: "Academic Year", value: loading ? "—" : (activeYear?.name ?? "None set"), icon: Calendar, color: "var(--maroon)" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} style={{ borderColor: "var(--border)" }}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm" style={{ color: "var(--mid-gray)" }}>{stat.label}</p>
                    <p className="text-3xl font-bold mt-2" style={{ color: "var(--dark-gray)" }}>{stat.value}</p>
                  </div>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in srgb, ${stat.color} 13%, transparent)` }}>
                    <Icon size={24} style={{ color: stat.color }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4" style={{ color: "var(--dark-gray)" }}>Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/admin/users')} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
              Manage Users
            </Button>
            <Button onClick={() => navigate('/admin/academic-year')} variant="outline">
              Academic Years
            </Button>
            <Button onClick={() => navigate('/admin/audit-log')} variant="outline">
              Audit Log
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4" style={{ color: "var(--dark-gray)" }}>Recent Logins</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : recentLogins.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--mid-gray)" }}>No login activity yet</p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {recentLogins.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm" style={{ color: "var(--dark-gray)" }}>{u.name}</p>
                    <p className="text-xs capitalize" style={{ color: "var(--mid-gray)" }}>{u.role.replace('_', ' ')}</p>
                  </div>
                  <p className="text-xs" style={{ color: "var(--mid-gray)" }}>{timeAgo(u.last_login)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
