import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../lib/auth";

// Wizard flow removed — redirect to upload-driven timetable view.

interface Plan {
  id: number;
  name: string;
  academic_year_id: number;
  status: "draft" | "generated" | "finalized";
  skeleton_config: any;
  courses_config: any;
  teachers_config: any;
  generation_log: { warnings: string[] } | null;
  slots: any[];
  updated_at: string;
}

export function TimetableWizard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefix = user?.role === "principal" ? "/principal" : "/dean";

  useEffect(() => {
    navigate(`${prefix}/timetable`);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Timetable wizard removed</h2>
      <p className="text-sm mt-2 text-gray-600">The step-by-step wizard has been retired. Use the Timetable Upload screen to provide canonical workbook data.</p>
    </div>
  );
}
