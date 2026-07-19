import { Role } from "@queuehub/shared";

export interface AuthenticatedUser {
  id: string;
  role: Role;
  isGuest: boolean;
  firstName: string;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
}
