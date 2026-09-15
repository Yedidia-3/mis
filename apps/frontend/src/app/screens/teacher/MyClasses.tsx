import { useState, useEffect, useCallback } from "react";
import { BookOpen, Users, Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";

interface ClassData {
  id: number;
  name: string;
  p_level: { id: number; name: string };
  student_count?: number;
  students?: any[];
}

export function MyClasses() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/academics/teacher/classes');
      setClasses(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>My Classes</h1>
        <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
          View your class lists or take attendance
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
        </div>
      ) : classes.length === 0 ? (
        <div className="text-center py-16 border rounded-lg" style={{ borderColor: "var(--border)" }}>
          <BookOpen size={48} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
          <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No classes assigned yet</p>
          <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
            The Dean will assign you to a class once the class lists are distributed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {classes.map(cls => {
            const label = encodeURIComponent((cls.p_level?.name ?? '') + cls.name);
            return (
              <Card key={cls.id} style={{ borderColor: "var(--border)" }}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 13%, transparent)" }}>
                      <BookOpen size={24} style={{ color: "var(--maroon)" }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold" style={{ color: "var(--dark-gray)" }}>
                        {cls.p_level?.name}{cls.name}
                      </h3>
                      <span className="inline-block px-2 py-1 rounded text-xs font-semibold mt-1"
                        style={{ backgroundColor: "var(--gold)", color: "var(--dark-gray)" }}>
                        {cls.p_level?.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 13%, transparent)" }}>
                      <Users size={16} style={{ color: "var(--maroon)" }} />
                    </div>
                    <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
                      {cls.student_count ?? cls.students?.length ?? 0} students
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={() => navigate(`/teacher/class/${cls.id}?name=${label}`)}
                      className="flex-1" variant="outline"
                      style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
                      View Class
                    </Button>
                    <Button onClick={() => navigate(`/teacher/class/${cls.id}/attendance?name=${label}`)}
                      className="flex-1"
                      style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                      Attendance
                    </Button>
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
