import { useState, useEffect, useCallback } from "react";
import { BookOpen, Users, Loader2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { useNavigate } from "react-router";
import { api } from "../../../lib/api";
import { toast } from "sonner";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";

interface Lesson {
  code: string;
  name: string;
  max: number;
}

interface ClassData {
  id: number;
  name: string;
  p_level: { id: number; name: string };
  student_count?: number;
  mode?: "nursery" | "midterm";
  lessons?: Lesson[];
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
          Every class you teach. Open one to see the class list and record the mid-term for your lesson.
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
            Your classes and lessons come from the assignments the dean saved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {classes.map(cls => {
            const label = `${cls.p_level?.name ?? ''}${cls.name}`;
            const lessons = cls.lessons ?? [];
            return (
              <Card key={cls.id} style={{ borderColor: "var(--border)" }}>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "color-mix(in srgb, var(--maroon) 13%, transparent)" }}>
                      <BookOpen size={24} style={{ color: "var(--maroon)" }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold" style={{ color: "var(--dark-gray)" }}>{label}</h3>
                      <p className="text-sm flex items-center gap-1 mt-1" style={{ color: "var(--mid-gray)" }}>
                        <Users size={14} /> {cls.student_count ?? 0} pupils
                      </p>
                    </div>
                  </div>

                  {cls.mode === "nursery" ? (
                    <p className="text-sm mb-4" style={{ color: "var(--dark-gray)" }}>Nursery bulletin</p>
                  ) : lessons.length > 0 ? (
                    <p className="text-sm mb-4" style={{ color: "var(--dark-gray)" }}>
                      {lessons.map((lesson) => lesson.name).join(" · ")}
                    </p>
                  ) : (
                    <p className="text-sm mb-4" style={{ color: "var(--mid-gray)" }}>
                      No mid-term lesson assigned in this class yet.
                    </p>
                  )}

                  <Button
                    onClick={() => navigate(`/teacher/class/${cls.id}?name=${encodeURIComponent(label)}`)}
                    className="w-full"
                    style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                    Open class
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
