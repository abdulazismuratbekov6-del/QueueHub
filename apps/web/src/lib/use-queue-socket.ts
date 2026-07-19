"use client";

import { useEffect } from "react";
import { SocketEventName } from "@queuehub/shared";
import { getSocket } from "./socket";
import { useAuthStore } from "./auth-store";

type Handlers = Partial<Record<SocketEventName, (payload: any) => void>>;

export function useQueueSocket(queueId: string | undefined, handlers: Handlers) {
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!queueId) return;
    const socket = getSocket();

    socket.emit("joinQueue", queueId);
    if (userId) {
      socket.emit("identify", userId);
    }

    const entries = Object.entries(handlers) as [SocketEventName, (payload: any) => void][];
    entries.forEach(([event, handler]) => socket.on(event, handler));

    return () => {
      entries.forEach(([event, handler]) => socket.off(event, handler));
      socket.emit("leaveQueue", queueId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueId, userId]);
}
