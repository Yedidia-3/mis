import { GraduationCap, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

interface ClassItem {
  id: number;
  name: string;
  p_level_id: number;
  p_level: { id: number; name: string; };
  students: { id: number; }[];
}

interface PLevelSummary {
  id: number;
  name: string;
  classCount: number;
  studentCount: number;
}

export function ClassListsSelector() {
  const navigate = useNavigate();
  const [pLevels, setPLevels] = useState<PLevelSummary[]>([]);
  const [activeYearName, setActiveYearName] = useState<string>("");
  const [studentTotal, setStudentTotal] = useState(0);
  const [needEnrolment, setNeedEnrolment] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const years = await api.get<any>('/api/v1/academics/academic-years');
        const yearsList = Array.isArray(years) ? years : (years as any).data ?? [];
        const activeYear = yearsList.find((y: any) => y.status === 'active');
        if (!activeYear) {
          toast.error('No active academic year');
          setLoading(false);
          return;
        }
        setActiveYearName(activeYear.name);

        const [res, feedingRes, transportRes] = await Promise.all([
          api.get<any>(`/api/v1/academics/all-classes?academic_year_id=${activeYear.id}`),
          api.get<any>('/api/v1/accountant/enrollments?type=feeding').catch(() => []),
          api.get<any>('/api/v1/accountant/enrollments?type=transport').catch(() => []),
        ]);
        const classes: ClassItem[] = Array.isArray(res) ? res : res.data ?? [];
        const enrolledIds = new Set<number>();
        for (const list of [feedingRes, transportRes]) {
          const rows = Array.isArray(list) ? list : list?.data ?? [];
          for (const row of rows) {
            if (row?.student_id) enrolledIds.add(row.student_id);
          }
        }

        // Group classes by p_level. A student is counted once even if a roster repeats them.
        const map = new Map<number, PLevelSummary & { ids: Set<number> }>();
        const allStudentIds = new Set<number>();
        for (const cls of classes) {
          if (!cls.p_level) continue;
          const plId = cls.p_level.id;
          const existing = map.get(plId) ?? {
            id: plId,
            name: cls.p_level.name,
            classCount: 0,
            studentCount: 0,
            ids: new Set<number>(),
          };
          existing.classCount += 1;
          for (const student of cls.students ?? []) {
            if (student?.id == null || existing.ids.has(student.id)) continue;
            existing.ids.add(student.id);
            allStudentIds.add(student.id);
          }
          existing.studentCount = existing.ids.size;
          map.set(plId, existing);
        }
        let waiting = 0;
        for (const id of allStudentIds) {
          if (!enrolledIds.has(id)) waiting += 1;
        }
        setStudentTotal(allStudentIds.size);
        setNeedEnrolment(waiting);

        // Sort by p-level name
        const sorted = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
        setPLevels(sorted);
      } catch {
        toast.error('Failed to load class lists');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Class Lists</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            View distributed student class rosters by level
          </p>
        </div>
        {activeYearName && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-amber-700 self-start sm:self-center">
            Academic Year {activeYearName}
          </span>
        )}
      </div>

      {!loading && pLevels.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card style={{ borderColor: "var(--border)" }}>
            <CardContent className="p-5">
              <p className="text-sm" style={{ color: "var(--mid-gray)" }}>P-Levels</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>{pLevels.length}</p>
            </CardContent>
          </Card>
          <Card style={{ borderColor: "var(--border)" }}>
            <CardContent className="p-5">
              <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Classes</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>{pLevels.reduce((sum, pl) => sum + pl.classCount, 0)}</p>
            </CardContent>
          </Card>
          <Card style={{ borderColor: "var(--border)" }}>
            <CardContent className="p-5">
              <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Students</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>{studentTotal}</p>
              <p className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>on these class lists</p>
            </CardContent>
          </Card>
          <Card style={{ borderColor: "var(--border)" }}>
            <CardContent className="p-5">
              <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Need Enrolment</p>
              <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>{needEnrolment}</p>
              <p className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>not in feeding or transport</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
        </div>
      ) : pLevels.length === 0 ? (
        <div className="text-center py-16 border rounded-lg" style={{ borderColor: "var(--border)" }}>
          <GraduationCap size={48} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No Class Lists Available</p>
          <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
            Class lists become available after the Dean distributes the shuffle results.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pLevels.map((pl) => (
            <Card key={pl.id} style={{ borderColor: "var(--border)" }}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "color-mix(in srgb, var(--navy-blue) 13%, transparent)" }}>
                    <GraduationCap size={28} style={{ color: "var(--navy-blue)" }} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold" style={{ color: "var(--dark-gray)" }}>{pl.name}</h3>
                    <span className="inline-block px-2 py-1 rounded text-xs font-semibold text-white mt-1"
                      style={{ backgroundColor: "var(--success-green)" }}>
                      Active
                    </span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--mid-gray)" }}>Classes:</span>
                    <span className="font-semibold" style={{ color: "var(--dark-gray)" }}>{pl.classCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm" style={{ color: "var(--mid-gray)" }}>Students:</span>
                    <span className="font-semibold" style={{ color: "var(--dark-gray)" }}>{pl.studentCount}</span>
                  </div>
                </div>

                <Button onClick={() => navigate(`/accountant/class-lists/${pl.id}`)}
                  className="w-full" style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                  View Classes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
