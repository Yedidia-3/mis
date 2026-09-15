import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Share2, Clock, CheckCircle, XCircle, FileEdit, Loader2,
  ArrowRight, Users,
} from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";

interface ShuffleSession {
  id: number;
  status: string;
  algorithm: string;
  p_level: { id: number; name: string };
  submitted_by_name: string | null;
  student_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  distributed_at: string | null;
  rejection_note: string | null;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  in_progress:      { label: "Draft",                 color: "var(--mid-gray)", bg: "var(--light-gray)", icon: FileEdit },
  pending_approval: { label: "Pending Approval",      color: "var(--warning-amber)", bg: "#FEF3E8", icon: Clock },
  approved:         { label: "Approved",              color: "var(--success-green)", bg: "#F0FDF4", icon: CheckCircle },
  rejected:         { label: "Rejected",              color: "var(--danger-red)", bg: "#FEE2E2", icon: XCircle },
  distributed:      { label: "Distributed",           color: "var(--info-blue)", bg: "#EFF6FF", icon: Share2 },
};

function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function DistributionList() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ShuffleSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/academics/shuffle/sessions');
      setSessions(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      toast.error('Failed to load distribution sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  // Counts for the summary cards
  const pendingCount     = sessions.filter(s => s.status === 'pending_approval').length;
  const approvedCount    = sessions.filter(s => s.status === 'approved').length;
  const distributedCount = sessions.filter(s => s.status === 'distributed').length;

  const stats = [
    { label: "Pending Approval", value: pendingCount,     icon: Clock,       color: "var(--warning-amber)" },
    { label: "Ready to Distribute", value: approvedCount, icon: CheckCircle, color: "var(--success-green)" },
    { label: "Distributed",      value: distributedCount, icon: Share2,      color: "var(--info-blue)" },
  ];

  const primaryAction = (s: ShuffleSession) => {
    switch (s.status) {
      case 'approved':
        return (
          <Button onClick={() => navigate(`/dean/distribute/${s.id}`)}
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            Distribute <ArrowRight size={16} className="ml-2" />
          </Button>
        );
      case 'distributed':
        return (
          <Button variant="outline" onClick={() => navigate(`/dean/distribute/${s.id}`)}
            style={{ color: "var(--info-blue)", borderColor: "var(--info-blue)" }}>
            View
          </Button>
        );
      case 'pending_approval':
        return (
          <span className="text-sm italic" style={{ color: "var(--mid-gray)" }}>
            Waiting for Principal…
          </span>
        );
      case 'rejected':
        return (
          <Button variant="outline" onClick={() => navigate(`/dean/algorithm/${s.p_level.id}`)}
            style={{ color: "var(--danger-red)", borderColor: "var(--danger-red)" }}>
            Re-run Shuffle
          </Button>
        );
      case 'in_progress':
        return (
          <Button variant="outline" onClick={() => navigate(`/dean/preview/${s.id}`)}
            style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
            Continue
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Distribution</h1>
        <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
          Track shuffle sessions and distribute approved class lists to teachers and the accountant
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} style={{ borderColor: "var(--border)" }}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm" style={{ color: "var(--mid-gray)" }}>{stat.label}</p>
                    <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>
                      {loading ? "—" : stat.value}
                    </p>
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

      {/* Session list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 border rounded-lg" style={{ borderColor: "var(--border)" }}>
          <Share2 size={48} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No shuffle sessions yet</p>
          <p className="text-sm mt-2 mb-4" style={{ color: "var(--mid-gray)" }}>
            Run a shuffle from a P-Level, submit it for approval, and it will appear here for distribution.
          </p>
          <Button onClick={() => navigate('/dean/p-levels')}
            style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            Go to P-Levels
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const meta = STATUS_META[s.status] ?? STATUS_META.in_progress;
            const StatusIcon = meta.icon;
            const dateLabel =
              s.status === 'distributed' ? `Distributed ${fmtDate(s.distributed_at)}` :
              s.status === 'approved'    ? `Approved ${fmtDate(s.reviewed_at)}` :
              s.status === 'rejected'    ? `Rejected ${fmtDate(s.reviewed_at)}` :
              s.status === 'pending_approval' ? `Submitted ${fmtDate(s.submitted_at)}` :
              null;

            return (
              <Card key={s.id} style={{ borderColor: "var(--border)" }}>
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Status icon */}
                    <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: meta.bg }}>
                      <StatusIcon size={22} style={{ color: meta.color }} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xl font-bold" style={{ color: "var(--dark-gray)" }}>
                          {s.p_level?.name ?? '—'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: meta.bg, color: meta.color }}>
                          {meta.label}
                        </span>
                        <span className="flex items-center gap-1 text-sm" style={{ color: "var(--mid-gray)" }}>
                          <Users size={14} /> {s.student_count} students
                        </span>
                      </div>
                      <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
                        Algorithm: <span className="capitalize">{s.algorithm?.replace(/_/g, ' ')}</span>
                        {dateLabel ? ` · ${dateLabel}` : ''}
                      </p>
                      {s.status === 'rejected' && s.rejection_note && (
                        <p className="text-sm mt-1 italic" style={{ color: "var(--danger-red)" }}>
                          “{s.rejection_note}”
                        </p>
                      )}
                    </div>

                    {/* Action */}
                    <div className="flex-shrink-0">
                      {primaryAction(s)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
