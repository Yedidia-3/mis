import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";

export function ChangePasswordScreen() {
  const navigate = useNavigate();
  const { user, setAuth, token } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const roleRoutes: Record<string, string> = {
    super_admin: "/admin/dashboard",
    dean: "/dean/dashboard",
    principal: "/principal/dashboard",
    teacher: "/teacher/dashboard",
    accountant: "/accountant/dashboard",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("New password must be different from your temporary password.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/v1/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      // Update local user — no longer needs to change password
      if (user && token) {
        setAuth({ ...user, must_change_password: false }, token);
      }

      navigate(roleRoutes[user?.role ?? ""] ?? "/");
    } catch (err: any) {
      setError(err.message ?? "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "var(--light-gray)" }}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border p-8" style={{ borderColor: "var(--border)" }}>
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: "#FFF3E0" }}>
            <ShieldAlert size={28} style={{ color: "#E65100" }} />
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--dark-gray)" }}>
            Create your password
          </h2>
          <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
            You're using a temporary password. Please set a new one to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Current (temp) password */}
          <div>
            <Label htmlFor="current">Temporary Password</Label>
            <div className="relative mt-2">
              <Input
                id="current"
                type={showCurrent ? "text" : "password"}
                placeholder="Enter your temporary password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-11 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--mid-gray)" }}
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <Label htmlFor="new">New Password</Label>
            <div className="relative mt-2">
              <Input
                id="new"
                type={showNew ? "text" : "password"}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--mid-gray)" }}
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div>
            <Label htmlFor="confirm">Confirm New Password</Label>
            <Input
              id="confirm"
              type="password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11 mt-2"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-md text-sm" style={{ backgroundColor: "#FEE", color: "var(--danger-red)" }}>
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 font-semibold"
            style={{ backgroundColor: "var(--navy-blue)", color: "#FFFFFF" }}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Set New Password & Continue"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
