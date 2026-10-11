export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";


let accessToken = null;
export const setToken = (t) => { accessToken = t; };
export const getToken = () => accessToken;

let refreshing = null;
export function refresh() {
  if (!refreshing) {
    refreshing = fetch(`${API}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (r) => {
        if (!r.ok) { accessToken = null; return null; }
        const d = await r.json();
        accessToken = d.accessToken;
        return d;
      })
      .catch(() => null)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api(path, { method = "GET", body } = {}, retry = true) {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && !path.startsWith("/auth/")) {
    const d = await refresh();
    if (d) return api(path, { method, body }, false);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
