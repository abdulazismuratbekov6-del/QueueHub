import { customAlphabet } from "nanoid";

const letters = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ", 3);
const digits = customAlphabet("0123456789", 3);

export function generateRoomCode(): string {
  return `${letters()}-${digits()}`;
}
