import { ClipboardList } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api } from "../../../../lib/api";
import { CATEGORIES } from "../../../../lib/academicRules";
import {
  CategoryBadge, EmptyState, ErrorState, formatDate, Loading, PageHeader, TeacherAvatar,
} from "../../../components/academic";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { SECTION_FROM_PATH } from "./AcademicRecords";

interface Submitted {
  id: number; title: string; date: string; max_score: number; submitted_at: string; class_label: string;
  subject_name: string; category: string | null; term_name: string; term_id: number;
  marked: number; absent: number; average: number | null; average_percentage: number | null;
}
interface Data { teacher: { id: number; name: string; email: string; avatar: string | null }; assessments: Submitted[] }

export function TeacherAssessments() {
  const { section = "", teacherId = "" } = useParams();
  const navigate = useNavigate();
  const band = SECTION_FROM_PATH[section];
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [term, setTerm] = useState("all");
  const [subject, setSubject] = useState("all");
  const [category, setCategory] = useState("all");

  const load = useCallback(async () => {
    setError(null);
    if (!band || !/^\d{1,10}$/.test(teacherId)) { setError("This link is not valid"); return; }
    try { setData(await api.get(`/api/v1/academics/records/teachers/${teacherId}/assessments?band=${band}`)); }
    catch (e: any) { setError(e?.message ?? "Could not load submissions"); }
  }, [band, teacherId]);
  useEffect(() => { load(); }, [load]);

  const terms = useMemo(() => [...new Map((data?.assessments ?? []).map((a) => [a.term_id, a.term_name])).entries()], [data]);
  const subjects = useMemo(() => [...new Set((data?.assessments ?? []).map((a) => `${a.subject_name} · ${a.class_label}`))].sort(), [data]);
  const shown = (data?.assessments ?? []).filter((a) =>
    (term === "all" || String(a.term_id) === term)
    && (subject === "all" || `${a.subject_name} · ${a.class_label}` === subject)
    && (category === "all" || a.category === category));

  return (
    <div className="space-y-6">
      <PageHeader back={`/dean/academic-records/${section}`}
        title={data ? (
          <span className="flex items-center gap-3">
            <TeacherAvatar name={data.teacher.name} avatar={data.teacher.avatar} size={44} />
            <span>{data.teacher.name}</span>
          </span>
        ) : "Submitted assessments"}
        subtitle={data ? `${data.assessments.length} submitted assessment${data.assessments.length === 1 ? "" : "s"} · ${data.teacher.email}` : undefined}
      />

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Loading /> : data.assessments.length === 0 ? (
        <EmptyState icon={<ClipboardList size={44} />} title="Nothing submitted yet">
          Assessments appear here once the teacher submits them. Drafts stay private to the teacher.
        </EmptyState>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                {terms.map(([id, name]) => <SelectItem key={id} value={String(id)}>{name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left" style={{ backgroundColor: "var(--light-gray)", color: "var(--mid-gray)" }}>
                    <th className="px-4 py-3 font-medium">Assessment</th>
                    <th className="px-4 py-3 font-medium">Subject · Class</th>
                    <th className="px-4 py-3 font-medium hidden md:table-cell">Term</th>
                    <th className="px-4 py-3 font-medium text-right">Average</th>
                    <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((a) => (
                    <tr key={a.id} className="border-t cursor-pointer hover:bg-black/[0.02]" style={{ borderColor: "var(--border)" }}
                      onClick={() => navigate(`/dean/academic-records/assessments/${a.id}`)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2"><CategoryBadge category={a.category} /></div>
                        <div className="font-medium mt-1" style={{ color: "var(--dark-gray)" }}>{a.title}</div>
                        <div className="text-xs" style={{ color: "var(--mid-gray)" }}>{formatDate(a.date)} · out of {a.max_score}</div>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--dark-gray)" }}>{a.subject_name}<div className="text-xs" style={{ color: "var(--mid-gray)" }}>{a.class_label}</div></td>
                      <td className="px-4 py-3 hidden md:table-cell" style={{ color: "var(--dark-gray)" }}>{a.term_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <div style={{ color: "var(--dark-gray)" }}>{a.average_percentage === null ? "—" : `${a.average_percentage}%`}</div>
                        <div className="text-xs" style={{ color: "var(--mid-gray)" }}>{a.marked} marked{a.absent ? ` · ${a.absent} absent` : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-right hidden sm:table-cell" style={{ color: "var(--mid-gray)" }}>{formatDate(a.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.length === 0 && <p className="text-sm text-center py-8" style={{ color: "var(--mid-gray)" }}>Nothing matches these filters.</p>}
          </div>
        </>
      )}
    </div>
  );
}
