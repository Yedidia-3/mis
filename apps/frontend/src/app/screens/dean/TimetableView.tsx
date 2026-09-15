import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

interface Slot {
  id: number;
  p_level_name: string;
  section_name: string;
  day: number;
  period: number;
  start_time: string | null;
  end_time: string | null;
  is_break: boolean;
  course_code: string | null;
  teacher_name: string | null;
  is_manual_override: boolean;
}

interface Plan {
  id: number;
  name: string;
  status: string;
  slots: Slot[];
}

interface AcademicYear { id: number; name: string; status: string }

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const ALL = "__all__";

const PALETTE = [
  "#E8F0FE","#FEF3E8","#F0FDF4","#FEE2E2","#F3E8FF",
  "#E0F7FA","#FFF9C4","#F1F8E9","#FCE4EC","#E8EAF6",
];
const colorCache: Record<string, string> = {};
let colorIdx = 0;
function courseColor(code: string | null): string {
  if (!code) return "transparent";
  if (!colorCache[code]) { colorCache[code] = PALETTE[colorIdx++ % PALETTE.length]; }
  return colorCache[code];
}

/** Course ID shown in cell: P1MATH, P2ENG, etc. */
function courseId(pLevel: string, courseCode: string): string {
  return `${pLevel}${courseCode}`;
}

export function TimetableView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefix = user?.role === "principal" ? "/principal" : "/dean";

  const [loading, setLoading] = useState(true);
  const [uploads, setUploads] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const years = await api.get<any>("/api/v1/academics/academic-years");
        const yearList = Array.isArray(years) ? years : years.data ?? [];
        const active = yearList.find((y: any) => y.status === "active");
        if (!active) { setLoading(false); return; }

        const list = await api.get<any>(`/api/v1/academics/timetable?academic_year_id=${active.id}`);
        const uploadsList: any[] = Array.isArray(list) ? list : list.data ?? [];
        setUploads(uploadsList);
        if (uploadsList.length > 0) setSelectedId(uploadsList[0].id);
      } catch (e) {
        toast.error("Failed to load uploaded timetables");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedId) { setData(null); return; }
    const fetchOne = async () => {
      try {
        const res = await api.get<any>(`/api/v1/academics/timetable/${selectedId}`);
        setData(res);
      } catch {
        toast.error("Failed to load timetable data");
      }
    };
    fetchOne();
  }, [selectedId]);

  // Teacher-specific view: if teacher role, try to fetch teacher-filtered view
  useEffect(() => {
    if (!user || user.role !== "teacher") return;
    const fetchTeacher = async () => {
      try {
        const res = await api.get<any>(`/api/v1/academics/timetable/teacher/${user.id}`);
        if (res) {
          // prefer teacher view if available
          setData(res);
        }
      } catch {
        // ignore and fall back to selected upload
      }
    };
    fetchTeacher();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`${prefix}/timetable`)}>
          <ArrowLeft size={16} />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold" style={{ color: "var(--navy-blue)" }}>Timetable</h2>
          <p className="text-xs text-gray-500">Upload-driven timetable viewer — workbook is canonical.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedId && (
            <Button variant="outline" size="sm" as="a" href={`/api/v1/academics/timetable/${selectedId}/export`}>
              <Download size={14} className="mr-1" /> Export
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Select Upload</Label>
                <Select
                  value={selectedId !== null ? String(selectedId) : "__latest__"}
                  onValueChange={(v) => setSelectedId(v === "__latest__" ? (uploads[0]?.id ?? null) : Number(v))}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__latest__">Latest upload</SelectItem>
                    {uploads.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name || (`Upload ${u.id}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Notes</Label>
              <div className="text-sm text-gray-600">The workbook sheets are shown below. Teachers see only the global sheet and their class sheets.</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {!data && (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">No uploaded timetable selected.</CardContent>
        </Card>
      )}

      {data?.sheets?.map((sheet: any, idx: number) => {
        const rows: any[] = sheet.rows ?? [];
        // Determine headers and body
        let headers: string[] = [];
        let body: any[] = [];
        if (rows.length === 0) {
          headers = [];
          body = [];
        } else if (Array.isArray(rows[0])) {
          // first row as header if strings
          const first = rows[0];
          const allStrings = first.every((c: any) => typeof c === "string");
          if (allStrings) {
            headers = first;
            body = rows.slice(1);
          } else {
            // tabular numeric/heterogeneous -> index columns
            headers = first.map((_c: any, i: number) => `C${i + 1}`);
            body = rows;
          }
        } else if (typeof rows[0] === "object") {
          headers = Object.keys(rows[0]);
          body = rows;
        }

        return (
          <Card key={idx}>
            <CardContent className="p-4">
              <h3 className="font-semibold text-base" style={{ color: "var(--navy-blue)" }}>{sheet.name || `Sheet ${idx + 1}`}</h3>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50">
                      {headers.length > 0
                        ? headers.map((h, i) => <th key={i} className="border p-2 text-left text-xs">{h}</th>)
                        : <th className="border p-2 text-left text-xs">Data</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {body.length === 0 && (
                      <tr><td className="border p-2 text-xs text-gray-500">No rows</td></tr>
                    )}
                    {body.map((r: any, ri: number) => (
                      <tr key={ri}>
                        {Array.isArray(r)
                          ? r.map((c: any, ci: number) => (
                              <td key={ci} className="border p-2 text-xs">{String(c ?? "")}</td>
                            ))
                          : headers.map((h, hi) => (
                              <td key={hi} className="border p-2 text-xs">{String(r[h] ?? "")}</td>
                            ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
