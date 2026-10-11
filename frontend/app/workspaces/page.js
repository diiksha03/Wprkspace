"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import { api } from "@/lib/api";

export default function Workspaces() {
  const [list, setList] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/workspaces").then(setList).catch((e) => setError(e.message));
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      const ws = await api("/workspaces", { method: "POST", body: { name } });
      setList([...(list || []), { ...ws, role: "OWNER" }]);
      setName("");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Shell>
      <h1 className="mb-4 text-2xl font-semibold">Your workspaces</h1>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {!list ? <p className="text-gray-500">Loading...</p> : (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((w) => (
            <Link key={w._id} href={`/workspaces/${w._id}`} className="rounded-lg border bg-white p-4 hover:shadow">
              <div className="font-medium">{w.name}</div>
              <span className="mt-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs">{w.role}</span>
            </Link>
          ))}
          {list.length === 0 && <p className="text-gray-500">You have no workspaces yet. Create one below.</p>}
        </div>
      )}
      <form onSubmit={create} className="flex max-w-md gap-2">
        <input className="flex-1 rounded border p-2" placeholder="New workspace name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="rounded bg-blue-600 px-4 text-white hover:bg-blue-700">Create</button>
      </form>
    </Shell>
  );
}
