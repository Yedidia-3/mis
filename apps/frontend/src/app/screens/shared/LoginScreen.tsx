import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import logoImg from "../../../assets/images/official-logo.png";
import { api } from "../../../lib/api";
import { AuthUser, useAuth, UserRole } from "../../../lib/auth";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";

const roleRoutes: Record<UserRole, string> = {
  super_admin: "/admin/dashboard",
  dean: "/dean/dashboard",
  principal: "/principal/dashboard",
  teacher: "/teacher/dashboard",
  accountant: "/accountant/dashboard",
};

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, user, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (isAuthenticated && user && location.pathname === "/login") {
      navigate(user.must_change_password ? "/change-password" : roleRoutes[user.role] ?? "/", { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate, user]);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: AuthUser }>(
        '/api/v1/auth/login',
        { email, password }
      );
      setAuth(res.user, res.token);
      if (res.user.must_change_password) {
        navigate('/change-password');
      } else {
        navigate(roleRoutes[res.user.role] ?? '/');
      }
    } catch (err: any) {
      // No page reload — keep the email, clear only the password, and refocus
      // it so the user just retypes the password.
      setError(err.message ?? "Invalid email or password");
      setPassword("");
      requestAnimationFrame(() =>
        (document.getElementById("password") as HTMLInputElement | null)?.focus()
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ backgroundColor: "var(--light-gray)" }}>

      {/* ── Left branding panel (hidden on mobile, shown md+) ──────────────── */}
      <div
        className="hidden lg:flex lg:w-2/5 xl:w-1/2 flex-col justify-center items-center relative overflow-hidden"
        style={{ backgroundColor: "var(--navy-blue)" }}
      >
        {/* Top decorative circle */}
        <div
          className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10"
          style={{ backgroundColor: "var(--maroon)", transform: "translate(30%, -30%)" }}
        />

        <div className="text-center z-10 px-12 space-y-6 max-w-md">
          {/* Logo */}
          <div className="mx-auto flex items-center justify-center">
            <img 
              src={logoImg} 
              alt="Jericho School Logo"
              className="h-32 w-auto object-contain"
            />
          </div>
          <div>
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              Jericho School
            </h1>
            <p className="text-xl mt-2" style={{ color: "var(--gold)" }}>Management System</p>
          </div>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>
            Streamlined academic management for teachers, deans, principals, and staff.
          </p>
        </div>

        {/* Bottom decorative circle */}
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10"
          style={{ backgroundColor: "var(--gold)", transform: "translate(-30%, 30%)" }}
        />
      </div>

      {/* ── Right form panel ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="w-full max-w-md">

          {/* Mobile-only logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <img 
              src={logoImg} 
              alt="Jericho School Logo"
              className="h-20 w-auto object-contain mb-3"
            />
            <h1 className="text-xl font-bold" style={{ color: "var(--navy-blue)" }}>Jericho School</h1>
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>Management System</p>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold" style={{ color: "var(--dark-gray)" }}>Welcome back</h2>
            <p className="mt-2 text-base" style={{ color: "var(--mid-gray)" }}>Sign in to your account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-sm font-medium" style={{ color: "var(--dark-gray)" }}>
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@jericho.rw"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 h-12 text-base"
                style={{ borderColor: error ? "var(--danger-red)" : "var(--border)" }}
                required
                autoComplete="email"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-sm font-medium" style={{ color: "var(--dark-gray)" }}>
                Password
              </Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 text-base pr-11"
                  style={{ borderColor: error ? "var(--danger-red)" : "var(--border)" }}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded"
                  style={{ color: "var(--mid-gray)" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-lg text-sm" style={{ backgroundColor: "#FEE2E2", color: "var(--danger-red)" }}>
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in…
                </>
              ) : "Sign In"}
            </Button>

            <p className="text-center text-sm" style={{ color: "var(--mid-gray)" }}>
              Forgot your password? Contact your administrator.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
