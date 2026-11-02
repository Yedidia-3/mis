import { AlertTriangle, ChevronLeft, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { categoryLabel } from "../../lib/academicRules";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  quiz: { bg: "color-mix(in srgb, var(--info-blue) 12%, white)", fg: "var(--info-blue)" },
  homework: { bg: "color-mix(in srgb, var(--success-green) 12%, white)", fg: "var(--success-green)" },
  exam: { bg: "color-mix(in srgb, var(--maroon) 12%, white)", fg: "var(--maroon)" },
};

export function CategoryBadge({ category }: { category: string | null | undefined }) {
  const c = CATEGORY_COLORS[category ?? ""] ?? { bg: "var(--light-gray)", fg: "var(--mid-gray)" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: c.bg, color: c.fg }}>
      {categoryLabel(category)}
    </span>
  );
}

export function StatusBadge({ status }: { status: "draft" | "submitted" | string }) {
  const submitted = status === "submitted";
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        backgroundColor: submitted ? "color-mix(in srgb, var(--success-green) 12%, white)" : "color-mix(in srgb, var(--warning-amber) 14%, white)",
        color: submitted ? "var(--success-green)" : "var(--warning-amber)",
      }}>
      {submitted ? "Submitted" : "Draft"}
    </span>
  );
}

export function TeacherAvatar({ name, avatar, size = 48 }: { name: string; avatar?: string | null; size?: number }) {
  const initials = name.split(" ").filter(Boolean).map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <Avatar className="flex-shrink-0" style={{ width: size, height: size, backgroundColor: "var(--navy-blue)" }}>
      {avatar && <AvatarImage src={avatar} alt={name} />}
      <AvatarFallback className="text-white font-semibold" style={{ fontSize: size / 2.6 }}>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function PageHeader({ title, subtitle, back, actions }: {
  title: ReactNode; subtitle?: ReactNode; back?: string; actions?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Button variant="ghost" size="sm" className="-ml-2 mb-1 h-8 px-2" onClick={() => (back === "history" ? navigate(-1) : navigate(back))}
            style={{ color: "var(--mid-gray)" }}>
            <ChevronLeft size={16} className="mr-1" /> Back
          </Button>
        )}
        <h1 className="text-2xl font-semibold tracking-[-0.02em]" style={{ color: "var(--dark-gray)" }}>{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: "var(--mid-gray)" }}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "var(--mid-gray)" }}>
      <Loader2 className="animate-spin" size={30} style={{ color: "var(--navy-blue)" }} />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6 border border-dashed rounded-2xl bg-white" style={{ borderColor: "var(--border)" }}>
      <div className="mx-auto mb-3 flex justify-center" style={{ color: "var(--mid-gray)" }}>{icon}</div>
      <p className="text-base font-semibold" style={{ color: "var(--dark-gray)" }}>{title}</p>
      {children && <div className="text-sm mt-2 max-w-md mx-auto" style={{ color: "var(--mid-gray)" }}>{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6 border rounded-2xl bg-white gap-3" style={{ borderColor: "var(--border)" }}>
      <AlertTriangle size={36} style={{ color: "var(--danger-red)" }} />
      <p className="text-sm max-w-md" style={{ color: "var(--dark-gray)" }}>{message}</p>
      {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="text-xs mt-1" role="alert" style={{ color: "var(--danger-red)" }}>{message}</p>;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
