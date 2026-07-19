"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserDto } from "@queuehub/shared";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { AvatarUploader } from "@/components/avatar-uploader";

export default function ProfilePage() {
  const router = useRouter();
  const { user, setSession, accessToken } = useAuthStore();
  const [form, setForm] = useState({ firstName: "", lastName: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ firstName: user.firstName, lastName: user.lastName ?? "" });
    }
  }, [user]);

  useEffect(() => {
    if (!accessToken) {
      router.push("/login");
    }
  }, [accessToken, router]);

  function updateUser(updated: UserDto) {
    if (!accessToken) return;
    setSession({ accessToken, user: updated });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const updated = await apiRequest<UserDto>("/profile", {
        method: "PATCH",
        body: { firstName: form.firstName, lastName: form.lastName || undefined },
      });
      updateUser(updated);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return <p className="text-center text-slate-500">Загрузка...</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Профиль</h1>

      <div className="card">
        <AvatarUploader user={user} onUpdated={updateUser} />
      </div>

      <form onSubmit={handleSave} className="card space-y-4">
        <div>
          <label className="label">Имя</label>
          <input
            className="input"
            required
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Фамилия</label>
          <input
            className="input"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">Сохранено</p>}

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить"}
        </button>
      </form>
    </div>
  );
}
