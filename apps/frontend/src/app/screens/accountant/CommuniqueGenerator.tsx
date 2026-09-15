import { useState, useEffect, useRef } from "react";
import { FileText, Download, CheckSquare, Loader2, Printer, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { api } from "../../../lib/api";
import { toast } from "sonner";

interface ExpiringEnrollment {
  id: number;
  type: 'feeding' | 'transport';
  meal_type: string | null;
  expiry_date: string;
  student: {
    id: number;
    name: string;
    current_class: { name: string; p_level: { name: string; }; } | null;
  } | null;
  zone: { name: string; } | null;
}

const FILTER_OPTIONS = [
  { label: 'Expiring Today', days: 0 },
  { label: 'Expiring in 2 Days', days: 2 },
  { label: 'Expiring in 3 Days', days: 3 },
  { label: 'Expiring in 7 Days', days: 7 },
];

// Friendly fill-in fields. Staff click a button to drop one in — they never
// type code. Each [Field] is automatically replaced with the student's detail.
const TOKENS: { token: string; label: string; desc: string }[] = [
  { token: "[Student Name]", label: "Student Name", desc: "e.g. Alice Mukamana" },
  { token: "[Class]",        label: "Class",        desc: "e.g. P2A" },
  { token: "[Service]",      label: "Service",      desc: "e.g. Feeding – Lunch" },
  { token: "[Expiry Date]",  label: "Expiry Date",  desc: "e.g. 12 Jun 2026" },
  { token: "[Today's Date]", label: "Today's Date", desc: "today's date" },
];

const DEFAULT_TEMPLATE =
`Dear Parent/Guardian of [Student Name],

This is a friendly reminder that your child's [Service] subscription (Class [Class]) expires on [Expiry Date].

Kindly visit the school accounting office to renew before the expiry date so the service is not interrupted.

Thank you for your cooperation,
Jericho School — Accounting Office
[Today's Date]`;

const TEMPLATE_KEY = "jericho.communique.template.v2";

function fmtDate(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function getServiceLabel(e: ExpiringEnrollment): string {
  if (e.type === 'feeding') {
    if (e.meal_type === 'breakfast') return 'Feeding – Breakfast';
    if (e.meal_type === 'lunch') return 'Feeding – Lunch';
    return 'Feeding – Breakfast & Lunch';
  }
  if (e.type === 'transport') return e.zone ? `Transport – ${e.zone.name}` : 'Transport';
  return e.type;
}

function getClassName(e: ExpiringEnrollment): string {
  if (!e.student?.current_class) return '—';
  return `${e.student.current_class.p_level?.name ?? ''}${e.student.current_class.name}`;
}

function fillTemplate(tpl: string, e: ExpiringEnrollment): string {
  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  // split/join avoids regex escaping issues with the readable [Field] labels
  return tpl
    .split("[Student Name]").join(e.student?.name ?? "")
    .split("[Class]").join(getClassName(e))
    .split("[Service]").join(getServiceLabel(e))
    .split("[Expiry Date]").join(fmtDate(e.expiry_date))
    .split("[Today's Date]").join(today);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function CommuniqueGenerator() {
  const [enrollments, setEnrollments] = useState<ExpiringEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDays, setFilterDays] = useState<string>("3");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState<"select" | "compose">("select");
  const [template, setTemplate] = useState<string>(() => localStorage.getItem(TEMPLATE_KEY) || DEFAULT_TEMPLATE);
  const [perPage, setPerPage] = useState<string>("4");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = async (days: number) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res = await api.get<any>(`/api/v1/accountant/enrollments/expiring?days=${days}`);
      setEnrollments(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      toast.error('Failed to load expiring enrollments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(+filterDays); }, [filterDays]);
  useEffect(() => { localStorage.setItem(TEMPLATE_KEY, template); }, [template]);

  const handleSelectAll = (checked: boolean) =>
    setSelected(checked ? new Set(enrollments.map(e => e.id)) : new Set());

  const handleSelect = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const selectedEnrollments = enrollments.filter(e => selected.has(e.id));
  const selectedCount = selectedEnrollments.length;
  const previewStudent = selectedEnrollments[0] ?? enrollments[0];

  const insertToken = (token: string) => {
    const ta = textareaRef.current;
    if (!ta) { setTemplate(t => t + token); return; }
    const start = ta.selectionStart ?? template.length;
    const end = ta.selectionEnd ?? template.length;
    const next = template.slice(0, start) + token + template.slice(end);
    setTemplate(next);
    // restore caret after the inserted token
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const isExpiredToday = (expiry: string) => expiry === new Date().toISOString().split('T')[0];

  const handlePrint = () => {
    if (selectedCount === 0) { toast.error("Select at least one student"); return; }

    const per = Math.max(1, +perPage);
    const single = per === 1;

    // Chunk students into pages of `per`
    const pages: ExpiringEnrollment[][] = [];
    for (let i = 0; i < selectedEnrollments.length; i += per) {
      pages.push(selectedEnrollments.slice(i, i + per));
    }

    const slipHtml = (e: ExpiringEnrollment) => `
      <div class="slip">
        <div class="head">JERICHO SCHOOL <span class="sub">— Payment Reminder</span></div>
        <div class="body">${escapeHtml(fillTemplate(template, e)).replace(/\n/g, "<br/>")}</div>
      </div>`;

    const pagesHtml = pages.map(group =>
      `<div class="page">${group.map(slipHtml).join('<div class="cut"></div>')}</div>`
    ).join("");

    // Single-per-page = big formal letter; multi-per-page = compact cut-out slips
    const css = single
      ? `
        .page { page-break-after: always; padding: 56px 64px; }
        .page:last-child { page-break-after: auto; }
        .slip { }
        .head { color:var(--maroon); font-size:26px; font-weight:800; text-align:center; }
        .sub { color:var(--navy-blue); font-size:14px; font-weight:600; }
        .body { font-size:16px; line-height:1.8; margin-top:18px; border-top:2px solid var(--gold); padding-top:18px; }
        .cut { display:none; }`
      : `
        .page { page-break-after: always; padding: 24px 28px; }
        .page:last-child { page-break-after: auto; }
        .slip { padding: 10px 4px; }
        .head { color:var(--maroon); font-size:15px; font-weight:800; }
        .sub { color:var(--navy-blue); font-size:11px; font-weight:600; }
        .body { font-size:12.5px; line-height:1.45; margin-top:6px; }
        .cut { border-top:1px dashed #B0B0B0; margin:6px 0; }`;

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Communiqués</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; color: var(--dark-gray); margin: 0; }
        ${css}
      </style></head><body>${pagesHtml}</body></html>`;

    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast.error("Pop-up blocked — allow pop-ups to print"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 300);
    toast.success(`${selectedCount} communiqué(s) prepared — ${pages.length} page${pages.length !== 1 ? 's' : ''}`);
  };

  const handleDownload = () => {
    if (selectedCount === 0) { toast.error("Select at least one student"); return; }
    const text = selectedEnrollments.map(e =>
      fillTemplate(template, e) + "\n\n" + "—".repeat(40) + "\n\n"
    ).join("");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `communiques-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${selectedCount} communiqué(s) downloaded`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Generate Communiqué</h1>
        <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
          Write your own message once, then send it to many students — names and details fill in automatically.
        </p>
      </div>

      {/* Step Indicator */}
      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-4">
          <div className="flex items-center">
            {["Select Students", "Write & Generate"].map((step, index) => {
              const stepKey = ["select", "compose"][index];
              const active = currentStep === stepKey;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm"
                      style={{ backgroundColor: active ? "var(--maroon)" : "var(--border)", color: active ? "#FFFFFF" : "var(--mid-gray)" }}>
                      {index + 1}
                    </div>
                    <p className="text-sm mt-2 font-medium whitespace-nowrap"
                      style={{ color: active ? "var(--maroon)" : "var(--mid-gray)" }}>{step}</p>
                  </div>
                  {index < 1 && <div className="h-0.5 flex-1 mx-4 -mt-6" style={{ backgroundColor: "var(--border)" }} />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Select Students */}
      {currentStep === "select" && (
        <Card style={{ borderColor: "var(--border)" }}>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Expiring Enrollments</CardTitle>
              <Select value={filterDays} onValueChange={setFilterDays}>
                <SelectTrigger className="w-52 h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILTER_OPTIONS.map(o => <SelectItem key={o.days} value={String(o.days)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin" size={28} style={{ color: "var(--navy-blue)" }} />
              </div>
            ) : enrollments.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto mb-3" style={{ color: "var(--mid-gray)" }} />
                <p className="text-lg font-semibold" style={{ color: "var(--dark-gray)" }}>No Expiring Enrollments</p>
                <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
                  No enrollments expiring within the selected timeframe.
                </p>
              </div>
            ) : (
              <>
                <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
                  <Table>
                    <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                      <TableRow>
                        <TableHead className="text-white w-12">
                          <Checkbox checked={enrollments.length > 0 && selected.size === enrollments.length}
                            onCheckedChange={handleSelectAll} />
                        </TableHead>
                        <TableHead className="text-white">Student</TableHead>
                        <TableHead className="text-white">Class</TableHead>
                        <TableHead className="text-white">Service</TableHead>
                        <TableHead className="text-white">Expiry Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {enrollments.map((e, index) => (
                        <TableRow key={e.id} style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}>
                          <TableCell>
                            <Checkbox checked={selected.has(e.id)}
                              onCheckedChange={(checked) => handleSelect(e.id, checked as boolean)} />
                          </TableCell>
                          <TableCell className="font-medium" style={{ color: "var(--dark-gray)" }}>{e.student?.name ?? '—'}</TableCell>
                          <TableCell>
                            <span className="px-2 py-1 rounded text-xs font-semibold text-white"
                              style={{ backgroundColor: "var(--navy-blue)" }}>{getClassName(e)}</span>
                          </TableCell>
                          <TableCell style={{ color: "var(--dark-gray)" }}>{getServiceLabel(e)}</TableCell>
                          <TableCell className="font-medium"
                            style={{ color: isExpiredToday(e.expiry_date) ? "var(--danger-red)" : "var(--warning-amber)" }}>
                            {fmtDate(e.expiry_date)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckSquare size={20} style={{ color: "var(--maroon)" }} />
                    <span className="font-medium" style={{ color: "var(--dark-gray)" }}>
                      {selectedCount} student{selectedCount !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <Button onClick={() => setCurrentStep("compose")} disabled={selectedCount === 0}
                    className="h-11" style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                    Continue to Write Message
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Write & Generate */}
      {currentStep === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <Card style={{ borderColor: "var(--border)" }}>
            <CardHeader>
              <CardTitle>Your Message</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm mb-2" style={{ color: "var(--mid-gray)" }}>
                  Click a button to drop in a detail — it fills in automatically for each student:
                </p>
                <div className="flex flex-wrap gap-2">
                  {TOKENS.map(t => (
                    <button key={t.token} onClick={() => insertToken(t.token)} title={`Inserts the ${t.desc}`}
                      className="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors hover:bg-gray-50"
                      style={{ borderColor: "var(--gold)", color: "var(--maroon)", backgroundColor: "#FFFDF5" }}>
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                ref={textareaRef}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                rows={14}
                className="w-full rounded-lg border p-4 text-sm leading-relaxed font-mono resize-y focus:outline-none"
                style={{ borderColor: "var(--border)", color: "var(--dark-gray)" }}
                placeholder="Write your communiqué here. Use the placeholder buttons above."
              />

              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setTemplate(DEFAULT_TEMPLATE)}
                  style={{ color: "var(--mid-gray)" }}>
                  <RotateCcw size={14} className="mr-1" /> Reset to default
                </Button>
                <span className="text-xs" style={{ color: "var(--mid-gray)" }}>Your message is saved automatically</span>
              </div>
            </CardContent>
          </Card>

          {/* Live preview */}
          <Card style={{ borderColor: "var(--border)" }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Live Preview</CardTitle>
                {previewStudent && (
                  <span className="text-xs" style={{ color: "var(--mid-gray)" }}>
                    Showing: <strong style={{ color: "var(--dark-gray)" }}>{previewStudent.student?.name}</strong>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed rounded-lg p-6"
                style={{ borderColor: "var(--border)", backgroundColor: "#FAFAFA", minHeight: 280 }}>
                <div className="text-center">
                  <div className="text-xl font-extrabold" style={{ color: "var(--maroon)" }}>JERICHO SCHOOL</div>
                  <div className="text-sm" style={{ color: "var(--navy-blue)" }}>Payment Reminder</div>
                </div>
                <div className="h-0.5 my-4" style={{ backgroundColor: "var(--gold)" }} />
                <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--dark-gray)" }}>
                  {previewStudent ? fillTemplate(template, previewStudent) : "Select students to preview."}
                </p>
              </div>

              <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: "#F0FDF4" }}>
                <p className="text-sm" style={{ color: "var(--success-green)" }}>
                  This message will be generated for <strong>{selectedCount}</strong> student{selectedCount !== 1 ? 's' : ''}
                  {selectedCount > 0 && (
                    <> — <strong>{Math.ceil(selectedCount / Math.max(1, +perPage))}</strong> page{Math.ceil(selectedCount / Math.max(1, +perPage)) !== 1 ? 's' : ''} at {perPage} per page.</>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="lg:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => setCurrentStep("select")} className="h-11">
              Back to Selection
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              {/* Students per printed page */}
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--mid-gray)" }}>Per page:</span>
                <Select value={perPage} onValueChange={setPerPage}>
                  <SelectTrigger className="w-36 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (full letter)</SelectItem>
                    <SelectItem value="2">2 students</SelectItem>
                    <SelectItem value="3">3 students</SelectItem>
                    <SelectItem value="4">4 students</SelectItem>
                    <SelectItem value="6">6 students</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={handleDownload} className="h-11"
                style={{ color: "var(--maroon)", borderColor: "var(--maroon)" }}>
                <Download size={18} className="mr-2" /> Download (.txt)
              </Button>
              <Button onClick={handlePrint} className="h-11"
                style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                <Printer size={18} className="mr-2" /> Print / Save as PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
