import {
    Bell,
    BookOpen,
    ClipboardCheck,
    DollarSign,
    FileText,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Menu,
    Settings,
    User,
    Users,
    X
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useAutoRefresh } from "../../lib/useAutoRefresh";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const roleDisplayNames: Record<string, string> = {
  super_admin: "Super Admin",
  dean:        "Dean of Studies",
  principal:   "Principal",
  teacher:     "Teacher",
  accountant:  "Accountant",
};

const roleDashboardRoutes: Record<string, string> = {
  super_admin: "/admin/dashboard",
  dean: "/dean/dashboard",
  principal: "/principal/dashboard",
  teacher: "/teacher/dashboard",
  accountant: "/accountant/dashboard",
};

const navItems = {
  super_admin: [
    { icon: LayoutDashboard, label: "Dashboard",     path: "/admin/dashboard" },
    { icon: Users,           label: "Users",         path: "/admin/users" },
    { icon: FileText,        label: "Audit Log",     path: "/admin/audit-log" },
    { icon: GraduationCap,   label: "Academic Year", path: "/admin/academic-year" },
  ],
  dean: [
    { icon: LayoutDashboard, label: "Dashboard",    path: "/dean/dashboard" },
    { icon: GraduationCap,   label: "P-Levels",     path: "/dean/p-levels" },
    { icon: FileText,        label: "Import Data",  path: "/dean/import" },
    { icon: Users,           label: "Distribution", path: "/dean/distribution" },
    { icon: BookOpen,        label: "Courses",      path: "/dean/courses" },
  ],
  principal: [
    { icon: LayoutDashboard, label: "Dashboard",         path: "/principal/dashboard" },
    { icon: ClipboardCheck,  label: "Pending Approvals", path: "/principal/approvals" },
    { icon: GraduationCap,   label: "P-Levels",          path: "/principal/p-levels" },
  ],
  teacher: [
    { icon: LayoutDashboard, label: "Dashboard",          path: "/teacher/dashboard" },
    { icon: BookOpen,        label: "My Classes",         path: "/teacher/my-classes" },
    { icon: ClipboardCheck,  label: "Attendance History", path: "/teacher/attendance-history" },
  ],
  accountant: [
    { icon: LayoutDashboard, label: "Dashboard",   path: "/accountant/dashboard" },
    { icon: BookOpen,        label: "Class Lists", path: "/accountant/class-lists" },
    { icon: DollarSign,      label: "Enrollments", path: "/accountant/enrollment" },
    { icon: Settings,        label: "Zones",       path: "/accountant/zones" },
    { icon: FileText,        label: "Communiqué",  path: "/accountant/communique" },
  ],
};

function isPathAllowedForRole(pathname: string, role: string): boolean {
  // Shared paths allowed for all authenticated users
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/profile" ||
    pathname === "/notifications" ||
    pathname === "/change-password" ||
    pathname === "/403"
  ) {
    return true;
  }

  // Role prefix checks
  if (pathname.startsWith("/admin")) {
    return role === "super_admin";
  }
  if (pathname.startsWith("/dean")) {
    return role === "dean";
  }
  if (pathname.startsWith("/principal")) {
    return role === "principal";
  }
  if (pathname.startsWith("/teacher")) {
    return role === "teacher";
  }
  if (pathname.startsWith("/accountant")) {
    return role === "accountant";
  }

  return true;
}

interface NavListProps {
  items: Array<{ icon: any; label: string; path: string }>;
  currentPath: string;
  onNavigate?: () => void;
}

function NavList({ items, currentPath, onNavigate }: NavListProps) {
  const isActive = (path: string) => currentPath === path || currentPath.startsWith(path + '/');

  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.path);
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => onNavigate?.()}
            className="press-subtle w-full flex items-center gap-3 px-3 py-2.5 rounded-xl relative text-left transition-all active:scale-[0.98]"
            style={{ backgroundColor: active ? "var(--sidebar-accent)" : "transparent" }}
          >
            {active && (
              <div
                className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                style={{ backgroundColor: "var(--maroon)", boxShadow: "0 0 8px rgba(128, 0, 32, 0.6)" }}
              />
            )}
            <Icon size={19} style={{ color: active ? "var(--gold)" : "rgba(255,255,255,0.6)" }} />
            <span
              className="font-medium text-sm tracking-[-0.01em]"
              style={{ color: active ? "#FFFFFF" : "rgba(255,255,255,0.85)" }}
            >
              {item.label}
            </span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div
      className="flex-shrink-0 h-16 flex items-center justify-center border-b px-4"
      style={{ borderColor: "rgba(255,255,255,0.1)" }}
    >
      <div className="text-center">
        <div className="text-white font-bold text-lg leading-tight">Jericho School</div>
        <div className="text-xs" style={{ color: "var(--gold)" }}>Management System</div>
      </div>
    </div>
  );
}

interface SidebarUserProps {
  user: { name: string; avatar?: string | null };
  role: string;
  initials: string;
}

