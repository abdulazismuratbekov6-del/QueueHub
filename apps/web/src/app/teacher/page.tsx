"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QueueDto } from "@queuehub/shared";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

export default function TeacherQueuesPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subject: "",
    description: "",
    randomEnabled: false,
    registrationOpen: true,
    timerSeconds: "" as string | number,
  });
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: queues, isLoading } = useQuery({
    queryKey: ["queues-mine"],
    queryFn: () => apiRequest<QueueDto[]>("/queues/mine"),
    enabled: !!user,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await apiRequest("/queues", {
        method: "POST",
        body: {
          title: form.title,
          subject: form.subject,
          description: form.description || undefined,
          randomEnabled: form.randomEnabled,
          registrationOpen: form.registrationOpen,
          timerSeconds: form.timerSeconds ? Number(form.timerSeconds) : undefined,
        },
      });
      setForm({
        title: "",
        subject: "",
        description: "",
        randomEnabled: false,
        registrationOpen: true,
        timerSeconds: "",
      });
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["queues-mine"] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать очередь");
    } finally {
      setCreating(false);
    }
  }

  if (!user) {
    return <p className="text-center text-slate-500">Войдите как преподаватель, чтобы управлять очередями.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои очереди</h1>
        <button type="button" className="btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Отмена" : "+ Новая очередь"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <div>
            <label className="label">Название лабораторной работы</label>
            <input
              className="input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Предмет</label>
            <input
              className="input"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Описание (необязательно)</label>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="registrationOpen"
              type="checkbox"
              checked={form.registrationOpen}
              onChange={(e) => setForm({ ...form, registrationOpen: e.target.checked })}
            />
            <label htmlFor="registrationOpen" className="text-sm">
              Требовать вход в аккаунт (иначе вход по имени, без регистрации)
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="randomEnabled"
              type="checkbox"
              checked={form.randomEnabled}
              onChange={(e) => setForm({ ...form, randomEnabled: e.target.checked })}
            />
            <label htmlFor="randomEnabled" className="text-sm">
              Разрешить случайное перемешивание очереди
            </label>
          </div>
          <div>
            <label className="label">Таймер на студента, сек (необязательно)</label>
            <input
              type="number"
              min={10}
              max={3600}
              className="input"
              value={form.timerSeconds}
              onChange={(e) => setForm({ ...form, timerSeconds: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={creating}>
            {creating ? "Создание..." : "Создать очередь"}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-slate-500">Загрузка...</p>
      ) : queues && queues.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {queues.map((q) => (
            <Link key={q.id} href={`/teacher/${q.id}`} className="card block hover:border-brand-400">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{q.title}</h2>
                <span
                  className={
                    q.status === "OPEN"
                      ? "rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : "rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }
                >
                  {q.status === "OPEN" ? "Открыта" : "Закрыта"}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{q.subject}</p>
              <p className="mt-2 text-xs text-slate-500">Код: {q.roomCode}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">Пока нет ни одной очереди.</p>
      )}
    </div>
  );
}
