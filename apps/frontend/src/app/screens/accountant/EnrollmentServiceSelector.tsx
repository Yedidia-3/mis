import { Bus, Utensils } from "lucide-react";
import { useNavigate } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";

export function EnrollmentServiceSelector() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>
          Enrollment Management
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--mid-gray)" }}>
          Select a service to manage student enrollments
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Services</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>2</p>
          </CardContent>
        </Card>
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Feeding</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>Active</p>
          </CardContent>
        </Card>
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Transport</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>Active</p>
          </CardContent>
        </Card>
        <Card style={{ borderColor: "var(--border)" }}>
          <CardContent className="p-5">
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Action</p>
            <p className="text-3xl font-bold mt-1" style={{ color: "var(--dark-gray)" }}>Review</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* School Feeding Card */}
        <Card style={{ borderColor: "var(--border)" }} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-8 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: "color-mix(in srgb, var(--gold) 13%, transparent)" }}
            >
              <Utensils size={40} style={{ color: "var(--gold)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--dark-gray)" }}>
              School Feeding
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--mid-gray)" }}>
              Manage breakfast and lunch subscriptions
            </p>
            <Button
              onClick={() => navigate("/accountant/enrollment/feeding")}
              className="w-full h-11"
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
            >
              View Feeding
            </Button>
          </CardContent>
        </Card>

        {/* Transport Card */}
        <Card style={{ borderColor: "var(--border)" }} className="hover:shadow-lg transition-shadow">
          <CardContent className="p-8 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: "color-mix(in srgb, var(--gold) 13%, transparent)" }}
            >
              <Bus size={40} style={{ color: "var(--gold)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--dark-gray)" }}>
              Transport
            </h2>
            <p className="text-sm mb-6" style={{ color: "var(--mid-gray)" }}>
              Manage transport zone subscriptions
            </p>
            <Button
              onClick={() => navigate("/accountant/enrollment/transport")}
              className="w-full h-11"
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
            >
              View Transport
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
