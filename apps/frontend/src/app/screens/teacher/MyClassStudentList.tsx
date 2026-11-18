import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Search, ArrowLeft, Loader2, ClipboardPen } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { RecordMidterm } from "./RecordMidterm";

interface Student {
  id: number;
  name: string;
  student_id_number?: string | null;
}

export function MyClassStudentList() {
  const { classId } = useParams<{ classId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const className = searchParams.get("name") ?? `Class ${classId}`;

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<any>(`/api/v1/academics/classes/${classId}/students`);
        const rows = Array.isArray(res?.students) ? res.students : Array.isArray(res) ? res : res.data ?? [];
        setStudents(rows.filter((student: Student & { status?: string }) => student.status !== "transferred"));
      } catch {
        toast.error("Failed to load the class list");
      } finally {
        setLoading(false);
      }
    };
    if (classId) load();
  }, [classId]);

  const filtered = students.filter((student) => student.name.toLowerCase().includes(searchTerm.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/teacher/my-classes")}
          style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> My Classes
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>{className}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Class list, then the mid-term for the lesson you teach.
          </p>
        </div>
        {!recording && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRecording(true)} className="h-11"
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              <ClipboardPen size={18} className="mr-2" /> Record mid-term
            </Button>
            <Button variant="outline" className="h-11"
              onClick={() => navigate(`/teacher/class/${classId}/attendance?name=${encodeURIComponent(className)}`)}
              style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
              Attendance
            </Button>
          </div>
        )}
      </div>

      {recording && classId ? (
        <RecordMidterm classId={classId} onClose={() => setRecording(false)} />
      ) : (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-6">
            <div className="relative mb-6">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input placeholder="Search pupil" value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-11" />
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
                      <TableHead className="text-white">Pupil</TableHead>
                      <TableHead className="text-white">Student code</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8" style={{ color: "var(--mid-gray)" }}>
                          No pupils match this search.
                        </TableCell>
                      </TableRow>
                    ) : filtered.map((student, index) => (
                      <TableRow key={student.id}
                        style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                        <TableCell className="text-sm" style={{ color: "var(--mid-gray)" }}>{index + 1}</TableCell>
                        <TableCell className="font-medium" style={{ color: "var(--dark-gray)" }}>{student.name}</TableCell>
                        <TableCell style={{ color: "var(--dark-gray)" }}>{student.student_id_number || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {!loading && (
              <p className="text-sm mt-3" style={{ color: "var(--mid-gray)" }}>
                {filtered.length} of {students.length} pupils
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
