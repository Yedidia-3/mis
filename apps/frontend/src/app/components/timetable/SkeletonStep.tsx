
// Skeleton configuration removed — stub component to avoid build breaks.

interface Break {
  afterPeriod: number;
  durationMinutes: number;
  label: string;
}

interface PLevelSkeleton {
  name: string;
  sections: string[];
  periodsPerDay: number;
  periodDuration: number;
  startTime: string;
  breaks: Break[];
}

interface Props {
  planId: number;
  initial: { pLevels: PLevelSkeleton[] } | null;
  onSaved: () => void;
}

function defaultPLevel(): PLevelSkeleton {
  return {
    name: "",
    sections: ["A"],
    periodsPerDay: 8,
    periodDuration: 40,
    startTime: "07:30",
    breaks: [{ afterPeriod: 4, durationMinutes: 30, label: "Break" }],
  };
}

export function SkeletonStep() {
  return (
    <div className="p-4">
      <h3 className="font-semibold">Skeleton configuration removed</h3>
      <p className="text-sm mt-2 text-gray-600">Skeleton/schedule configuration is no longer supported — upload a workbook with timetable sheets instead.</p>
    </div>
  );
}
