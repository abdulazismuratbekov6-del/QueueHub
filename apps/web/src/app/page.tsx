"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function extractRoomCode(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/q\/([A-Za-z0-9-]+)/);
  if (match) return match[1].toUpperCase();
  return trimmed.toUpperCase();
}

export default function HomePage() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    router.push(`/q/${extractRoomCode(code)}`);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-3xl font-bold">Добро пожаловать в QueueHub</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Введите код комнаты, вставьте ссылку на очередь или отсканируйте QR-код камерой телефона,
        чтобы присоединиться.
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <input
          className="input text-center text-lg tracking-widest"
          placeholder="ABC-123"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn-primary w-full">
          Перейти к очереди
        </button>
      </form>

      <p className="text-sm text-slate-500">
        Вы преподаватель?{" "}
        <a href="/teacher" className="text-brand-600 hover:underline dark:text-brand-400">
          Создать очередь
        </a>
      </p>
    </div>
  );
}
