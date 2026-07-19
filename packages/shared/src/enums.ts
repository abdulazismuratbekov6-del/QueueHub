export enum Role {
  GUEST = "GUEST",
  STUDENT = "STUDENT",
  TEACHER = "TEACHER",
  ADMIN = "ADMIN",
}

export enum QueueStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export enum SwapType {
  ONE_ROUND = "ONE_ROUND",
  PERMANENT = "PERMANENT",
}

export enum SwapStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

export enum HistoryAction {
  JOIN = "JOIN",
  LEAVE = "LEAVE",
  SWAP = "SWAP",
  SWAP_REVERT = "SWAP_REVERT",
  RANDOMIZE = "RANDOMIZE",
  QUEUE_OPEN = "QUEUE_OPEN",
  QUEUE_CLOSE = "QUEUE_CLOSE",
}
