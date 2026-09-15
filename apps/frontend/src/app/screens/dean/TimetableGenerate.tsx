import React from "react";

// Full generator UI retired. Keep this screen as a redirect/placeholder to the new upload flow.
import { useNavigate } from "react-router";
import { useAuth } from "../../../lib/auth";

export function TimetableGenerate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefix = user?.role === "principal" ? "/principal" : "/dean";

  // Redirect users to Upload screen
  React.useEffect(() => {
    navigate(`${prefix}/timetable`);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Timetable generator retired</h2>
      <p className="text-sm mt-2 text-gray-600">The generator has been removed. Use the Timetable Upload screen to provide canonical workbooks.</p>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Assignment {
  pLevelName: string;
  courseCode: string;
  sections: string[];
  periodsPerWeek: number;
}

interface TeacherRow {
  id?: number;
  name: string;
  assignments: Assignment[];
}

interface DBTeacher { id: number; name: string; assignments: Assignment[] }
interface DBCourse  { code: string; name: string; periodsPerWeek: number; minConsecutive: number }
interface DBPLevel  { name: string; sections: string[]; courses: DBCourse[] }

// Fixed school skeleton (from EXAMPLES_OF_TIMETABLE.md)
const SCHOOL_SKELETON = {
  pLevels: [] as { name: string; sections: string[]; periodsPerDay: number; periodDuration: number; startTime: string; breaks: { afterPeriod: number; durationMinutes: number; label: string }[] }[],
};

function buildSkeleton(pLevels: DBPLevel[]) {
  return {
    pLevels: pLevels.map((pl) => ({
      name: pl.name,
      sections: pl.sections,
      periodsPerDay: 9,
      periodDuration: 40,
      startTime: "08:00",
      breaks: [
        { afterPeriod: 3, durationMinutes: 30, label: "Break" },
        { afterPeriod: 6, durationMinutes: 70, label: "Lunch" },
      ],
    })),
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function TimetableGenerate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefix = user?.role === "principal" ? "/principal" : "/dean";

  const [academicYearId, setAcademicYearId] = useState<number | null>(null);
  const [dbTeachers, setDbTeachers] = useState<DBTeacher[]>([]);
  const [pLevels, setPLevels] = useState<DBPLevel[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(true);
  const [suggestion, setSuggestion] = useState<any | null>(null);
  const [generating, setGenerating] = useState(false);
  const [planId, setPlanId] = useState<number | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  // ── Load prefill data ────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const years = await api.get<any>("/api/v1/academics/academic-years");
      const yearList = Array.isArray(years) ? years : years.data ?? [];
      const active = yearList.find((y: any) => y.status === "active");
      if (!active) { setLoading(false); return; }
      setAcademicYearId(active.id);

      const prefill = await api.get<any>(
        `/api/v1/academics/timetable/prefill?academic_year_id=${active.id}`,
      );

      // Also fetch suggestion preview for modal
      try {
        const sugg = await api.get<any>(`/api/v1/academics/timetable/suggest?academic_year_id=${active.id}`);
        setSuggestion(sugg);
      } catch {
        setSuggestion(null);
      }

      const dbT: DBTeacher[] = prefill.teachers?.teachers ?? [];
      const dbPL: DBPLevel[] = (prefill.courses?.pLevels ?? []).map((pl: any) => ({
        name: pl.name,
        sections: pl.sections?.length ? pl.sections : ["A"],
        courses: pl.courses,
      }));

      setDbTeachers(dbT);
      setPLevels(dbPL);
      setTeachers([]);
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Teacher row helpers ──────────────────────────────────────────────────────
  const usedIds = new Set(teachers.map((t) => t.id).filter(Boolean));

  const selectTeacher = (tIdx: number, teacherId: string) => {
    const db = dbTeachers.find((t) => String(t.id) === teacherId);
    if (!db) return;
    setTeachers((prev) =>
      prev.map((t, i) =>
        i === tIdx ? { ...t, id: db.id, name: db.name } : t,
      ),
    );
  };

  const updateAssignment = (tIdx: number, aIdx: number, patch: Partial<Assignment>) =>
    setTeachers((prev) =>
      prev.map((t, i) =>
        i === tIdx
          ? { ...t, assignments: t.assignments.map((a, j) => (j === aIdx ? { ...a, ...patch } : a)) }
          : t,
      ),
    );

  const toggleSection = (tIdx: number, aIdx: number, sec: string) => {
    const a = teachers[tIdx].assignments[aIdx];
    const has = a.sections.includes(sec);
    updateAssignment(tIdx, aIdx, {
      sections: has ? a.sections.filter((s) => s !== sec) : [...a.sections, sec],
    });
  };

  const addAssignment = (tIdx: number) => {
    setTeachers((prev) =>
      prev.map((t, i) =>
        i === tIdx
          ? {
              ...t,
              assignments: [
                ...t.assignments,
                {
                  pLevelName: pLevels[0]?.name ?? "",
                  courseCode: "",
                  sections: [],
                  periodsPerWeek: 5,
                },
              ],
            }
          : t,
      ),
    );
  };

  const removeAssignment = (tIdx: number, aIdx: number) =>
    setTeachers((prev) =>
      prev.map((t, i) =>
        i === tIdx ? { ...t, assignments: t.assignments.filter((_, j) => j !== aIdx) } : t,
      ),
    );

  const addTeacher = () => {
    setTeachers((prev) => [...prev, { name: "", assignments: [] }]);
  };

  const removeTeacher = (tIdx: number) =>
    setTeachers((prev) => prev.filter((_, i) => i !== tIdx));

  const coursesForPLevel = (plName: string) =>
    pLevels.find((p) => p.name === plName)?.courses ?? [];

  const sectionsForPLevel = (plName: string) =>
    pLevels.find((p) => p.name === plName)?.sections ?? [];

  // ── Submit → show preview ────────────────────────────────────────────────────
  const handleSubmit = () => {
    const unassigned = teachers.filter((t) => t.assignments.length === 0);
    if (unassigned.length > 0) {
      toast.warning(
        `${unassigned.map((t) => t.name || "Unnamed teacher").join(", ")} ${unassigned.length === 1 ? "has" : "have"} no assignments`,
      );
    }
    setShowPreview(true);
  };

  // ── Generate TT ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!academicYearId) return;
    setGenerating(true);
    try {
      // 1. Create or reuse a plan
      let currentPlanId = planId;
      if (!currentPlanId) {
        const plan = await api.post<any>("/api/v1/academics/timetable", {
          name: `Timetable ${new Date().getFullYear()}`,
          academic_year_id: academicYearId,
        });
        currentPlanId = plan.id;
        setPlanId(plan.id);
      }

      // 2. Save skeleton (fixed school structure)
      const skeleton = buildSkeleton(pLevels);
      await api.put(`/api/v1/academics/timetable/${currentPlanId}/skeleton`, skeleton);

      // 3. Save courses config
      const coursesConfig = {
        pLevels: pLevels.map((pl) => ({ name: pl.name, courses: pl.courses })),
      };
      await api.put(`/api/v1/academics/timetable/${currentPlanId}/courses`, coursesConfig);

      // 4. Save teachers config
      await api.put(`/api/v1/academics/timetable/${currentPlanId}/teachers`, { teachers });

      // 5. Generate
      const result = await api.post<any>(`/api/v1/academics/timetable/${currentPlanId}/generate`);
      const genWarnings: string[] = result.warnings ?? [];
      setWarnings(genWarnings);

      if (genWarnings.length > 0) {
        toast.warning(`Timetable generated with ${genWarnings.length} warning(s)`);
      } else {
        toast.success("Timetable generated successfully");
      }

      navigate(`${prefix}/timetable/view`);
    } catch (e: any) {
      toast.error(e?.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // Use suggested template: create plan, upload suggestion configs and generate
  const useSuggestion = async () => {
    if (!academicYearId || !suggestion) return;
    setGenerating(true);
    try {
      const plan = await api.post<any>("/api/v1/academics/timetable", {
        name: `Suggested TT ${new Date().toISOString()}`,
        academic_year_id: academicYearId,
      });
      setPlanId(plan.id);

      await api.put(`/api/v1/academics/timetable/${plan.id}/skeleton`, suggestion.skeleton);
      await api.put(`/api/v1/academics/timetable/${plan.id}/courses`, suggestion.courses);
      await api.put(`/api/v1/academics/timetable/${plan.id}/teachers`, suggestion.teachers);

      const result = await api.post<any>(`/api/v1/academics/timetable/${plan.id}/generate`);
      const genWarnings: string[] = result.warnings ?? [];
      setWarnings(genWarnings);
      if (genWarnings.length > 0) toast.warning(`Timetable generated with ${genWarnings.length} warning(s)`);
      else toast.success("Timetable generated successfully");

      setShowSuggestionModal(false);
      navigate(`${prefix}/timetable/view`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to apply suggestion");
    } finally {
      setGenerating(false);
    }
  };

  // Generate from scratch: create plan, upload skeleton and courses only, then generate
  const generateFromScratch = async () => {
    if (!academicYearId || !suggestion) return;
    setGenerating(true);
    try {
      const plan = await api.post<any>("/api/v1/academics/timetable", {
        name: `TT From Scratch ${new Date().toISOString()}`,
        academic_year_id: academicYearId,
      });
      setPlanId(plan.id);

      await api.put(`/api/v1/academics/timetable/${plan.id}/skeleton`, suggestion.skeleton);
      await api.put(`/api/v1/academics/timetable/${plan.id}/courses`, suggestion.courses);

      const result = await api.post<any>(`/api/v1/academics/timetable/${plan.id}/generate`);
      const genWarnings: string[] = result.warnings ?? [];
      setWarnings(genWarnings);
      if (genWarnings.length > 0) toast.warning(`Timetable generated with ${genWarnings.length} warning(s)`);
      else toast.success("Timetable generated successfully");

      setShowSuggestionModal(false);
      navigate(`${prefix}/timetable/view`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate");
    } finally {
      setGenerating(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
      </div>
    );
  }

  const GenerateButton = () => (
    <Button
      onClick={handleGenerate}
      disabled={generating}
      style={{ backgroundColor: "var(--maroon)" }}
      className="text-white"
    >
      {generating
        ? <Loader2 className="animate-spin mr-1" size={14} />
        : <Wand2 size={14} className="mr-1" />}
      Generate TT
    </Button>
  );

  return (
    <div className="space-y-5">
      {/* Suggestion modal shown when opening the generator */}
      <Dialog open={showSuggestionModal && Boolean(suggestion)} onOpenChange={setShowSuggestionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suggested Timetable Template</DialogTitle>
            <p className="text-sm text-gray-600">We prepared a suggested timetable based on current assignments. Choose how to proceed.</p>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <p className="text-sm">Preview: <strong>{suggestion ? suggestion.slots.length : 0}</strong> slots, <strong>{suggestion ? suggestion.warnings.length : 0}</strong> warnings.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowSuggestionModal(false)}>Customize</Button>
              <Button style={{ backgroundColor: 'var(--maroon)', color: '#fff' }} onClick={useSuggestion} disabled={generating}>
                Use Suggested Template
              </Button>
              <Button onClick={generateFromScratch} disabled={generating}>Generate From Scratch</Button>
            </div>
          </div>

          <DialogFooter>
            <small className="text-xs text-gray-500">You can always edit assignments before finalizing.</small>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (showPreview ? setShowPreview(false) : navigate(`${prefix}/timetable`))}
        >
          <ArrowLeft size={16} />
        </Button>
        <h2 className="text-xl font-bold" style={{ color: "var(--navy-blue)" }}>
          {showPreview ? "Assignment Preview" : "Generate Timetable"}
        </h2>
      </div>

      {/* ── FORM VIEW ─────────────────────────────────────────────────────────── */}
      {!showPreview && (
        <>
          <p className="text-sm text-gray-500">
            Fill in each teacher's subjects, classes, and number of periods, then click Submit.
          </p>

          {teachers.map((teacher, tIdx) => (
            <Card key={tIdx}>
              <CardContent className="p-4 space-y-3">
                {/* Teacher selector */}
                <div className="flex items-start gap-3">
                  <div className="flex-1 space-y-1">
                    <Label>Teacher</Label>
                    <Select
                      value={teacher.id ? String(teacher.id) : "__manual"}
                      onValueChange={(v) => v !== "__manual" && selectTeacher(tIdx, v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select teacher…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__manual" disabled>— select from list —</SelectItem>
                        {dbTeachers
                          .filter((t) => !usedIds.has(t.id) || t.id === teacher.id)
                          .map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {!teacher.id && (
                      <Input
                        className="mt-1 h-8 text-sm"
                        value={teacher.name}
                        onChange={(e) =>
                          setTeachers((prev) =>
                            prev.map((t, i) => (i === tIdx ? { ...t, name: e.target.value } : t)),
                          )
                        }
                        placeholder="Or type name manually"
                      />
                    )}
                    {teacher.id && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--mid-gray)" }}>
                        {teacher.name}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-6" onClick={() => removeTeacher(tIdx)}>
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>

                {/* Assignments */}
                <div className="space-y-2">
                  <Label className="text-xs" style={{ color: "var(--mid-gray)" }}>Assignments</Label>
                  {teacher.assignments.length === 0 && (
                    <p className="text-xs italic text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={12} /> No assignments — teacher will be flagged on submit
                    </p>
                  )}
                  {teacher.assignments.map((a, aIdx) => {
                    const availCourses = coursesForPLevel(a.pLevelName);
                    const availSections = sectionsForPLevel(a.pLevelName);
                    return (
                      <div
                        key={aIdx}
                        className="flex flex-wrap items-start gap-2 rounded p-2"
                        style={{ backgroundColor: "var(--light-gray)" }}
                      >
                        {/* P-Level */}
                        <div className="w-24">
                          <Select
                            value={a.pLevelName}
                            onValueChange={(v) =>
                              updateAssignment(tIdx, aIdx, {
                                pLevelName: v,
                                courseCode: coursesForPLevel(v)[0]?.code ?? "",
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {pLevels.map((pl) => (
                                <SelectItem key={pl.name} value={pl.name}>{pl.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Course */}
                        <div className="w-44">
                          <Select
                            value={a.courseCode || "__none__"}
                            onValueChange={(v) => {
                              const course = availCourses.find((c) => c.code === v);
                              updateAssignment(tIdx, aIdx, {
                                courseCode: v,
                                periodsPerWeek: course?.periodsPerWeek ?? a.periodsPerWeek,
                              });
                            }}
                          >
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {availCourses.length === 0
                                ? <SelectItem value="__none__" disabled>No courses</SelectItem>
                                : availCourses.map((c) => (
                                    <SelectItem key={c.code} value={c.code}>
                                      {c.code} — {c.name}
                                    </SelectItem>
                                  ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Sections */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {availSections.map((sec) => (
                            <label key={sec} className="flex items-center gap-1 text-sm cursor-pointer">
                              <Checkbox
                                checked={a.sections.includes(sec)}
                                onCheckedChange={() => toggleSection(tIdx, aIdx, sec)}
                              />
                              {sec}
                            </label>
                          ))}
                        </div>

                        {/* Periods */}
                        <div className="w-20">
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            min={1}
                            max={20}
                            value={a.periodsPerWeek}
                            onChange={(e) =>
                              updateAssignment(tIdx, aIdx, { periodsPerWeek: +e.target.value })
                            }
                          />
                        </div>

                        <button
                          onClick={() => removeAssignment(tIdx, aIdx)}
                          className="text-gray-400 hover:text-red-500 mt-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                  <Button variant="outline" size="sm" onClick={() => addAssignment(tIdx)}>
                    <Plus size={12} className="mr-1" /> Assignment
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={addTeacher}>
              <Plus size={14} className="mr-1" /> Add Teacher
            </Button>
            <Button
              onClick={handleSubmit}
              style={{ backgroundColor: "var(--navy-blue)" }}
              className="text-white"
            >
              Submit
            </Button>
          </div>
        </>
      )}

      {/* ── PREVIEW VIEW ──────────────────────────────────────────────────────── */}
      {showPreview && (
        <>
          <GenerateButton />

          {warnings.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-start gap-2 text-sm text-amber-700">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Warnings</p>
                    <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                      {warnings.map((w, i) => <li key={i}>{w}</li>)}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border p-2 text-left text-xs w-8">NO</th>
                    <th className="border p-2 text-left text-xs">TEACHER'S NAME</th>
                    <th className="border p-2 text-left text-xs">SUBJECTS</th>
                    <th className="border p-2 text-left text-xs">CLASS</th>
                    <th className="border p-2 text-right text-xs">PERIODS</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.map((teacher, tIdx) => {
                    const rows = teacher.assignments.flatMap((a) =>
                      a.sections.map((sec) => ({
                        subject: a.courseCode,
                        cls: `${a.pLevelName}${sec}`,
                        periods: a.periodsPerWeek,
                      })),
                    );
                    const total = rows.reduce((s, r) => s + r.periods, 0);

                    if (rows.length === 0) {
                      return (
                        <tr key={tIdx} className="bg-amber-50">
                          <td className="border p-2 text-xs text-gray-400">{tIdx + 1}</td>
                          <td className="border p-2 text-xs font-medium">{teacher.name || "—"}</td>
                          <td colSpan={3} className="border p-2 text-xs text-amber-600 italic">
                            No assignments
                          </td>
                        </tr>
                      );
                    }

                    return rows.map((row, rIdx) => (
                      <tr key={`${tIdx}-${rIdx}`}>
                        <td className="border p-2 text-xs text-gray-400">
                          {rIdx === 0 ? tIdx + 1 : ""}
                        </td>
                        <td className="border p-2 text-xs font-medium">
                          {rIdx === 0 ? teacher.name : ""}
                        </td>
                        <td className="border p-2 text-xs">{row.subject}</td>
                        <td className="border p-2 text-xs">{row.cls}</td>
                        <td className="border p-2 text-xs text-right">{row.periods}</td>
                      </tr>
                    )).concat(
                      // Total row
                      [
                        <tr key={`${tIdx}-total`} className="bg-gray-50 font-semibold">
                          <td className="border p-2 text-xs" colSpan={4} style={{ color: "var(--mid-gray)" }}>
                            TOTAL
                          </td>
                          <td className="border p-2 text-xs text-right" style={{ color: "var(--navy-blue)" }}>
                            {total}
                          </td>
                        </tr>,
                      ],
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <GenerateButton />
          </div>
        </>
      )}
    </div>
  );
}
