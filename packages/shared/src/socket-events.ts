export const SocketEvents = {
  MEMBER_JOINED: "member:joined",
  MEMBER_LEFT: "member:left",
  MEMBERS_REORDERED: "members:reordered",
  SWAP_REQUESTED: "swap:requested",
  SWAP_ACCEPTED: "swap:accepted",
  SWAP_REJECTED: "swap:rejected",
  SWAP_REVERTED: "swap:reverted",
  NEXT_CALLED: "queue:nextCalled",
  TIMER_TICK: "queue:timerTick",
  QUEUE_OPENED: "queue:opened",
  QUEUE_CLOSED: "queue:closed",
  QUEUE_RANDOMIZED: "queue:randomized",
  YOUR_TURN_SOON: "notification:yourTurnSoon",
} as const;

export type SocketEventName = (typeof SocketEvents)[keyof typeof SocketEvents];

export function queueRoom(queueId: string): string {
  return `queue:${queueId}`;
}
