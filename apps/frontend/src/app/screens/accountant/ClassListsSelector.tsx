import { GraduationCap, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

interface RosterStudent {
  id: number;
  p_level_id: number | null;
  p_level_name: string;
  class_id: number | null;
  current_class: string;
}

interface RosterResponse {
  has_copy: boolean;
  needs_accept: boolean;
  distributed_class_count: number;
  pending_notices: { id: number; message: string }[];
  students: RosterStudent[];
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
  const [activeYearName, setActiveYearName] = useState("");
  const [studentTotal, setStudentTotal] = useState(0);
  const [needEnrolment, setNeedEnrolment] = useState(0);
  const [needsAccept, setNeedsAccept] = useState(false);
  const [distributedCount, setDistributedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [accepting, setAccepting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const years = await api.get<any>('/api/v1/academics/academic-years');
      const yearsList = Array.isArray(years) ? years : years.data ?? [];
      const activeYear = yearsList.find((y: any) => y.status === 'active');
      if (!activeYear) {
        toast.error('No active academic year');
        setLoading(false);
        return;
      }
      setActiveYearName(activeYear.name);

      const [roster, feedingRes, transportRes] = await Promise.all([
        api.get<RosterResponse>('/api/v1/accountant/roster'),
        api.get<any>('/api/v1/accountant/enrollments?type=feeding').catch(() => []),
        api.get<any>('/api/v1/accountant/enrollments?type=transport').catch(() => []),
      ]);
      const students = roster?.students ?? [];
      setNeedsAccept(!!roster?.needs_accept);
      setDistributedCount(roster?.distributed_class_count ?? 0);
      setPendingCount(roster?.pending_notices?.length ?? 0);

      const enrolledIds = new Set<number>();
      for (const list of [feedingRes, transportRes]) {
        const rows = Array.isArray(list) ? list : list?.data ?? [];
        for (const row of rows) {
          if (row?.student_id) enrolledIds.add(row.student_id);
        }
      }

      const map = new Map<number, PLevelSummary & { classIds: Set<number> }>();
      const allStudentIds = new Set<number>();
      for (const student of students) {
        if (student.p_level_id == null) continue;
        const existing = map.get(student.p_level_id) ?? {
          id: student.p_level_id,
          name: student.p_level_name,
          classCount: 0,
          studentCount: 0,
          classIds: new Set<number>(),
        };
        if (student.class_id != null && !existing.classIds.has(student.class_id)) {
          existing.classIds.add(student.class_id);
          existing.classCount = existing.classIds.size;
        }
        if (!allStudentIds.has(student.id)) {
          existing.studentCount += 1;
          allStudentIds.add(student.id);
        }
        map.set(student.p_level_id, existing);
      }

      let waiting = 0;
      for (const id of allStudentIds) {
        if (!enrolledIds.has(id)) waiting += 1;
      }
      setStudentTotal(allStudentIds.size);
      setNeedEnrolment(waiting);
      setPLevels(Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      toast.error('Failed to load class lists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const accept = async () => {
    setAccepting(true);
    try {
      const res = await api.post<{ copied: number; message: string }>('/api/v1/accountant/roster/accept', {});
      toast.success(res?.message ?? 'Class list received');
      setLoading(true);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Could not accept the class list');
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Class Lists</h1>
          <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
            Your accepted copy: student ID, name, and class. Select students here to import them into enrollment.
          </p>
        </div>
        {activeYearName && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white bg-amber-700 self-start sm:self-center">
            Academic Year {activeYearName}
          </span>
        )}
      </div>

      {!loading && needsAccept && (
        <Card style={{ borderColor: "var(--warning-amber)" }}>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold" style={{ color: "var(--dark-gray)" }}>
                {pendingCount > 0 ? 'A class list is waiting for you' : 'Distributed classes are ready'}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
                Accept to receive a copy with student ID, name, and current class only.
                {distributedCount > 0 ? ` ${distributedCount} class${distributedCount === 1 ? '' : 'es'} distributed.` : ''}
              </p>
            </div>
            <Button onClick={accept} disabled={accepting} style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept
            </Button>
          </CardContent>
        </Card>
      )}

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
              <p className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>on your copy</p>
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
          <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No class list copy yet</p>
          <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
            {distributedCount > 0
              ? 'Accept the notice above to receive student ID, name, and class.'
              : 'You will get one notification after the Dean distributes classes. Accept it to receive your copy.'}
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
                      Accepted
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
                  Select students
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
