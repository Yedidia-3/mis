import { Check, Copy, KeyRound, Loader2, MoreVertical, Pencil, Plus, Search, UserX } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
    Dialog, DialogContent,
    DialogFooter,
    DialogHeader, DialogTitle,
} from "../../components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../../components/ui/table";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  last_login: string | null;
  must_change_password: boolean;
}

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  dean: "Dean",
  principal: "Principal",
  teacher: "Teacher",
  accountant: "Accountant",
};

const roleBadgeColor: Record<string, string> = {
  super_admin: "var(--maroon)",
  dean: "var(--navy-blue)",
  principal: "var(--gold)",
  teacher: "var(--success-green)",
  accountant: "var(--info-blue)",
};

function formatLastLogin(date: string | null) {
  if (!date) return "Never";
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add user dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("dean");

  // Credential reveal modal
  const [credOpen, setCredOpen] = useState(false);
  const [cred, setCred] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset password result
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  // Edit user dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const res = await api.get<{ data: User[] }>("/api/v1/admin/users");
      setUsers((res as any).data ?? res as any);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);
    try {
      const res = await api.post<User & { temp_password: string }>("/api/v1/admin/users", {
        name: newName,
        email: newEmail,
        role: newRole,
      });
      await loadUsers();
      setAddOpen(false);
      setNewName(""); setNewEmail(""); setNewRole("dean");
      setCred({ name: (res as any).name, email: (res as any).email, password: (res as any).temp_password });
      setCredOpen(true);
    } catch (err: any) {
      setAddError(err.message ?? "Failed to create user");
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditError("");
    setEditOpen(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditError("");
    setEditSaving(true);
    try {
      await api.put(`/api/v1/admin/users/${editUser.id}`, {
        name: editName.trim(),
        email: editEmail.trim(),
      });
      await loadUsers();
      setEditOpen(false);
    } catch (err: any) {
      setEditError(err.message ?? "Failed to update user");
    } finally {
      setEditSaving(false);
    }
  };

  const handleResetPassword = async (user: User) => {
    try {
      const res = await api.post<{ temp_password: string }>(`/api/v1/admin/users/${user.id}/reset-password`, {});
      setResetResult({ name: user.name, password: (res as any).temp_password });
      setResetOpen(true);
    } catch (err: any) {
      alert(err.message ?? "Reset failed");
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Permanently delete ${user.name}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/admin/users/${user.id}`);
      await loadUsers();
    } catch (err: any) {
      alert(err.message ?? "Delete failed");
    }
  };

  const handleDeactivate = async (user: User) => {
    if (!confirm(`Deactivate ${user.name}?`)) return;
    try {
      await api.post(`/api/v1/admin/users/${user.id}/deactivate`, {});
      await loadUsers();
    } catch (err: any) {
      alert(err.message ?? "Failed");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold" style={{ color: "var(--dark-gray)" }}>Users</h1>
        <Button
          onClick={() => setAddOpen(true)}
          className="h-11"
          style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}
        >
          <Plus size={18} className="mr-2" />
          Add User
        </Button>
      </div>

      <Card style={{ borderColor: "var(--border)" }}>
        <CardContent className="p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--mid-gray)" }} />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-44 h-11">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="dean">Dean</SelectItem>
                <SelectItem value="principal">Principal</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="accountant">Accountant</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44 h-11">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin" size={32} style={{ color: "var(--navy-blue)" }} />
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto" style={{ borderColor: "var(--border)" }}>
              <Table>
                <TableHeader style={{ backgroundColor: "var(--navy-blue)" }}>
                  <TableRow>
                    <TableHead className="text-white">Name</TableHead>
                    <TableHead className="text-white">Email</TableHead>
                    <TableHead className="text-white">Role</TableHead>
                    <TableHead className="text-white">Status</TableHead>
                    <TableHead className="text-white">Last Login</TableHead>
                    <TableHead className="text-white text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12" style={{ color: "var(--mid-gray)" }}>
                        No users found. Use "Add User" to create the first one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <TableRow
                        key={user.id}
                        style={{ backgroundColor: index % 2 === 0 ? "#FFFFFF" : "var(--light-gray)" }}
                      >
                        <TableCell className="font-medium" style={{ color: "var(--dark-gray)" }}>
                          <div className="flex items-center gap-2">
                            {user.name}
                            {user.must_change_password && (
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#FFF3E0", color: "#E65100" }}>
                                Temp password
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell style={{ color: "var(--dark-gray)" }}>{user.email}</TableCell>
                        <TableCell>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: roleBadgeColor[user.role] ?? "var(--mid-gray)" }}>
                            {roleLabels[user.role] ?? user.role}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: user.status === "active" ? "var(--success-green)" : "var(--mid-gray)" }}>
                            {user.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </TableCell>
                        <TableCell style={{ color: "var(--mid-gray)" }}>
                          {formatLastLogin(user.last_login)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm"><MoreVertical size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(user)}>
                                <Pencil size={14} className="mr-2" /> Edit details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                                <KeyRound size={14} className="mr-2" /> Reset password
                              </DropdownMenuItem>
                              {user.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() => handleDeactivate(user)}
                                  className="text-amber-600"
                                >
                                  <UserX size={14} className="mr-2" /> Deactivate
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(user)}
                                className="text-red-600"
                              >
                                <UserX size={14} className="mr-2" /> Delete permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add User Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4 py-2">
            <div>
              <Label>Full Name</Label>
              <Input className="mt-2 h-11" placeholder="e.g. Jean Claude Habimana"
                value={newName} onChange={(e) => setNewName(e.target.value)} required />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input className="mt-2 h-11" type="email" placeholder="e.g. jc.habimana@jericho.rw"
                value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="mt-2 h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dean">Dean of Studies</SelectItem>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {addError && (
              <p className="text-sm p-3 rounded-md" style={{ backgroundColor: "#FEE", color: "var(--danger-red)" }}>
                {addError}
              </p>
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={addLoading}
                style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                {addLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</> : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Credential Reveal Modal ── */}
      <Dialog open={credOpen} onOpenChange={setCredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Created — Share Credentials</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
              These are <strong style={{ color: "var(--dark-gray)" }}>{cred?.name}</strong>'s login credentials.
              Copy and share them securely. The system will force them to change their password on first login.
            </p>
            <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "var(--light-gray)" }}>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--mid-gray)" }}>EMAIL</p>
                <p className="font-mono text-sm" style={{ color: "var(--dark-gray)" }}>{cred?.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold mb-1" style={{ color: "var(--mid-gray)" }}>TEMPORARY PASSWORD</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-lg font-bold tracking-widest" style={{ color: "var(--navy-blue)" }}>
                    {cred?.password}
                  </p>
                  <button
                    onClick={() => copyToClipboard(`Email: ${cred?.email}\nPassword: ${cred?.password}`)}
                    className="p-2 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    {copied ? <Check size={18} style={{ color: "var(--success-green)" }} /> : <Copy size={18} style={{ color: "var(--mid-gray)" }} />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs" style={{ color: "#E65100" }}>
              ⚠ This password won't be shown again. Make sure to copy it now.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredOpen(false)} style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Result Modal ── */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Password Reset — New Credentials</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <p className="text-sm" style={{ color: "var(--mid-gray)" }}>
              A new temporary password has been generated for <strong style={{ color: "var(--dark-gray)" }}>{resetResult?.name}</strong>.
              They will be required to change it on next login.
            </p>
            <div className="rounded-lg p-4" style={{ backgroundColor: "var(--light-gray)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--mid-gray)" }}>NEW TEMPORARY PASSWORD</p>
              <div className="flex items-center justify-between">
                <p className="font-mono text-lg font-bold tracking-widest" style={{ color: "var(--navy-blue)" }}>
                  {resetResult?.password}
                </p>
                <button
                  onClick={() => copyToClipboard(resetResult?.password ?? "")}
                  className="p-2 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {copied ? <Check size={18} style={{ color: "var(--success-green)" }} /> : <Copy size={18} style={{ color: "var(--mid-gray)" }} />}
                </button>
              </div>
            </div>
            <p className="text-xs" style={{ color: "#E65100" }}>⚠ This won't be shown again.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setResetOpen(false)} style={{ backgroundColor: "var(--navy-blue)", color: "#fff" }}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditUser} className="space-y-4 py-2">
            <div>
              <Label>Full Name</Label>
              <Input className="mt-2 h-11" value={editName}
                onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input className="mt-2 h-11" type="email" value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)} required />
            </div>
            {editError && (
              <p className="text-sm p-3 rounded-md" style={{ backgroundColor: "#FEE", color: "var(--danger-red)" }}>
                {editError}
              </p>
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={editSaving}
                style={{ backgroundColor: "var(--maroon)", color: "#fff" }}>
                {editSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
