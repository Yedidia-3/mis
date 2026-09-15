import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../../../lib/auth";

// Timetable planning / plan list removed. Redirect users to upload-driven flow.

interface AcademicYear { id: number; name: string; status: string }

interface Plan {
  id: number;
  name: string;
  status: "draft" | "generated" | "finalized";
  created_at: string;
  updated_at: string;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Draft",     color: "var(--mid-gray)", bg: "var(--light-gray)" },
  generated: { label: "Generated", color: "var(--warning-amber)", bg: "#FEF3E8" },
  finalized: { label: "Finalized", color: "var(--success-green)", bg: "#F0FDF4" },
};

export function TimetablePlanning() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefix = user?.role === "principal" ? "/principal" : "/dean";

  useEffect(() => {
    navigate(`${prefix}/timetable`);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold">Timetable planning removed</h2>
      <p className="text-sm mt-2 text-gray-600">Planning and plan lifecycle have been retired. Use the Timetable Upload screen to provide canonical workbook data.</p>
    </div>
  );
}