function SidebarUser({ user, role, initials }: SidebarUserProps) {
  return (
    <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9 flex-shrink-0" style={{ backgroundColor: "var(--maroon)" }}>
          {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
          <AvatarFallback className="text-white text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">{user.name}</div>
          <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
            {roleDisplayNames[role] ?? role}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user, logout, isAuthenticated } = useAuth();

  const loadUnread = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/notifications/unread-count');
      const count = typeof res === 'number' ? res : (res?.count ?? res?.data ?? 0);
      setUnreadCount(Number(count) || 0);
    } catch { /* ignore */ }
  }, []);

  // Initial load + reload whenever the route changes (e.g. leaving the
  // notification center after marking read), plus a poll for live updates.
  useEffect(() => { loadUnread(); }, [loadUnread, location.pathname]);
  useAutoRefresh(loadUnread, 15000);

  useEffect(() => {
    if (location.pathname === "/") {
      if (!isAuthenticated || !user) {
        navigate("/login", { replace: true });
        return;
      }

      navigate(user.must_change_password ? "/change-password" : roleDashboardRoutes[user.role], { replace: true });
      return;
    }

    if (!isAuthenticated && location.pathname !== "/login" && location.pathname !== "/change-password") {
      navigate("/login", { replace: true });
      return;
    }

    if (isAuthenticated && user && location.pathname === "/login") {
      navigate(user.must_change_password ? "/change-password" : roleDashboardRoutes[user.role], { replace: true });
      return;
    }

    if (user && user.must_change_password && location.pathname !== "/change-password") {
      navigate("/change-password", { replace: true });
      return;
    }

    // Role-based security check for current pathname
    if (user && !isPathAllowedForRole(location.pathname, user.role)) {
      navigate("/403", { replace: true });
      return;
    }
  }, [isAuthenticated, location.pathname, navigate, user]);

  if (!isAuthenticated || !user) return null;
  if (user.must_change_password && location.pathname !== "/change-password") return null;
  if (!isPathAllowedForRole(location.pathname, user.role)) return null;

  const role = user.role as keyof typeof navItems;
  const currentNavItems = navItems[role] ?? navItems.dean;
  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const pageTitle = currentNavItems.find(item => location.pathname.startsWith(item.path))?.label ?? "Dashboard";

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: "var(--light-gray)" }}>

      {/* ── Desktop sidebar ─────────────────────────────────────────────────── */}
      <aside className="material-sidebar hidden md:flex md:flex-col w-60 xl:w-64 flex-shrink-0 z-30">
        <SidebarBrand />
        <NavList items={currentNavItems} currentPath={location.pathname} />
        <SidebarUser user={user} role={role} initials={initials} />
      </aside>

      {/* ── Mobile sidebar drawer ────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="drawer-scrim absolute inset-0" onClick={() => setSidebarOpen(false)} />
          <aside className="drawer-panel material-sidebar relative w-72 max-w-[85vw] flex flex-col h-full"
            style={{ boxShadow: "var(--elevation-modal)" }}>
            <div className="flex-shrink-0 h-16 flex items-center justify-between px-4 border-b"
              style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              <div>
                <div className="text-white font-bold text-lg">Jericho School</div>
                <div className="text-xs" style={{ color: "var(--gold)" }}>Management System</div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="press p-1 rounded text-white/70 hover:text-white">
                <X size={22} />
              </button>
            </div>
            <NavList items={currentNavItems} currentPath={location.pathname} onNavigate={() => setSidebarOpen(false)} />
            <SidebarUser user={user} role={role} initials={initials} />
          </aside>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Header — translucent layer */}
        <header className="material-thick flex-shrink-0 h-14 md:h-16 flex items-center justify-between px-4 md:px-6 z-20">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button onClick={() => setSidebarOpen(true)} className="press md:hidden p-1 rounded"
              style={{ color: "var(--dark-gray)" }}>
              <Menu size={22} />
            </button>
            <h1 className="text-base md:text-xl font-semibold tracking-[-0.018em] truncate" style={{ color: "var(--dark-gray)" }}>
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
            {/* Notifications */}
            <button onClick={() => navigate("/notifications")}
              className="press relative p-2 rounded-xl hover:bg-black/5 active:scale-95 transition-transform"
              title={unreadCount > 0 ? `${unreadCount} unread` : 'Notifications'}>
              <Bell size={20} style={{ color: "var(--gold)" }} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                  flex items-center justify-center text-[10px] font-bold text-white shadow-xs"
                  style={{ backgroundColor: "var(--danger-red)" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 hover:bg-black/5 rounded-xl p-1.5 transition-all active:scale-[0.98]">
                  <Avatar className="h-8.5 w-8.5 flex-shrink-0" style={{ backgroundColor: "var(--navy-blue)" }}>
                    {user.avatar && <AvatarImage src={user.avatar} alt={user.name} />}
                    <AvatarFallback className="text-white text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block text-left">
                    <div className="text-sm font-medium leading-tight tracking-[-0.01em]" style={{ color: "var(--dark-gray)" }}>
                      {user.name}
                    </div>
                    <div className="text-[11px] px-2 py-0.5 rounded-full inline-block mt-0.5 font-medium tracking-[0.01em]"
                      style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                      {roleDisplayNames[role] ?? role}
                    </div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="mr-2 h-4 w-4" /> Profile Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content — capped at 2xl for 4K screens, scrollable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden apple-scrollbar">
          <div className="max-w-screen-2xl mx-auto p-4 md:p-6 xl:p-8 w-full">
            <Outlet key={location.pathname} />
          </div>
        </main>
      </div>
    </div>
  );
}
