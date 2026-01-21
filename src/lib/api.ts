export const API_BASE = (import.meta as any).env?.VITE_API_BASE || "http://127.0.0.1:5001";

export function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (body && (body.error || body.message)) || res.statusText;
    throw new Error(message);
  }
  return body as T;
}
