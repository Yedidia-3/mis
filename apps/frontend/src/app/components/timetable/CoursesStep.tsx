
// Courses step removed. Keep placeholder to avoid breaking imports.

interface Course {
  code: string;
  name: string;
  periodsPerWeek: number;
  minConsecutive: number;
}

interface PLevelCourses {
  name: string;
  courses: Course[];
}

interface Props {
  planId: number;
  academicYearId: number;
  pLevelNames: string[];
  initial: { pLevels: PLevelCourses[] } | null;
  onSaved: () => void;
}

export function CoursesStep() {
  return (
    <div className="p-4">
      <h3 className="font-semibold">Courses configuration removed</h3>
      <p className="text-sm mt-2 text-gray-600">Course and skeleton configuration for timetable generation have been removed. Upload a workbook containing course allocations and schedules instead.</p>
    </div>
  );
}
