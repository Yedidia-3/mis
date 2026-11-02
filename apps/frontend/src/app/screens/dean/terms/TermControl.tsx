import { CalendarCheck2, CalendarRange, Lock, LockOpen, Pencil, Plus, RotateCcw, Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../lib/api";
import { EmptyState, ErrorState, formatDate, Loading, PageHeader } from "../../../components/academic";
import { Button } from "../../../components/ui/button";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "../../../components/ui/dialog";
import { TermDialog, type TermRow } from "./TermDialog";

interface Overview { academic_year: { id: number; name: string } | null; current_term_id: number | null; terms: TermRow[] }
type Action = { kind: "open" | "close" | "reopen"; term: TermRow };

const STATUS: Record<TermRow["status"], { label: string; bg: string; fg: string }> = {
  upcoming: { label: "Not opened", bg: "var(--light-gray)", fg: "var(--mid-gray)" },
  active: { label: "Open · current term", bg: "color-mix(in srgb, var(--success-green) 12%, white)", fg: "var(--success-green)" },
  closed: { label: "Closed · marks final", bg: "color-mix(in srgb, var(--navy-blue) 10%, white)", fg: "var(--navy-blue)" },
};

export function TermControl() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ term: TermRow | null; sequence: number } | null>(null);
  const [action, setAction] = useState<Action | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await api.get<Overview>("/api/v1/academics/assessments/terms/overview")); }
    catch (e: any) { setError(e?.message ?? "Could not load the terms"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = data?.terms.find((t) => t.id === data.current_term_id) ?? null;
  const nextSequence = [1, 2, 3].find((s) => !data?.terms.some((t) => t.sequence === s));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Terms"
        subtitle={data?.academic_year
          ? `Academic year ${data.academic_year.name}. Teachers record marks only in the open term.`
          : "Open a term for teachers to record marks, and close it when its marks are final."}
        actions={data?.academic_year && nextSequence && (
          <Button variant="outline" onClick={() => setEditing({ term: null, sequence: nextSequence })}>
            <Plus size={16} className="mr-1.5" /> Add term {nextSequence}
          </Button>
        )}
      />

      {error ? <ErrorState message={error} onRetry={load} /> : !data ? <Loading /> : !data.academic_year ? (
        <EmptyState icon={<CalendarRange size={44} />} title="No active academic year">
          Terms are set up once the administrator activates an academic year.
        </EmptyState>
      ) : (
        <>
          <CurrentBanner current={current} hasTerms={data.terms.length > 0} />

          {data.terms.length === 0 ? (
            <EmptyState icon={<CalendarRange size={44} />} title="No terms yet">
              Add term 1 with its dates, then open it so teachers can start recording marks.
            </EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {data.terms.map((t) => (
                <TermCard key={t.id} term={t} blockedBy={current && current.id !== t.id ? current : null}
                  onEdit={() => setEditing({ term: t, sequence: t.sequence })}
                  onAction={(kind) => setAction({ kind, term: t })} />
              ))}
            </div>
          )}

          <TermDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} yearId={data.academic_year.id}
            term={editing?.term ?? null} sequence={editing?.sequence ?? 1} terms={data.terms} onSaved={load} />
          <ConfirmAction action={action} onClose={() => setAction(null)} onDone={load} />
        </>
      )}
    </div>
  );
}

