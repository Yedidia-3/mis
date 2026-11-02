import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import {
  normaliseText, parseBoundedNumber, RULES, sanitiseNumberTyping, sanitiseTyping, validateGroup,
} from "../../../../lib/academicRules";
import { FieldError } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

interface Row { id: number; name: string; code: string; max: string; group: string; order: string }

/**
 * The report maximum of each subject at a level. TJ and EXAM are each out of
 * it and the subject total out of twice it, as on the school's bulletin.
 */
export function SubjectMaximaDialog({ open, onOpenChange, pLevelId, levelName, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; pLevelId: number; levelName: string; onSaved: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(null);
    api.get<{ subjects: any[] }>(`/api/v1/academics/reports/levels/${pLevelId}/subjects`)
      .then((r) => setRows(r.subjects.map((s) => ({
        id: s.id, name: s.name, code: s.code,
        max: s.report_max === null ? "" : String(s.report_max),
        group: s.report_group ?? "", order: String(s.display_order ?? 0),
      }))))
      .catch((e) => { toast.error(e?.message ?? "Could not load subjects"); onOpenChange(false); });
  }, [open, pLevelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const errorsOf = (r: Row) => ({
    max: parseBoundedNumber(r.max, RULES.REPORT_MAX_MIN, RULES.REPORT_MAX_MAX, "Maximum").error,
    group: validateGroup(r.group),
    order: /^\d{1,3}$/.test(r.order) ? null : "0–999",
  });
  const invalid = (rows ?? []).some((r) => Object.values(errorsOf(r)).some(Boolean));
  const total = (rows ?? []).reduce((n, r) => n + (Number(r.max) || 0), 0);

  const update = (id: number, patch: Partial<Row>) => setRows((p) => p && p.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!rows || invalid) return;
    setSaving(true);
    try {
      await api.put(`/api/v1/academics/reports/levels/${pLevelId}/subjects`, {
        subjects: rows.map((r) => ({
          id: r.id,
          report_max: Number(r.max),
          report_group: normaliseText(r.group) || null,
          display_order: Number(r.order),
        })),
      });
      toast.success(`Report maxima saved for ${levelName}`);
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report maxima · {levelName}</DialogTitle>
          <DialogDescription>
            TJ and EXAM are each marked out of this number; the subject total is out of twice it. Subjects sharing a group (e.g. English) print together under one heading.
          </DialogDescription>
        </DialogHeader>
        {!rows ? <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div> : rows.length === 0 ? (
          <p className="text-sm py-6" style={{ color: "var(--mid-gray)" }}>{levelName} has no subjects yet. Add them from Courses.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ color: "var(--mid-gray)" }}>
                  <th className="py-2 pr-2 font-medium">Subject</th>
                  <th className="py-2 px-2 font-medium w-28">Max (TJ/EXAM)</th>
                  <th className="py-2 px-2 font-medium w-40">Group</th>
                  <th className="py-2 pl-2 font-medium w-20">Order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = errorsOf(r);
                  return (
                    <tr key={r.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}>
                      <td className="py-2 pr-2"><div style={{ color: "var(--dark-gray)" }}>{r.name}</div><div className="text-xs" style={{ color: "var(--mid-gray)" }}>{r.code}</div></td>
                      <td className="py-2 px-2">
                        <Input inputMode="decimal" value={r.max} aria-label={`Maximum for ${r.name}`} aria-invalid={!!e.max}
                          onChange={(ev) => { const v = sanitiseNumberTyping(ev.target.value); if (v !== null) update(r.id, { max: v }); }} />
                        <FieldError message={e.max} />
                      </td>
                      <td className="py-2 px-2">
                        <Input value={r.group} maxLength={RULES.GROUP_MAX} placeholder="None" aria-label={`Group for ${r.name}`} aria-invalid={!!e.group}
                          onChange={(ev) => update(r.id, { group: sanitiseTyping(ev.target.value, RULES.GROUP_MAX) })} />
                        <FieldError message={e.group} />
                      </td>
                      <td className="py-2 pl-2">
                        <Input inputMode="numeric" value={r.order} aria-label={`Order of ${r.name}`} aria-invalid={!!e.order}
                          onChange={(ev) => { if (/^\d{0,3}$/.test(ev.target.value)) update(r.id, { order: ev.target.value }); }} />
                        <FieldError message={e.order} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-xs mt-3" style={{ color: "var(--mid-gray)" }}>
              Total per half: <b className="tabular-nums">{Math.round(total * 100) / 100}</b> · whole bulletin out of <b className="tabular-nums">{Math.round(total * 200) / 100}</b>
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={!rows || invalid || saving} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save maxima
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
