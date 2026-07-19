import { HistoryAction, QueueStatus, Role, SwapStatus, SwapType } from "./enums";

export interface UserDto {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: Role;
  isGuest: boolean;
}

export interface QueueDto {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  roomCode: string;
  qrCode: string;
  ownerId: string;
  status: QueueStatus;
  randomEnabled: boolean;
  registrationOpen: boolean;
  timerSeconds: number | null;
  currentPosition: number;
  createdAt: string;
}

export interface QueueMemberDto {
  id: string;
  queueId: string;
  position: number;
  originalPosition: number;
  joinedAt: string;
  leftAt: string | null;
  user: UserDto;
}

export interface SwapRequestDto {
  id: string;
  queueId: string;
  senderId: string;
  receiverId: string;
  senderPosition: number;
  receiverPosition: number;
  swapType: SwapType;
  status: SwapStatus;
  createdAt: string;
  acceptedAt: string | null;
}

export interface HistoryEntryDto {
  id: string;
  queueId: string;
  userId: string | null;
  action: HistoryAction;
  description: string;
  createdAt: string;
}

export interface QueueStatisticsDto {
  totalStudents: number;
  remainingStudents: number;
  passedStudents: number;
  averageTimeSeconds: number | null;
  swapCount: number;
  leftCount: number;
}