function CurrentBanner({ current, hasTerms }: { current: TermRow | null; hasTerms: boolean }) {
  const open = !!current;
  return (
    <div className="rounded-2xl border p-4 flex items-start gap-3"
      style={{
        borderColor: open ? "color-mix(in srgb, var(--success-green) 35%, white)" : "color-mix(in srgb, var(--warning-amber) 45%, white)",
        backgroundColor: open ? "color-mix(in srgb, var(--success-green) 6%, white)" : "color-mix(in srgb, var(--warning-amber) 8%, white)",
      }}>
      {open ? <CalendarCheck2 size={22} style={{ color: "var(--success-green)" }} className="mt-0.5 shrink-0" />
        : <Lock size={22} style={{ color: "var(--warning-amber)" }} className="mt-0.5 shrink-0" />}
      <div className="text-sm" style={{ color: "var(--dark-gray)" }}>
        {open ? (
          <>
            <div className="font-semibold">Current term: {current.name}</div>
            <div style={{ color: "var(--mid-gray)" }}>
              {formatDate(current.start_date)} to {formatDate(current.end_date)}. New assessments go into {current.name} automatically.
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold">No term is open</div>
            <div style={{ color: "var(--mid-gray)" }}>
              {hasTerms ? "Teachers cannot record marks until you open a term." : "Add a term to get started."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TermCard({ term, blockedBy, onEdit, onAction }: {
  term: TermRow; blockedBy: TermRow | null; onEdit: () => void; onAction: (k: Action["kind"]) => void;
}) {
  const s = STATUS[term.status];
  const isOpen = term.status === "active";
  return (
    <div className="bg-white rounded-2xl border p-5 flex flex-col"
      style={{ borderColor: isOpen ? "var(--success-green)" : "var(--border)", boxShadow: isOpen ? "0 0 0 1px var(--success-green)" : undefined }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--mid-gray)" }}>Term {term.sequence}</div>
          <div className="text-lg font-semibold truncate" style={{ color: "var(--dark-gray)" }}>{term.name}</div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
          style={{ backgroundColor: s.bg, color: s.fg }}>{s.label}</span>
      </div>
      <div className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>
        {formatDate(term.start_date)} to {formatDate(term.end_date)}
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: "var(--dark-gray)" }}>{term.submitted}</div>
          <div className="text-xs" style={{ color: "var(--mid-gray)" }}>Submitted</div>
        </div>
        <div>
          <div className="text-xl font-semibold tabular-nums" style={{ color: term.drafts ? "var(--warning-amber)" : "var(--dark-gray)" }}>{term.drafts}</div>
          <div className="text-xs" style={{ color: "var(--mid-gray)" }}>Drafts</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {term.status === "upcoming" && (
          <Button disabled={!!blockedBy} onClick={() => onAction("open")} style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
            <LockOpen size={16} className="mr-1.5" /> Open term
          </Button>
        )}
        {isOpen && (
          <Button onClick={() => onAction("close")} style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>
            <Lock size={16} className="mr-1.5" /> Close term
          </Button>
        )}
        {term.status === "closed" && (
          <Button variant="outline" disabled={!!blockedBy} onClick={() => onAction("reopen")}>
            <RotateCcw size={16} className="mr-1.5" /> Reopen
          </Button>
        )}
        {term.status !== "closed" && (
          <Button variant="outline" onClick={onEdit}><Pencil size={15} className="mr-1.5" /> Edit dates</Button>
        )}
      </div>
      {blockedBy && term.status !== "active" && (
        <p className="text-xs mt-2" style={{ color: "var(--mid-gray)" }}>Close {blockedBy.name} before opening this term.</p>
      )}
    </div>
  );
}

function ConfirmAction({ action, onClose, onDone }: { action: Action | null; onClose: () => void; onDone: () => void }) {
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setAck(false); }, [action]);

  if (!action) return null;
  const { kind, term } = action;
  const needsAck = (kind === "close" && term.drafts > 0) || kind === "reopen";

  const run = async () => {
    setBusy(true);
    try {
      if (kind === "close") {
        await api.post(`/api/v1/academics/assessments/terms/${term.id}/close`, { confirm_drafts: ack });
        toast.success(`${term.name} closed. Its marks are final.`);
      } else {
        await api.post(`/api/v1/academics/assessments/terms/${term.id}/open`, {});
        toast.success(kind === "open" ? `${term.name} is now the current term` : `${term.name} reopened`);
      }
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not change the term");
    } finally {
      setBusy(false);
    }
  };

  const copy = {
    open: {
      title: `Open ${term.name}?`,
      body: `${term.name} becomes the current term. Teachers' new assessments go into it automatically, and everyone is notified.`,
      ack: "",
      cta: "Open term",
    },
    close: {
      title: `Close ${term.name}?`,
      body: `Teachers can no longer add, edit or delete marks in ${term.name}. ${term.submitted} submitted assessment${term.submitted === 1 ? "" : "s"} become final for reports.`,
      ack: `${term.drafts} assessment${term.drafts === 1 ? " is" : "s are"} still in draft. ${term.drafts === 1 ? "It" : "They"} will be locked and left off report cards.`,
      cta: "Close term",
    },
    reopen: {
      title: `Reopen ${term.name}?`,
      body: `${term.name} becomes the current term again, so its marks can change. Report cards already generated for it will not update until you generate them again.`,
      ack: "I understand marks in this term can change after reopening.",
      cta: "Reopen term",
    },
  }[kind];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        {needsAck && (
          <label className="flex items-start gap-2.5 rounded-xl border p-3 text-sm cursor-pointer"
            style={{ borderColor: "color-mix(in srgb, var(--warning-amber) 45%, white)", backgroundColor: "color-mix(in srgb, var(--warning-amber) 8%, white)" }}>
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
            <span>{copy.ack}{kind === "close" ? " I want to close anyway." : ""}</span>
          </label>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={busy || (needsAck && !ack)}
            style={{ backgroundColor: kind === "close" ? "var(--navy-blue)" : "var(--maroon)", color: "#fff" }}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
