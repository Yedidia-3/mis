import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    ArrowRightLeft, BarChart3,
    Loader2,
    Scale,
    Shuffle,
    Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";

type AlgorithmKey =
  | "balanced_average"
  | "round_robin"
  | "balanced_bands"
  | "snake_draft";

// Every algorithm now orders students by their marks, not their rank. Rank is
// recorded per class on import, so it cannot be compared across classes; a
// mark can.
const algorithms = [
  {
    id: "balanced_average" as AlgorithmKey,
    name: "Balanced Average",
    description:
      "Each student goes to whichever class currently has the lowest average, so the classes end up with matching average marks",
    icon: Scale,
    color: "var(--maroon)",
    recommended: true,
  },
  {
    id: "balanced_bands" as AlgorithmKey,
    name: "Balanced Bands",
    description:
      "Students split by marks into Top, Middle and Bottom thirds — each class gets a share of every band",
    icon: BarChart3,
    color: "var(--navy-blue)",
  },
  {
    id: "snake_draft" as AlgorithmKey,
    name: "Snake Draft",
    description: "Forward then reverse by marks: 1→A, 2→B, 3→C, then 4→C, 5→B, 6→A…",
    icon: Shuffle,
    color: "var(--gold)",
  },
  {
    id: "round_robin" as AlgorithmKey,
    name: "Round Robin",
    description: "Straight rotation by marks: 1→A, 2→B, 3→C, 4→A… — simple, but favours class A",
    icon: ArrowRightLeft,
    color: "var(--neutral-ink)",
  },
];

interface PLevel { id: number; name: string; academic_year_id: number; }
interface AcademicYear { id: number; name: string; status: string; }

