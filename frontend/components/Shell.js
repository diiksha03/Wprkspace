"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";

export default function Shell({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="p-8 text-gray-500">Loading... (the free-tier server may take 30-50 seconds to wake up)</div>;
  }
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link href="/workspaces" className="font-semibold">Workspace App</Link>
        <div className="flex items-center gap-4 text-sm">
          <span>{user.name}</span>
          <button onClick={async () => { await logout(); router.replace("/"); }} className="rounded border px-3 py-1 hover:bg-gray-100">Logout</button>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
