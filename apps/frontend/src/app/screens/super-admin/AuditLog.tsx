import { Download, Loader2, Search } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { groupByWeek } from "../../../lib/weeks";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";

interface AuditEntry {
  timestamp: string;
  user: string;
  role: string;
  target_type?: string | null;
  target_id?: number | null;
  target_name?: string | null;
  action: string;
  details: string;
  ip_address: string;
}

const getRoleBadgeColor = (role: string) => {
  const lower = role?.toLowerCase() ?? '';
  if (lower.includes('super')) return "var(--maroon)";
  if (lower.includes('dean')) return "var(--navy-blue)";
  if (lower.includes('principal')) return "var(--gold)";
  if (lower.includes('teacher')) return "var(--success-green)";
  if (lower.includes('accountant')) return "var(--info-blue)";
  return "var(--mid-gray)";
};

export function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<any>('/api/v1/admin/audit-log');
        setEntries(Array.isArray(res) ? res : res.data ?? []);
      } catch {
        toast.error('Failed to load audit log');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredEntries = entries.filter(e => {
    const matchSearch =
      e.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.details?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUser = userFilter === "all" || e.user === userFilter;
    const matchAction = actionFilter === "all" || e.action === actionFilter;
    return matchSearch && matchUser && matchAction;
  });

  const uniqueUsers = Array.from(new Set(entries.map(e => e.user)));
  const uniqueActions = Array.from(new Set(entries.map(e => e.action)));

  const handleExport = () => {
    const header = "Timestamp,User,Role,Target Type,Target ID,Target Name,Action,Details,IP\n";
    const rows = filteredEntries.map(e =>
      `"${new Date(e.timestamp).toLocaleString()}","${e.user}","${e.role}","${e.target_type ?? ''}","${e.target_id ?? ''}","${e.target_name ?? ''}","${e.action}","${e.details}","${e.ip_address}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const summaryCards = [
    { label: 'Total Events', value: String(entries.length) },
    { label: 'Users Involved', value: String(uniqueUsers.length) },
    { label: 'Unique Actions', value: String(uniqueActions.length) },
    { label: 'Last 24h', value: String(entries.filter((e) => Date.now() - new Date(e.timestamp).getTime() <= 24 * 60 * 60 * 1000).length) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Audit Log</h1>
        <Button onClick={handleExport} variant="outline" className="h-11"
          style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
          <Download size={18} className="mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label} style={{ borderColor: "var(--border)" }}>
            <CardContent className="p-5">
              <p className="text-sm" style={{ color: "var(--mid-gray)" }}>{card.label}</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search audit log..." value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-full md:w-48 h-11"><SelectValue placeholder="Filter by user" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-48 h-11"><SelectValue placeholder="Filter by action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                  <TableRow>
                    <TableHead className="text-white">Timestamp</TableHead>
                    <TableHead className="text-white">User</TableHead>
                    <TableHead className="text-white">Target</TableHead>
                    <TableHead className="text-white">Action</TableHead>
                    <TableHead className="text-white">Details</TableHead>
                    <TableHead className="text-white">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupByWeek(filteredEntries, e => e.timestamp).map(group => (
                    <Fragment key={group.key}>
                      <TableRow>
                        <TableCell colSpan={5} className="py-2" style={{ backgroundColor: "#EEF1F6" }}>
                          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--navy-blue)" }}>
                            {group.label}
                          </span>
                          <span className="text-xs ml-2" style={{ color: "var(--mid-gray)" }}>
                            {group.items.length} event{group.items.length !== 1 ? 's' : ''}
                          </span>
                        </TableCell>
                      </TableRow>
                      {group.items.map((e, index) => (
                        <TableRow key={`${group.key}-${index}`} style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                          <TableCell className="font-mono text-sm" style={{ color: "var(--dark-gray)" }}>
                            {new Date(e.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium" style={{ color: "var(--dark-gray)" }}>{e.user}</div>
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white mt-1"
                              style={{ backgroundColor: getRoleBadgeColor(e.role) }}>
                              {e.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs uppercase tracking-wide" style={{ color: "var(--mid-gray)" }}>{e.target_type ?? 'System'}</div>
                            <div className="font-medium" style={{ color: "var(--dark-gray)" }}>{e.target_name ?? (e.target_id ? `#${e.target_id}` : '—')}</div>
                          </TableCell>
                          <TableCell className="font-medium" style={{ color: "var(--dark-gray)" }}>{e.action}</TableCell>
                          <TableCell style={{ color: "var(--mid-gray)" }}>{e.details}</TableCell>
                          <TableCell className="font-mono text-sm" style={{ color: "var(--mid-gray)" }}>{e.ip_address}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
              {filteredEntries.length === 0 && (
                <div className="text-center py-12">
                  <p style={{ color: "var(--mid-gray)" }}>No audit log entries found</p>
                </div>
              )}
            </div>
          )}
          {!loading && (
            <p className="text-sm mt-3" style={{ color: "var(--mid-gray)" }}>
              Showing {filteredEntries.length} of {entries.length} entries
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
