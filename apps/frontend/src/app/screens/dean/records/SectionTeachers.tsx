import { Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../../../../lib/api";
import {
  EmptyState, ErrorState, formatDate, Loading, PageHeader, TeacherAvatar,
} from "../../../components/academic";
import { Input } from "../../../components/ui/input";
import { SECTION_FROM_PATH } from "./AcademicRecords";

interface Teacher {
  id: number; name: string; email: string; avatar: string | null; type: "class_teacher" | "teacher";
  classes: { id: number; label: string; role: string }[]; submitted_count: number; last_submitted_at: string | null;
}

export function SectionTeachers() {
  const { section = "" } = useParams();
  const navigate = useNavigate();
  const band = SECTION_FROM_PATH[section];
  const [data, setData] = useState<{ section: { label: string }; teachers: Teacher[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    if (!band) { setError("That section does not exist"); return; }
    try { setData(await api.get(`/api/v1/academics/records/sections/${band}/teachers`)); }
    catch (e: any) { setError(e?.message ?? "Could not load teachers"); }
  }, [band]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.teachers ?? []).filter((t) => !q || t.name.toLowerCase().includes(q) || t.classes.some((c) => c.label.toLowerCase().includes(q)));
  }, [data, query]);

  return (
    <div className="space-y-6">
      <PageHeader back="/dean/academic-records" title={data?.section.label ?? "Teachers"}
        subtitle="Class teachers first, then subject teachers. Open a teacher to see what they have submitted." />

      {error ? <ErrorState message={error} onRetry={band ? load : undefined} /> : !data ? <Loading /> : data.teachers.length === 0 ? (
        <EmptyState icon={<Users size={44} />} title="No teachers in this section yet">
          Teachers appear here once they are class teachers or have subjects assigned in a distributed class.
        </EmptyState>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
            <Input className="pl-9 bg-white" placeholder="Search by name or class" value={query} maxLength={60}
              onChange={(e) => setQuery(e.target.value)} />
          </div>
          {shown.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>No teacher matches “{query}”.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((t) => (
                <button key={t.id} onClick={() => navigate(`/dean/academic-records/${section}/teachers/${t.id}`)}
                  className="press-subtle text-left bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow flex gap-4 items-start"
                  style={{ borderColor: "var(--border)" }}>
                  <TeacherAvatar name={t.name} avatar={t.avatar} size={52} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate" style={{ color: "var(--dark-gray)" }}>{t.name}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={t.type === "class_teacher"
                        ? { backgroundColor: "var(--gold)", color: "var(--dark-gray)" }
                        : { backgroundColor: "color-mix(in srgb, var(--navy-blue) 10%, white)", color: "var(--navy-blue)" }}>
                      {t.type === "class_teacher" ? "Class teacher" : "Teacher"}
                    </span>
                    <div className="text-xs mt-2 truncate" style={{ color: "var(--mid-gray)" }}>
                      {t.classes.map((c) => c.label).join(", ")}
                    </div>
                    <div className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>
                      <b className="tabular-nums" style={{ color: "var(--dark-gray)" }}>{t.submitted_count}</b> submitted
                      {t.last_submitted_at && <> · last {formatDate(t.last_submitted_at)}</>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
