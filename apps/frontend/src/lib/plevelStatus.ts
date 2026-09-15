// Unified P-Level / class status used across the Dean's modules.
// We no longer track approval-based stages here. The school now uses only two
// states:
//   • On Hold — not yet created / not yet distributed
//   • Active  — created and distributed

export interface PLevelLike {
  student_count?: number;
  class_count?: number;
  is_distributed?: boolean;
  any_distributed?: boolean;
}

export interface StatusMeta {
  key: "on-hold" | "active";
  label: string;
  color: string;
  bg: string;
}

export function pLevelStatus(pl: PLevelLike): StatusMeta {
  const students = pl.student_count ?? 0;
  const isActive = (pl.is_distributed || pl.any_distributed) && students > 0;

  if (isActive) {
    return { key: "active", label: "Active", color: "#1A7F4B", bg: "#F0FDF4" };
  }

  return { key: "on-hold", label: "On Hold", color: "#9A9A9A", bg: "#F4F4F6" };
}
