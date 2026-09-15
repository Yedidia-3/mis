import { useNavigate } from "react-router";
import { Eye, Wand2 } from "lucide-react";
import { Card, CardContent } from "../../components/ui/card";
import { useAuth } from "../../../lib/auth";

export function TimetableHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prefix = user?.role === "principal" ? "/principal" : "/dean";

  const options = [
    {
      icon: Eye,
      title: "View Timetable",
      description: "Browse the full school timetable. Filter by P-Level, teacher, or course.",
      path: `${prefix}/timetable/view`,
    },
    {
      icon: Wand2,
      title: "Generate Timetable",
      description: "Enter teacher assignments and let the system build a conflict-free timetable.",
      path: `${prefix}/timetable/generate`,
      deanOnly: true,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-8">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: "var(--navy-blue)" }}>Timetable</h2>
        <p className="text-sm text-gray-500 mt-1">What would you like to do?</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {options
          .filter((o) => !o.deanOnly || user?.role === "dean")
          .map((opt) => {
            const Icon = opt.icon;
            return (
              <Card
                key={opt.path}
                className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-[var(--navy-blue)]"
                onClick={() => navigate(opt.path)}
              >
                <CardContent className="p-6 space-y-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: "var(--navy-blue)" }}
                  >
                    <Icon size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-base" style={{ color: "var(--navy-blue)" }}>
                      {opt.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">{opt.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
