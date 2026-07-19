import { Response } from "express";

export const REFRESH_COOKIE = "queuehub_refresh";
export const CSRF_COOKIE = "queuehub_csrf";

export function setAuthCookies(res: Response, refreshToken: string, csrfToken: string) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: Response) {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(REFRESH_COOKIE, { path: "/", sameSite: isProd ? "none" : "lax", secure: isProd });
  res.clearCookie(CSRF_COOKIE, { path: "/", sameSite: isProd ? "none" : "lax", secure: isProd });
}
