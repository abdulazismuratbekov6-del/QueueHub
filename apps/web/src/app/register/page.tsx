"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Role } from "@queuehub/shared";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: Role.STUDENT,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await apiRequest<{ accessToken: string; csrfToken: string; user: any }>(
        "/auth/register",
        { method: "POST", body: form },
      );
      setSession(result);
      router.push(form.role === Role.TEACHER ? "/teacher" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось зарегистрироваться");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Регистрация</h1>
      <form onSubmit={handleSubmit} className="card space-y-4">
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
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Пароль</label>
          <input
            type="password"
            minLength={6}
            className="input"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Роль</label>
          <select
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value={Role.STUDENT}>Студент</option>
            <option value={Role.TEACHER}>Преподаватель</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Уже есть аккаунт?{" "}
        <a href="/login" className="text-brand-600 hover:underline dark:text-brand-400">
          Войти
        </a>
      </p>
    </div>
  );
}
