import { useNavigate } from "react-router";
import { Lock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../../lib/auth";

const roleDashboardRoutes: Record<string, string> = {
  super_admin: "/admin/dashboard",
  dean: "/dean/dashboard",
  principal: "/principal/dashboard",
  teacher: "/teacher/dashboard",
  accountant: "/accountant/dashboard",
};

export function UnauthorizedScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGoDashboard = () => {
    if (user?.role && roleDashboardRoutes[user.role]) {
      navigate(roleDashboardRoutes[user.role], { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "var(--light-gray)" }}>
      <div className="text-center space-y-6 max-w-md px-6">
        <Lock size={64} style={{ color: "var(--gold)" }} className="mx-auto" />
        <h2 className="text-3xl font-semibold" style={{ color: "var(--dark-gray)" }}>Access Denied</h2>
        <p className="text-lg" style={{ color: "var(--mid-gray)" }}>
          You don't have permission to view this page.
        </p>
        <Button
          onClick={handleGoDashboard}
          className="h-11 px-6"
          style={{ backgroundColor: "var(--navy-blue)", color: "#FFFFFF" }}
        >
          Go back to Dashboard
        </Button>
      </div>
    </div>
  );
}
