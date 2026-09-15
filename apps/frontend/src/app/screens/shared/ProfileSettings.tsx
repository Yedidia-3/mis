import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Loader2, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../lib/api";
import { useAuth, AuthUser } from "../../../lib/auth";

const roleLabels: Record<string, string> = {
  super_admin: "Super Admin",
  dean: "Dean of Studies",
  principal: "Principal",
  teacher: "Teacher",
  accountant: "Accountant",
};

// Resize an image file to a small square data URL (keeps the DB/payload light).
function resizeImage(file: File, size = 160): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no canvas"));
        // cover-crop to square
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfileSettings() {
  const { user, token, setAuth } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile (name + avatar)
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const initials = (name || user?.name || "?").split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const handlePickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    try {
      const dataUrl = await resizeImage(file);
      setAvatar(dataUrl);
    } catch {
      toast.error("Could not read that image");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const profileDirty = name.trim() !== (user?.name ?? "") || (avatar ?? null) !== (user?.avatar ?? null);

  const handleSaveProfile = async () => {
    if (!name.trim()) { toast.error("Name cannot be empty"); return; }
    setSavingProfile(true);
    try {
      const updated = await api.put<AuthUser>('/api/v1/auth/profile', { name: name.trim(), avatar: avatar ?? "" });
      if (token) setAuth({ ...(user as AuthUser), ...updated }, token);
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setError("New passwords do not match"); return; }
    if (currentPassword === newPassword) { setError("New password must be different from current"); return; }

    setSaving(true);
    try {
      await api.post('/api/v1/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password updated successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      setError(err.message ?? "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <Card style={{ borderColor: "var(--border)" }}>
        <CardHeader><CardTitle>Profile Settings</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-24 w-24" style={{ backgroundColor: "var(--navy-blue)" }}>
                {avatar && <AvatarImage src={avatar} alt={name} />}
                <AvatarFallback className="text-white text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow"
                style={{ backgroundColor: "var(--maroon)" }} title="Change photo">
                <Camera size={15} color="#fff" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePickAvatar} />
            </div>
            {avatar && (
              <button onClick={() => setAvatar(null)}
                className="text-xs flex items-center gap-1" style={{ color: "var(--danger-red)" }}>
                <Trash2 size={12} /> Remove photo
              </button>
            )}
          </div>

          {/* Name (editable) */}
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="mt-2 h-11" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={user?.email ?? ""} readOnly className="mt-2 h-11"
                style={{ backgroundColor: "var(--light-gray)", color: "var(--mid-gray)" }} />
              <p className="text-xs mt-1" style={{ color: "var(--mid-gray)" }}>
                Contact the Super Admin to change your email.
              </p>
            </div>
            <div>
              <Label>Role</Label>
              <div className="mt-2">
                <span className="inline-block px-4 py-2 rounded-md text-sm font-semibold"
                  style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                  {roleLabels[user?.role ?? ""] ?? user?.role}
                </span>
              </div>
            </div>
            <Button onClick={handleSaveProfile} disabled={savingProfile || !profileDirty}
              className="w-full h-11" style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
              {savingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Profile"}
            </Button>
          </div>

          {/* Password */}
          <div className="pt-6 border-t" style={{ borderColor: "var(--border)" }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--dark-gray)" }}>Change Password</h3>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <Label htmlFor="current-password">Current Password</Label>
                <Input id="current-password" type="password" value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)} className="mt-2 h-11" required />
              </div>
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input id="new-password" type="password" value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} className="mt-2 h-11" required />
              </div>
              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input id="confirm-password" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} className="mt-2 h-11" required />
              </div>
              {error && (
                <div className="p-3 rounded-md text-sm" style={{ backgroundColor: "#FEE", color: "var(--danger-red)" }}>{error}</div>
              )}
              <Button type="submit" className="w-full h-11" disabled={saving}
                style={{ backgroundColor: "var(--maroon)", color: "#FFFFFF" }}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Update Password"}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
