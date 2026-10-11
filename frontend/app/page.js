"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function Home() {
  const { user, loading, login, signup } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/workspaces");
  }, [loading, user, router]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "login") await login(form.email, form.password);
      else await signup(form.name, form.email, form.password);
      router.push("/workspaces");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{mode === "login" ? "Log in" : "Create account"}</h1>
        {mode === "signup" && (
          <input className="w-full rounded border p-2" placeholder="Name" value={form.name} onChange={set("name")} required />
        )}
        <input className="w-full rounded border p-2" type="email" placeholder="Email" value={form.email} onChange={set("email")} required />
        <input className="w-full rounded border p-2" type="password" placeholder="Password (min 8 chars)" value={form.password} onChange={set("password")} required minLength={8} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>
        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="w-full text-sm text-blue-600">
          {mode === "login" ? "Create a new account" : "Already have an account? Log in"}
        </button>
      </form>
    </div>
  );
}
