import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { api } from "../../../../lib/api";
import {
  CategoryBadge, ErrorState, formatDate, Loading, PageHeader, TeacherAvatar,
} from "../../../components/academic";
import type { AssessmentDetail } from "../../teacher/marks/MarksSheet";

/** A submitted assessment's marks, read-only for the dean. */
export function AssessmentReview() {
  const { id = "" } = useParams();
  const [data, setData] = useState<AssessmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    if (!/^\d{1,10}$/.test(id)) { setError("This link is not valid"); return; }
    try { setData(await api.get<AssessmentDetail>(`/api/v1/academics/assessments/${id}`)); }
    catch (e: any) { setError(e?.message ?? "Could not load the assessment"); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="space-y-6"><PageHeader title="Assessment" back="history" /><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return <Loading />;

  const a = data.analytics;
  return (
    <div className="space-y-6">
      <PageHeader back="history" title={data.title}
        subtitle={`${data.subject_name} · ${data.class_label} · ${data.term_name} · ${formatDate(data.date)} · out of ${data.max_score}`}
        actions={<CategoryBadge category={data.category} />} />

      <div className="flex items-center gap-3 bg-white rounded-2xl border p-4" style={{ borderColor: "var(--border)" }}>
        <TeacherAvatar name={data.teacher_name ?? "Teacher"} avatar={data.teacher_avatar} size={40} />
        <div className="text-sm">
          <div className="font-medium" style={{ color: "var(--dark-gray)" }}>{data.teacher_name ?? "Unknown teacher"}</div>
          <div style={{ color: "var(--mid-gray)" }}>Submitted {formatDate(data.submitted_at)}</div>
        </div>
        <div className="ml-auto grid grid-cols-3 gap-6 text-right">
          <Mini label="Average" value={a.average === null ? "—" : `${a.average}%`} />
          <Mini label="Highest" value={a.highest === null ? "—" : `${a.highest}%`} />
          <Mini label="Absent" value={String(a.absent)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ backgroundColor: "var(--light-gray)", color: "var(--mid-gray)" }}>
                <th className="px-4 py-3 w-10 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Pupil</th>
                <th className="px-4 py-3 font-medium text-right">Mark / {data.max_score}</th>
                <th className="px-4 py-3 font-medium text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={s.student_id} className="border-t" style={{ borderColor: "var(--border)" }}>
                  <td className="px-4 py-2.5 tabular-nums" style={{ color: "var(--mid-gray)" }}>{i + 1}</td>
                  <td className="px-4 py-2.5" style={{ color: "var(--dark-gray)" }}>{s.student_name}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {s.is_absent ? <span style={{ color: "var(--warning-amber)" }}>Absent</span>
                      : s.score === null ? <span style={{ color: "var(--danger-red)" }}>No mark</span> : s.score}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: "var(--mid-gray)" }}>{s.percentage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--mid-gray)" }}>{label}</div>
      <div className="font-semibold tabular-nums" style={{ color: "var(--dark-gray)" }}>{value}</div>
    </div>
  );
}
