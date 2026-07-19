"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { QueueDto } from "@queuehub/shared";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";

export default function JoinByRoomCodePage({ params }: { params: { roomCode: string } }) {
  const router = useRouter();
  const { user, setSession } = useAuthStore();
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: queue, isLoading, isError } = useQuery({
    queryKey: ["queue-by-room", params.roomCode],
    queryFn: () => apiRequest<QueueDto>(`/queues/room/${params.roomCode}`, { skipAuth: true }),
  });

  async function joinQueue(body: { firstName?: string; lastName?: string }) {
    if (!queue) return;
    setError(null);
    setLoading(true);
    try {
      const result = await apiRequest<{ member: any; auth: any }>(`/queues/${queue.id}/join`, {
        method: "POST",
        body,
      });
      if (result.auth) {
        setSession({ accessToken: result.auth.accessToken, user: result.auth.user });
      }
      router.push(`/queue/${queue.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось занять очередь");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <p className="text-center text-slate-500">Загрузка...</p>;
  if (isError || !queue) {
    return <p className="text-center text-red-600">Очередь с таким кодом не найдена</p>;
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="card">
        <h1 className="text-xl font-bold">{queue.title}</h1>
        <p className="text-slate-600 dark:text-slate-400">{queue.subject}</p>
        {queue.description && <p className="mt-2 text-sm">{queue.description}</p>}
        <p className="mt-2 text-sm text-slate-500">Код комнаты: {queue.roomCode}</p>
        {queue.status === "CLOSED" && (
          <p className="mt-2 text-sm font-medium text-amber-600">Очередь сейчас закрыта</p>
        )}
      </div>

      <button
        type="button"
        className="btn-secondary w-full"
        onClick={() => router.push(`/queue/${queue.id}`)}
      >
        Просто посмотреть очередь
      </button>

      {user ? (
        <button type="button" className="btn-primary w-full" disabled={loading} onClick={() => joinQueue({})}>
          {loading ? "Подключение..." : "Занять очередь"}
        </button>
      ) : queue.registrationOpen ? (
        <div className="card text-center text-sm">
          Для входа в эту очередь нужен аккаунт.{" "}
          <a href="/login" className="text-brand-600 hover:underline dark:text-brand-400">
            Войти
          </a>{" "}
          или{" "}
          <a href="/register" className="text-brand-600 hover:underline dark:text-brand-400">
            зарегистрироваться
          </a>
          .
        </div>
      ) : (
        <form
          className="card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            joinQueue({ firstName: guestFirstName, lastName: guestLastName || undefined });
          }}
        >
          <div>
            <label className="label">Имя</label>
            <input
              className="input"
              required
              value={guestFirstName}
              onChange={(e) => setGuestFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Фамилия (необязательно)</label>
            <input
              className="input"
              value={guestLastName}
              onChange={(e) => setGuestLastName(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Подключение..." : "Занять очередь"}
          </button>
        </form>
      )}
    </div>
  );
}
