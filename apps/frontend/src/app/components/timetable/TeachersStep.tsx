
// Teachers assignment UI removed. Placeholder instructing to use upload.

interface Assignment {
  pLevelName: string;
  courseCode: string;
  sections: string[];
  periodsPerWeek: number;
}

interface Teacher {
  id?: number;
  name: string;
  assignments: Assignment[];
}

interface PLevelInfo {
  name: string;
  sections: string[];
  courses: { code: string; name: string; periodsPerWeek: number }[];
}

interface DBTeacher {
  id: number;
  name: string;
  assignments: Assignment[];
}

interface Props {
  planId: number;
  academicYearId: number;
  pLevels: PLevelInfo[];
  initial: { teachers: Teacher[] } | null;
  onSaved: () => void;
}

function blankAssignment(pLevels: PLevelInfo[]): Assignment {
  return {
    pLevelName: pLevels[0]?.name ?? "",
    courseCode: "",
    sections: [],
    periodsPerWeek: 5,
  };
}

export function TeachersStep() {
  return (
    <div className="p-4">
      <h3 className="font-semibold">Teachers assignment removed</h3>
      <p className="text-sm mt-2 text-gray-600">Manual teacher assignment and in-app generation have been removed. Upload a workbook with class sheets and a global view; teachers will receive their class view automatically.</p>
    </div>
  );
}
