
// Slot editing removed. Keep a lightweight stub so imports compile.

interface Slot {
  id: number;
  day: number;
  period: number;
  p_level_name: string;
  course_code: string | null;
  teacher_name: string | null;
  is_break: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: number;
  academicYearId: number;
  slot: Slot | null;
  /** Courses available for the slot's p-level, from the plan's courses_config */
  availableCourses: { code: string; name: string }[];
  onSaved: () => void;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const CLEAR = "__clear__";

export function SlotEditDialog() {
  return null;
}
