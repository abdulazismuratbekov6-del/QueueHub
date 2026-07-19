"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  HistoryEntryDto,
  QueueDto,
  QueueMemberDto,
  QueueStatisticsDto,
  SocketEvents,
  SwapRequestDto,
} from "@queuehub/shared";
import { apiRequest, ApiError } from "@/lib/api-client";
import { useQueueSocket } from "@/lib/use-queue-socket";
import { downloadFile } from "@/lib/download";
import { MemberRow } from "@/components/member-row";

export default function TeacherQueueDetailPage({ params }: { params: { id: string } }) {
  const queueId = params.id;
  const queryClient = useQueryClient();
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: queue } = useQuery({
    queryKey: ["queue", queueId],
    queryFn: () => apiRequest<QueueDto>(`/queues/${queueId}`, { skipAuth: true }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members", queueId],
    queryFn: () => apiRequest<QueueMemberDto[]>(`/queues/${queueId}/members`, { skipAuth: true }),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats", queueId],
    queryFn: () => apiRequest<QueueStatisticsDto>(`/statistics?queueId=${queueId}`),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["history", queueId],
    queryFn: () => apiRequest<HistoryEntryDto[]>(`/history?queueId=${queueId}`),
  });

  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["queue", queueId] });
    queryClient.invalidateQueries({ queryKey: ["members", queueId] });
    queryClient.invalidateQueries({ queryKey: ["stats", queueId] });
    queryClient.invalidateQueries({ queryKey: ["history", queueId] });
  }

  useQueueSocket(queueId, {
    [SocketEvents.MEMBER_JOINED]: refreshAll,
    [SocketEvents.MEMBER_LEFT]: refreshAll,
    [SocketEvents.MEMBERS_REORDERED]: refreshAll,
    [SocketEvents.QUEUE_RANDOMIZED]: refreshAll,
    [SocketEvents.NEXT_CALLED]: refreshAll,
    [SocketEvents.QUEUE_OPENED]: refreshAll,
    [SocketEvents.QUEUE_CLOSED]: refreshAll,
    [SocketEvents.SWAP_ACCEPTED]: refreshAll,
    [SocketEvents.SWAP_REJECTED]: refreshAll,
    [SocketEvents.SWAP_REVERTED]: refreshAll,
    [SocketEvents.TIMER_TICK]: (payload: { remaining: number; running: boolean }) => {
      setTimerRemaining(payload.remaining);
      setTimerRunning(payload.running);
    },
  });

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    setBusy(true);
    try {
      await fn();
      refreshAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Действие не выполнено");
    } finally {
      setBusy(false);
    }
  }

  if (!queue) {
    return <p className="text-center text-slate-500">Загрузка...</p>;
  }

  const joinLink = typeof window !== "undefined" ? `${window.location.origin}/q/${queue.roomCode}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">{queue.title}</h1>
              <p className="text-sm text-slate-500">{queue.subject}</p>
            </div>
            <span
              className={
                queue.status === "OPEN"
                  ? "rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
              }
            >
              {queue.status === "OPEN" ? "Открыта" : "Закрыта"}
            </span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                runAction(() =>
                  apiRequest(`/queues/${queueId}/status`, {
                    method: "PATCH",
                    body: { status: queue.status === "OPEN" ? "CLOSED" : "OPEN" },
                  }),
                )
              }
            >
              {queue.status === "OPEN" ? "Закрыть очередь" : "Открыть очередь"}
            </button>
            <button
              className="btn-secondary"
              disabled={busy || !queue.randomEnabled}
              title={!queue.randomEnabled ? "Случайный режим выключен для этой очереди" : ""}
              onClick={() => runAction(() => apiRequest(`/queues/${queueId}/randomize`, { method: "POST" }))}
            >
              Перемешать очередь
            </button>
            <button
              className="btn-primary"
              disabled={busy}
              onClick={() => runAction(() => apiRequest(`/queues/${queueId}/call-next`, { method: "POST" }))}
            >
              Вызвать следующего
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {timerRunning ? (
              <>
                <span className="text-lg font-mono">⏱ {timerRemaining ?? "--"} сек</span>
                <button
                  className="btn-secondary"
                  onClick={() => runAction(() => apiRequest(`/queues/${queueId}/timer/stop`, { method: "POST" }))}
                >
                  Остановить таймер
                </button>
              </>
            ) : (
              <button
                className="btn-secondary"
                disabled={busy}
                onClick={() =>
                  runAction(() =>
                    apiRequest(`/queues/${queueId}/timer/start`, {
                      method: "POST",
                      body: queue.timerSeconds ? { seconds: queue.timerSeconds } : {},
                    }),
                  )
                }
              >
                Запустить таймер {queue.timerSeconds ? `(${queue.timerSeconds}с)` : ""}
              </button>
            )}
          </div>

          {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Участники ({members.length})</h2>
          <div className="space-y-1">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isCurrent={m.position === queue.currentPosition} />
            ))}
            {members.length === 0 && <p className="text-sm text-slate-500">Очередь пуста</p>}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">История</h2>
          <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {history.map((h) => (
              <div key={h.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                <span>{h.description}</span>
                <span className="text-xs text-slate-400">{new Date(h.createdAt).toLocaleTimeString("ru-RU")}</span>
              </div>
            ))}
            {history.length === 0 && <p className="text-sm text-slate-500">Пока пусто</p>}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card text-center">
          <h2 className="mb-2 font-semibold">Присоединиться</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={queue.qrCode} alt="QR-код" className="mx-auto h-40 w-40" />
          <p className="mt-2 text-lg font-mono">{queue.roomCode}</p>
          <button
            type="button"
            className="btn-secondary mt-2 w-full"
            onClick={() => navigator.clipboard.writeText(joinLink)}
          >
            Скопировать ссылку
          </button>
        </div>

        <div className="card">
          <h2 className="mb-2 font-semibold">Статистика</h2>
          {stats ? (
            <ul className="space-y-1 text-sm">
              <li>Всего студентов: {stats.totalStudents}</li>
              <li>Осталось: {stats.remainingStudents}</li>
              <li>Прошло: {stats.passedStudents}</li>
              <li>Среднее время: {stats.averageTimeSeconds ? `${stats.averageTimeSeconds} с` : "—"}</li>
              <li>Обменов: {stats.swapCount}</li>
              <li>Вышло из очереди: {stats.leftCount}</li>
            </ul>
          ) : (
            <p className="text-sm text-slate-500">Загрузка...</p>
          )}
        </div>

        <div className="card space-y-2">
          <h2 className="font-semibold">Экспорт</h2>
          <button
            className="btn-secondary w-full"
            onClick={() => downloadFile(`/export/${queueId}/pdf`, `${queue.roomCode}-queue.pdf`)}
          >
            Экспорт в PDF
          </button>
          <button
            className="btn-secondary w-full"
            onClick={() => downloadFile(`/export/${queueId}/excel`, `${queue.roomCode}-queue.xlsx`)}
          >
            Экспорт в Excel
          </button>
        </div>
      </div>
    </div>
  );
}