export function AlgorithmSelection() {
  const { pLevelId } = useParams<{ pLevelId: string }>();
  const navigate = useNavigate();
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<AlgorithmKey | null>(null);
  const [pLevel, setPLevel] = useState<PLevel | null>(null);
  const [activeYear, setActiveYear] = useState<AcademicYear | null>(null);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [pl, years] = await Promise.all([
          api.get<any>(`/api/v1/academics/p-levels/${pLevelId}`),
          api.get<any>('/api/v1/academics/academic-years'),
        ]);
        setPLevel(pl);
        const yearList: AcademicYear[] = Array.isArray(years) ? years : years.data ?? [];
        const active = yearList.find(y => y.status === 'active') ?? null;
        setActiveYear(active);

        // Load student count for this p-level
        if (active) {
          const countRes = await api.get<any>(
            `/api/v1/academics/p-levels/${pLevelId}/student-count?academic_year_id=${active.id}`
          );
          setStudentCount(countRes?.count ?? 0);
        } else {
          setStudentCount(0);
        }
      } catch {
        toast.error('Failed to load P-Level data');
      } finally {
        setLoading(false);
      }
    };
    if (pLevelId) load();
  }, [pLevelId]);

  const handleRunAlgorithm = async () => {
    if (!selectedAlgorithm || !pLevelId || !activeYear) return;
    setRunning(true);
    try {
      const result = await api.post<any>('/api/v1/academics/shuffle/run', {
        p_level_id: +pLevelId,
        academic_year_id: activeYear.id,
        algorithm: selectedAlgorithm,
      });
      // The service returns the full preview — get the session id from it
      const sessionId = result?.session?.id ?? result?.id ?? result?.data?.session?.id;
      if (!sessionId) throw new Error('No session ID returned from server');
      navigate(`/dean/preview/${sessionId}`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to run algorithm');
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
      </div>
    );
  }

  const noStudents = studentCount !== null && studentCount === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}
          style={{ color: "var(--maroon)" }}>
          <ArrowLeft size={18} className="mr-2" /> Back
        </Button>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
          Select Shuffle Algorithm — {pLevel?.name ?? `P-Level ${pLevelId}`}
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
          Choose how students will be redistributed into new classes
        </p>
      </div>

      {/* Student count badge */}
      <Card style={{
        borderColor: noStudents ? "var(--danger-red)" : "var(--success-green)",
        borderWidth: "1.5px",
        backgroundColor: noStudents ? "#FEE2E2" : "#F0FDF4",
      }}>
        <CardContent className="p-4 flex items-center gap-3">
          {noStudents ? (
            <AlertCircle size={22} style={{ color: "var(--danger-red)", flexShrink: 0 }} />
          ) : (
            <Users size={22} style={{ color: "var(--success-green)", flexShrink: 0 }} />
          )}
          {noStudents ? (
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--danger-red)" }}>
                No students imported for {pLevel?.name}
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--mid-gray)" }}>
                Go to <strong>Import Data</strong>, select this P-Level, and upload the Excel file first.
              </p>
            </div>
          ) : (
            <p className="font-semibold text-sm" style={{ color: "var(--success-green)" }}>
              {studentCount} student{studentCount !== 1 ? 's' : ''} ready to shuffle in {pLevel?.name}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Algorithm cards — always visible so user can see options */}
      <RadioGroup
        value={selectedAlgorithm || ""}
        onValueChange={(v) => !noStudents && setSelectedAlgorithm(v as AlgorithmKey)}
      >
        <div className="space-y-4">
          {algorithms.map((algorithm) => {
            const Icon = algorithm.icon;
            const isSelected = selectedAlgorithm === algorithm.id;
            return (
              <Card key={algorithm.id}
                className={`transition-all ${noStudents ? "opacity-50" : "cursor-pointer hover:shadow-md"}`}
                style={{
                  borderColor: isSelected ? "var(--maroon)" : "var(--border)",
                  borderWidth: isSelected ? "2px" : "1px",
                }}
                onClick={() => !noStudents && setSelectedAlgorithm(algorithm.id)}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <RadioGroupItem value={algorithm.id} id={algorithm.id}
                      className="flex-shrink-0 mt-1" disabled={noStudents} />
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `color-mix(in srgb, ${algorithm.color} 13%, transparent)` }}>
                      <Icon size={32} style={{ color: algorithm.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Label htmlFor={algorithm.id}
                          className="text-xl font-semibold cursor-pointer"
                          style={{ color: "var(--dark-gray)" }}>
                          {algorithm.name}
                        </Label>
                        {algorithm.recommended && (
                          <span className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ backgroundColor: "var(--gold)", color: "var(--dark-gray)" }}>
                            Recommended
                          </span>
                        )}
                      </div>
                      <p style={{ color: "var(--mid-gray)" }}>{algorithm.description}</p>

                      {/* Visual diagrams */}
                      <div className="mt-4 flex items-center gap-2">
                        {algorithm.id === "balanced_average" && (
                          // Shows the outcome rather than the mechanism: three
                          // classes landing on the same average.
                          <div className="flex items-end gap-3">
                            {[
                              { cls: "A", avg: 67, color: "var(--maroon)" },
                              { cls: "B", avg: 66, color: "var(--navy-blue)" },
                              { cls: "C", avg: 67, color: "var(--gold)" },
                            ].map(({ cls, avg, color }) => (
                              <div key={cls} className="flex flex-col items-center gap-1">
                                <div className="w-10 rounded-t" style={{ height: avg, backgroundColor: color, opacity: 0.85 }} />
                                <span className="text-xs font-semibold" style={{ color: "var(--dark-gray)" }}>{cls}</span>
                                <span className="text-[10px]" style={{ color: "var(--mid-gray)" }}>{avg}%</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {algorithm.id === "round_robin" && (
                          ["A","B","C","A","B","C"].map((label, i) => (
                            <div key={i} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                              style={{ backgroundColor: label === "A" ? "var(--maroon)" : label === "B" ? "var(--navy-blue)" : "var(--gold)" }}>
                              {label}
                            </div>
                          ))
                        )}
                        {algorithm.id === "balanced_bands" && (
                          <div className="space-y-1">
                            {["Top","Mid","Bot"].map((band, i) => (
                              <div key={band} className="flex gap-1">
                                {["A","B","C"].map((cls) => (
                                  <div key={cls} className="w-12 h-6 rounded flex items-center justify-center text-xs font-semibold text-white"
                                    style={{ backgroundColor: i === 0 ? "var(--success-green)" : i === 1 ? "var(--warning-amber)" : "var(--danger-red)", opacity: 0.8 }}>
                                    {cls}
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                        {algorithm.id === "snake_draft" && (
                          ["A","B","C","C","B","A"].map((label, i) => (
                            <div key={i} className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                                style={{ backgroundColor: label === "A" ? "var(--maroon)" : label === "B" ? "var(--navy-blue)" : "var(--gold)" }}>
                                {label}
                              </div>
                              {i < 5 && (
                                <div className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>
                                  {i === 2 ? "⤵" : "→"}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </RadioGroup>

      <Card style={{ borderColor: "var(--border)", backgroundColor: "var(--light-gray)" }}>
        <CardContent className="p-4">
          <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
            <strong style={{ color: "var(--dark-gray)" }}>Note:</strong> Tied students are distributed in their Excel sheet order
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={() => navigate(-1)} className="flex-1 h-11">
          Back
        </Button>
        <Button
          onClick={noStudents ? () => navigate("/dean/import") : handleRunAlgorithm}
          disabled={(!noStudents && (!selectedAlgorithm || running || !activeYear))}
          className="flex-1 h-11"
          style={{
            backgroundColor: noStudents ? "var(--danger-red)" : "var(--maroon)",
            color: "#FFFFFF",
          }}>
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : null}
          {noStudents ? "Go to Import First" : <>Run Algorithm <ArrowRight size={18} className="ml-2" /></>}
        </Button>
      </div>
    </div>
  );
}
