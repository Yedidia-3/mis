import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Bell, Check, CheckCheck, Loader2, CircleCheck, TriangleAlert,
  CircleX, Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { useAutoRefresh } from "../../../lib/useAutoRefresh";

interface Notification {
  id: number;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
  /** Set by the server for notifications that point somewhere specific. */
  link?: string | null;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

const TYPE_META: Record<string, { color: string; bg: string; Icon: any }> = {
  success: { color: "var(--success-green)", bg: "color-mix(in srgb, var(--success-green) 9%, transparent)", Icon: CircleCheck },
  warning: { color: "var(--warning-amber)", bg: "color-mix(in srgb, var(--warning-amber) 9%, transparent)", Icon: TriangleAlert },
  error:   { color: "var(--danger-red)", bg: "color-mix(in srgb, var(--danger-red) 9%, transparent)", Icon: CircleX },
  info:    { color: "var(--info-blue)", bg: "color-mix(in srgb, var(--info-blue) 9%, transparent)", Icon: Info },
};

/**
 * Where a notification should take the reader.
 *
 * The server now sends an explicit `link` for anything with a specific
 * destination, which is exact. The keyword matching below is the fallback for
 * notifications created before that field existed — it guesses from wording and
 * is easily fooled, so it is only consulted when there is no link.
 */
function routeFor(n: Notification, role?: string): string | null {
  if (n.link) return n.link;

  const m = n.message.toLowerCase();
  if (role === "accountant") {
    if (m.includes("expire") || m.includes("expired")) return "/accountant/communique";
    if (m.includes("class list") || m.includes("distributed")) return "/accountant/class-lists";
    if (m.includes("feeding")) return "/accountant/enrollment/feeding";
    if (m.includes("transport")) return "/accountant/enrollment/transport";
  }
  return null;
}

type FilterMode = "all" | "unread";

export function NotificationCenter() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");

  const load = useCallback(async () => {
    try {
      const res = await api.get<any>('/api/v1/notifications');
      setNotifications(Array.isArray(res) ? res : res.data ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load, 15000);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const visible = filter === "unread" ? notifications.filter(n => !n.is_read) : notifications;

  const markRead = async (id: number) => {
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    await api.put(`/api/v1/notifications/${id}/read`, {}).catch(() => {});
  };

  const markAllRead = async () => {
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    await api.put('/api/v1/notifications/read-all', {}).catch(() => {});
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    const dest = routeFor(n, user?.role);
    if (dest) navigate(dest);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Card style={{ borderColor: "var(--border)" }}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <CardTitle>Notifications</CardTitle>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--danger-red)" }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} style={{ color: "var(--maroon)" }}>
              <CheckCheck size={16} className="mr-1" /> Mark all as read
            </Button>
          )}
        </CardHeader>

        {/* Filter tabs */}
        <div className="px-6 -mt-2 mb-2 flex gap-2">
          {(["all", "unread"] as FilterMode[]).map(f => {
            const active = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--maroon)" : "var(--light-gray)",
                  color: active ? "#FFFFFF" : "var(--mid-gray)",
                }}>
                {f === "all" ? "All" : `Unread${unreadCount ? ` (${unreadCount})` : ""}`}
              </button>
            );
          })}
        </div>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16">
              <Bell size={48} className="mx-auto mb-4" style={{ color: "var(--mid-gray)" }} />
              <p className="text-lg" style={{ color: "var(--mid-gray)" }}>
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="text-sm" style={{ color: "var(--mid-gray)" }}>You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {visible.map(n => {
                const meta = TYPE_META[n.type] ?? TYPE_META.info;
                const Icon = meta.Icon;
                const clickable = !!routeFor(n, user?.role);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex items-start gap-3"
                    style={{ backgroundColor: n.is_read ? "#FFFFFF" : "#FBFAF8" }}
                  >
                    {/* Type icon */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: meta.bg }}>
                      <Icon size={18} style={{ color: meta.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        {!n.is_read && (
                          <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: meta.color }} />
                        )}
                        <p className={`text-sm ${n.is_read ? "font-normal" : "font-semibold"}`}
                          style={{ color: "var(--dark-gray)" }}>
                          {n.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs" style={{ color: "var(--mid-gray)" }}>{timeAgo(n.created_at)}</p>
                        {clickable && (
                          <span className="text-xs font-medium" style={{ color: "var(--maroon)" }}>· View</span>
                        )}
                      </div>
                    </div>

                    {n.is_read && <Check size={16} style={{ color: "var(--success-green)" }} className="flex-shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
