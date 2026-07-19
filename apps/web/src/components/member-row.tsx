"use client";

import { QueueMemberDto } from "@queuehub/shared";

function initials(firstName: string, lastName?: string | null) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export function MemberRow({
  member,
  isCurrent,
  isSelf,
  action,
}: {
  member: QueueMemberDto;
  isCurrent?: boolean;
  isSelf?: boolean;
  action?: React.ReactNode;
}) {
  const fullName = [member.user.firstName, member.user.lastName].filter(Boolean).join(" ");

  return (
    <div
      className={
        "flex items-center gap-3 rounded-lg border p-2 " +
        (isCurrent
          ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40"
          : isSelf
            ? "border-brand-300 bg-slate-50 dark:bg-slate-900"
            : "border-transparent")
      }
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold dark:bg-slate-800">
        {member.position}
      </span>
      {member.user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.user.avatarUrl}
          alt={fullName}
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
          {initials(member.user.firstName, member.user.lastName)}
        </span>
      )}
      <span className="flex-1 text-sm">
        {fullName}
        {isSelf && <span className="ml-1 text-xs text-brand-600 dark:text-brand-400">(вы)</span>}
        {member.user.isGuest && <span className="ml-1 text-xs text-slate-400">гость</span>}
      </span>
      {isCurrent && (
        <span className="text-xs font-medium text-brand-600 dark:text-brand-400">Сейчас</span>
      )}
      {action}
    </div>
  );
}
