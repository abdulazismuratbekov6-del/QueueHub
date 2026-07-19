"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  QueueDto,
  QueueMemberDto,
  SocketEvents,
  SwapRequestDto,
  SwapType,
} from "@queuehub/shared";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/lib/auth-store";
import { useQueueSocket } from "@/lib/use-queue-socket";
import { MemberRow } from "@/components/member-row";

export default function QueueViewPage({ params }: { params: { id: string } }) {
  const queueId = params.id;
  const queryClient = useQueryClient();
  const { user, setSession } = useAuthStore();

  const [search, setSearch] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [swapTarget, setSwapTarget] = useState("");
  const [swapType, setSwapType] = useState<SwapType>(SwapType.ONE_ROUND);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  const { data: queue } = useQuery({
    queryKey: ["queue", queueId],
    queryFn: () => apiRequest<QueueDto>(`/queues/${queueId}`, { skipAuth: true }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members", queueId],
    queryFn: () => apiRequest<QueueMemberDto[]>(`/queues/${queueId}/members`, { skipAuth: true }),
  });

  const { data: incoming = [] } = useQuery({
    queryKey: ["swap-incoming"],
    queryFn: () => apiRequest<SwapRequestDto[]>("/swap/incoming"),
    enabled: !!user,
    refetchInterval: 15000,
  });

  function refreshMembers() {
    queryClient.invalidateQueries({ queryKey: ["members", queueId] });
    queryClient.invalidateQueries({ queryKey: ["queue", queueId] });
  }

  useQueueSocket(queueId, {
    [SocketEvents.MEMBER_JOINED]: refreshMembers,
    [SocketEvents.MEMBER_LEFT]: refreshMembers,
    [SocketEvents.MEMBERS_REORDERED]: refreshMembers,
    [SocketEvents.QUEUE_RANDOMIZED]: refreshMembers,
    [SocketEvents.NEXT_CALLED]: refreshMembers,
    [SocketEvents.QUEUE_OPENED]: refreshMembers,
    [SocketEvents.QUEUE_CLOSED]: refreshMembers,
    [SocketEvents.SWAP_ACCEPTED]: refreshMembers,
    [SocketEvents.SWAP_REVERTED]: refreshMembers,
    [SocketEvents.SWAP_REQUESTED]: () => queryClient.invalidateQueries({ queryKey: ["swap-incoming"] }),
    [SocketEvents.SWAP_REJECTED]: () => queryClient.invalidateQueries({ queryKey: ["swap-incoming"] }),
    [SocketEvents.TIMER_TICK]: (payload: { remaining: number; running: boolean }) => {
      setTimerRemaining(payload.running ? payload.remaining : null);
    },
    [SocketEvents.YOUR_TURN_SOON]: () => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("QueueHub", { body: "Ваша очередь скоро подойдёт!" });
      }
    },
  });

  useEffect(() => {
    if (user && typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [user]);

  const self = useMemo(
    () => (user ? members.find((m) => m.user.id === user.id) : undefined),
    [members, user],
  );

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.trim().toLowerCase();
    return members.filter((m) =>
      `${m.user.firstName} ${m.user.lastName ?? ""}`.toLowerCase().includes(q),
    );
  }, [members, search]);

  async function joinQueue(body: { firstName?: string; lastName?: string }) {
    setError(null);
    setBusy(true);
    try {
      const result = await apiRequest<{ member: any; auth: any }>(`/queues/${queueId}/join`, {
        method: "POST",
        body,
      });
      if (result.auth) {
        setSession({ accessToken: result.auth.accessToken, user: result.auth.user });
      }
      refreshMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось занять очередь");
    } finally {
      setBusy(false);
    }
  }

  async function leaveQueue() {
    setError(null);
    setBusy(true);
    try {
      await apiRequest(`/queues/${queueId}/leave`, { method: "POST" });
      refreshMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось покинуть очередь");
    } finally {
      setBusy(false);
    }
  }

  async function requestSwap(e: React.FormEvent) {
    e.preventDefault();
    if (!swapTarget) return;
    setError(null);
    setBusy(true);
    try {
      await apiRequest("/swap/request", {
        method: "POST",
        body: { queueId, receiverId: swapTarget, swapType },
      });
      setSwapTarget("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось отправить запрос на обмен");
    } finally {
      setBusy(false);
    }
  }

  async function respondSwap(swapRequestId: string, action: "accept" | "reject") {
    setBusy(true);
    try {
      await apiRequest(`/swap/${action}`, { method: "POST", body: { swapRequestId } });
      queryClient.invalidateQueries({ queryKey: ["swap-incoming"] });
      refreshMembers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось обработать запрос");
    } finally {
      setBusy(false);
    }
  }

  if (!queue) {
    return <p className="text-center text-slate-500">Загрузка...</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{queue.title}</h1>
              <p className="text-sm text-slate-500">{queue.subject}</p>
            </div>
            {timerRemaining !== null && (
              <span className="font-mono text-lg">⏱ {timerRemaining} с</span>
            )}
          </div>
          {queue.status === "CLOSED" && (
            <p className="mt-2 text-sm font-medium text-amber-600">Очередь закрыта</p>
          )}
        </div>

        {incoming.length > 0 && (
          <div className="card space-y-2 border-brand-400">
            <h2 className="font-semibold">Входящие запросы на обмен</h2>
            {incoming.map((swap) => (
              <div key={swap.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-900">
                <span>
                  Запрос на обмен ({swap.swapType === SwapType.ONE_ROUND ? "один круг" : "навсегда"})
                </span>
                <div className="flex gap-2">
                  <button className="btn-primary" disabled={busy} onClick={() => respondSwap(swap.id, "accept")}>
                    Принять
                  </button>
                  <button className="btn-secondary" disabled={busy} onClick={() => respondSwap(swap.id, "reject")}>
                    Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <input
            className="input mb-3"
            placeholder="Найти себя по имени или фамилии..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="space-y-1">
            {filteredMembers.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isCurrent={m.position === queue.currentPosition}
                isSelf={user ? m.user.id === user.id : false}
              />
            ))}
            {filteredMembers.length === 0 && <p className="text-sm text-slate-500">Никого не найдено</p>}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="space-y-4">
        <div className="card">
          {self ? (
            <button className="btn-danger w-full" disabled={busy} onClick={leaveQueue}>
              Покинуть очередь
            </button>
          ) : user ? (
            <button className="btn-primary w-full" disabled={busy} onClick={() => joinQueue({})}>
              Занять очередь
            </button>
          ) : queue.registrationOpen ? (
            <p className="text-center text-sm">
              Нужен аккаунт.{" "}
              <a href="/login" className="text-brand-600 hover:underline dark:text-brand-400">
                Войти
              </a>
            </p>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                joinQueue({ firstName: guestFirstName, lastName: guestLastName || undefined });
              }}
            >
              <input
                className="input"
                placeholder="Имя"
                required
                value={guestFirstName}
                onChange={(e) => setGuestFirstName(e.target.value)}
              />
              <input
                className="input"
                placeholder="Фамилия (необязательно)"
                value={guestLastName}
                onChange={(e) => setGuestLastName(e.target.value)}
              />
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                Занять очередь
              </button>
            </form>
          )}
        </div>

        {self && (
          <div className="card">
            <h2 className="mb-2 font-semibold">Предложить обмен местами</h2>
            <form onSubmit={requestSwap} className="space-y-2">
              <select className="input" value={swapTarget} onChange={(e) => setSwapTarget(e.target.value)} required>
                <option value="">Выберите участника</option>
                {members
                  .filter((m) => m.user.id !== self.user.id)
                  .map((m) => (
                    <option key={m.id} value={m.user.id}>
                      {m.position}. {m.user.firstName} {m.user.lastName ?? ""}
                    </option>
                  ))}
              </select>
              <select className="input" value={swapType} onChange={(e) => setSwapType(e.target.value as SwapType)}>
                <option value={SwapType.ONE_ROUND}>Один круг (временно)</option>
                <option value={SwapType.PERMANENT}>Навсегда</option>
              </select>
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                Отправить запрос
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
