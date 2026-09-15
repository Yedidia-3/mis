import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Search, Download, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { ExportClassListDialog } from "../../components/ExportClassListDialog";
import { api } from "../../../lib/api";
import { toast } from "sonner";

interface Student {
  id: number;
  name: string;
  former_class: string | null;
  rank: number | null;
  marks_percentage: number | null;
  current_class_id: number;
}

const CLASS_COLORS = ["var(--maroon)", "var(--navy-blue)", "var(--gold)", "var(--success-green)", "var(--info-blue)", "#6B21A8"];

export function MyClassStudentList() {
  const { classId } = useParams<{ classId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const className = searchParams.get('name') ?? `Class ${classId}`;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [formerClassFilter, setFormerClassFilter] = useState<string>("all");
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<any>(`/api/v1/academics/classes/${classId}/students`);
        setStudents(Array.isArray(res) ? res : res.data ?? []);
      } catch {
        toast.error('Failed to load students');
      } finally {
        setLoading(false);
      }
    };
    if (classId) load();
  }, [classId]);

  const formerClasses = Array.from(new Set(students.map(s => s.former_class).filter(Boolean))) as string[];
  const colorMap: Record<string, string> = {};
  formerClasses.forEach((c, i) => { colorMap[c] = CLASS_COLORS[i % CLASS_COLORS.length]; });

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFormer = formerClassFilter === "all" || s.former_class === formerClassFilter;
    return matchesSearch && matchesFormer;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back to Dashboard
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
            {className} — Student List
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            My Classes › {className}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate(`/teacher/class/${classId}/attendance?name=${encodeURIComponent(className)}`)}
            className="h-11" style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
            Take Attendance
          </Button>
          <Button onClick={() => setShowDownloadDialog(true)} variant="outline" className="h-11"
            style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
            <Download size={18} className="mr-2" /> Download
          </Button>
        </div>
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search student name..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11" />
            </div>
            <Select value={formerClassFilter} onValueChange={setFormerClassFilter}>
              <SelectTrigger className="w-full md:w-52 h-11">
                <SelectValue placeholder="Filter by former class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Former Classes</SelectItem>
                {formerClasses.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
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
                    <TableHead className="text-white w-12">#</TableHead>
                    <TableHead className="text-white">Name</TableHead>
                    <TableHead className="text-white">Former Class</TableHead>
                    <TableHead className="text-white">Rank</TableHead>
                    <TableHead className="text-white">Marks %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8" style={{ color: "var(--mid-gray)" }}>
                        No students found
                      </TableCell>
                    </TableRow>
                  ) : filteredStudents.map((student, index) => (
                    <TableRow key={student.id}
                      style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                      <TableCell className="text-sm" style={{ color: "var(--mid-gray)" }}>{index + 1}</TableCell>
                      <TableCell className="font-medium" style={{ color: "var(--dark-gray)" }}>{student.name}</TableCell>
                      <TableCell>
                        {student.former_class ? (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: colorMap[student.former_class] ?? "var(--mid-gray)" }}>
                            {student.former_class}
                          </span>
                        ) : <span style={{ color: "var(--mid-gray)" }}>—</span>}
                      </TableCell>
                      <TableCell style={{ color: "var(--dark-gray)" }}>{student.rank ?? '—'}</TableCell>
                      <TableCell style={{ color: "var(--dark-gray)" }}>
                        {student.marks_percentage != null ? `${student.marks_percentage}%` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!loading && (
            <p className="text-sm mt-3" style={{ color: "var(--mid-gray)" }}>
              Showing {filteredStudents.length} of {students.length} students
            </p>
          )}
        </CardContent>
      </Card>

      <ExportClassListDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        title={`${className} Class List`}
        exportUrl={`/api/v1/academics/classes/${classId}/export`}
      />
    </div>
  );
}
