import { useState, useEffect } from "react";
import { Search, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { toast } from "sonner";

interface ShuffleSession {
  id: number;
  status: string;
  algorithm: string;
  p_level: { id: number; name: string; };
  submitted_by_user: { id: number; name: string; } | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

const statusColor: Record<string, string> = {
  pending_approval: "var(--warning-amber)",
  approved: "var(--success-green)",
  rejected: "var(--danger-red)",
  distributed: "var(--navy-blue)",
};

const statusLabel: Record<string, string> = {
  pending_approval: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  distributed: "Distributed",
};

export function PendingApprovals() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ShuffleSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<any>('/api/v1/academics/shuffle/pending');
        setSessions(Array.isArray(res) ? res : res.data ?? []);
      } catch {
        toast.error('Failed to load approvals');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = sessions.filter(s => {
    const matchSearch = s.p_level?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = sessions.filter(s => s.status === 'pending_approval').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Pending Approvals</h1>
        <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
          {pendingCount} approval{pendingCount !== 1 ? 's' : ''} pending review
        </p>
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search P-Level..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 h-11">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending_approval">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle size={64} className="mx-auto mb-4" style={{ color: "var(--success-green)" }} />
              <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--dark-gray)" }}>
                {sessions.length === 0 ? "No submissions yet" : "No results matching filters"}
              </h3>
              <p style={{ color: "var(--mid-gray)" }}>
                {sessions.length === 0 ? "The Dean hasn't submitted any class lists yet." : "All caught up!"}
              </p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                  <TableRow>
                    <TableHead className="text-white">P-Level</TableHead>
                    <TableHead className="text-white">Submitted By</TableHead>
                    <TableHead className="text-white">Submitted Date</TableHead>
                    <TableHead className="text-white">Algorithm</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s, index) => (
                    <TableRow key={s.id} style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                      <TableCell className="font-bold text-lg" style={{ color: "var(--dark-gray)" }}>
                        {s.p_level?.name ?? '—'}
                      </TableCell>
                      <TableCell style={{ color: "var(--dark-gray)" }}>
                        <div>
                          <p className="font-medium">{s.submitted_by_user?.name ?? '—'}</p>
                          <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Dean of Studies</p>
                        </div>
                      </TableCell>
                      <TableCell style={{ color: "var(--mid-gray)" }}>
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                      </TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded text-xs font-semibold"
                          style={{ backgroundColor: "color-mix(in srgb, var(--gold) 13%, transparent)", color: "var(--gold)" }}>
                          {s.algorithm?.replace(/_/g, ' ') ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: statusColor[s.status] ?? "var(--mid-gray)" }}>
                          {statusLabel[s.status] ?? s.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button onClick={() => navigate(`/principal/review/${s.id}`)} size="sm"
                          style={{ backgroundColor: s.status === 'pending_approval' ? "var(--maroon)" : "transparent", color: s.status === 'pending_approval' ? "#fff" : "var(--maroon)" }}
                          variant={s.status === 'pending_approval' ? "default" : "ghost"}>
                          {s.status === 'pending_approval' ? 'Review' : 'View'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
