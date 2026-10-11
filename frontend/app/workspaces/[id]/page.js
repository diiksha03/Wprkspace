"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";

const TABS = ["Boards", "Dashboard", "Members", "Activity", "Search"];
const err = (e, set) => set(e.message || "Something went wrong");

export default function WorkspacePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState("Boards");
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");

  const loadMembers = useCallback(() => api(`/workspaces/${id}/members`).then(setMembers).catch((e) => err(e, setError)), [id]);
  useEffect(() => { loadMembers(); }, [loadMembers]);

  const role = (members.find((m) => m.id === user?.id) || {}).role;
  const canWrite = ["OWNER", "ADMIN", "MEMBER"].includes(role);
  const canManage = ["OWNER", "ADMIN"].includes(role);

  return (
    <Shell>
      <div className="mb-4 flex items-center gap-3">
        <Link href="/workspaces" className="text-sm text-blue-600">&larr; Workspaces</Link>
        {role && <span className="rounded bg-gray-200 px-2 py-0.5 text-xs">Your role: {role}</span>}
      </div>
      <div className="mb-4 flex gap-2 border-b">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-sm ${tab === t ? "border-b-2 border-blue-600 font-medium" : "text-gray-500"}`}>{t}</button>
        ))}
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {tab === "Boards" && <Boards id={id} canWrite={canWrite} />}
      {tab === "Dashboard" && <Dashboard id={id} />}
      {tab === "Members" && <Members id={id} members={members} canManage={canManage} myRole={role} reload={loadMembers} />}
      {tab === "Activity" && <Activity id={id} />}
      {tab === "Search" && <Search id={id} members={members} />}
    </Shell>
  );
}

function Boards({ id, canWrite }) {
  const [boards, setBoards] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { api(`/workspaces/${id}/boards`).then(setBoards).catch((e) => err(e, setError)); }, [id]);

  async function create(e) {
    e.preventDefault();
    try {
      const b = await api(`/workspaces/${id}/boards`, { method: "POST", body: { name } });
      setBoards([...(boards || []), b]);
      setName("");
    } catch (x) { err(x, setError); }
  }
  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(boards || []).map((b) => (
          <Link key={b._id} href={`/workspaces/${id}/boards/${b._id}`} className="rounded-lg border bg-white p-4 hover:shadow">{b.name}</Link>
        ))}
        {boards && boards.length === 0 && <p className="text-gray-500">No boards yet.</p>}
      </div>
      {canWrite ? (
        <form onSubmit={create} className="flex max-w-md gap-2">
          <input className="flex-1 rounded border p-2" placeholder="New board name" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="rounded bg-blue-600 px-4 text-white">Create</button>
        </form>
      ) : <p className="text-sm text-gray-500">Viewers have read-only access.</p>}
    </div>
  );
}

function Dashboard({ id }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => { api(`/workspaces/${id}/dashboard`).then(setD).catch((e) => err(e, setError)); }, [id]);
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!d) return <p className="text-gray-500">Loading...</p>;
  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {[["Boards", d.boards], ["Members", d.members], ["Tasks", d.totalTasks]].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-white p-4"><div className="text-2xl font-semibold">{v}</div><div className="text-sm text-gray-500">{k}</div></div>
        ))}
      </div>
      <h3 className="mb-2 font-medium">Tasks per list</h3>
      <ul className="mb-3 space-y-1 text-sm">{d.tasksPerList.map((x) => <li key={x.listId}>{x.name}: {x.count}</li>)}</ul>
      <p className="text-xs text-gray-400">{d.cached ? "Served from cache (60s TTL, invalidated on every mutation)" : "Fresh from database"}</p>
    </div>
  );
}

function Members({ id, members, canManage, myRole, reload }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [error, setError] = useState("");

  async function invite(e) {
    e.preventDefault();
    setError("");
    try { await api(`/workspaces/${id}/members`, { method: "POST", body: { email, role } }); setEmail(""); reload(); }
    catch (x) { err(x, setError); }
  }
  async function change(uid, r) {
    setError("");
    try { await api(`/workspaces/${id}/members/${uid}`, { method: "PATCH", body: { role: r } }); reload(); }
    catch (x) { err(x, setError); }
  }
  async function remove(uid) {
    setError("");
    try { await api(`/workspaces/${id}/members/${uid}`, { method: "DELETE" }); reload(); }
    catch (x) { err(x, setError); }
  }
  const roles = myRole === "OWNER" ? ["ADMIN", "MEMBER", "VIEWER"] : ["MEMBER", "VIEWER"];

  return (
    <div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      <table className="mb-4 w-full max-w-2xl rounded border bg-white text-sm">
        <thead><tr className="border-b text-left"><th className="p-2">Name</th><th>Email</th><th>Role</th><th /></tr></thead>
        <tbody>
          {members.map((m) => {
            const editable = canManage && m.role !== "OWNER" && (m.role !== "ADMIN" || myRole === "OWNER");
            return (
              <tr key={m.id} className="border-b last:border-0">
                <td className="p-2">{m.name}</td><td>{m.email}</td>
                <td>
                  {editable ? (
                    <select value={m.role} onChange={(e) => change(m.id, e.target.value)} className="rounded border p-1">
                      {["ADMIN", "MEMBER", "VIEWER"].filter((r) => roles.includes(r) || r === m.role).map((r) => <option key={r}>{r}</option>)}
                    </select>
                  ) : m.role}
                </td>
                <td>{editable && <button onClick={() => remove(m.id)} className="text-red-600">Remove</button>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {canManage ? (
        <form onSubmit={invite} className="flex max-w-2xl gap-2">
          <input className="flex-1 rounded border p-2" type="email" placeholder="Email of an existing user" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border p-2">{roles.map((r) => <option key={r}>{r}</option>)}</select>
          <button className="rounded bg-blue-600 px-4 text-white">Add</button>
        </form>
      ) : <p className="text-sm text-gray-500">Only Owners and Admins can manage members.</p>}
    </div>
  );
}

function Activity({ id }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (c) => {
    try {
      const d = await api(`/workspaces/${id}/activity?limit=20${c ? `&cursor=${c}` : ""}`);
      setItems((prev) => (c ? [...prev, ...d.items] : d.items));
      setCursor(d.nextCursor);
      setMore(Boolean(d.nextCursor));
    } catch (x) { err(x, setError); }
  }, [id]);
  useEffect(() => { load(null); }, [load]);

  return (
    <div className="max-w-2xl">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2 text-sm">
        {items.map((a) => (
          <li key={a._id} className="rounded border bg-white p-2">
            <b>{a.actorId ? a.actorId.name : "Someone"}</b> {a.action}
            {a.meta && a.meta.title ? ` "${a.meta.title}"` : ""}
            <span className="ml-2 text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      {more && <button onClick={() => load(cursor)} className="mt-3 rounded border px-3 py-1 text-sm">Load more</button>}
    </div>
  );
}

function Search({ id, members }) {
  const [f, setF] = useState({ q: "", label: "", assigneeId: "" });
  const [page, setPage] = useState(1);
  const [res, setRes] = useState(null);
  const [error, setError] = useState("");

  const run = useCallback(async (p) => {
    setError("");
    const qs = new URLSearchParams({ page: String(p), limit: "10" });
    Object.entries(f).forEach(([k, v]) => v && qs.set(k, v));
    try { setRes(await api(`/workspaces/${id}/tasks?${qs}`)); setPage(p); }
    catch (x) { err(x, setError); }
  }, [id, f]);
  useEffect(() => {
    run(1);
   
  }, [id]);

  return (
    <div className="max-w-2xl">
      <form onSubmit={(e) => { e.preventDefault(); run(1); }} className="mb-4 flex flex-wrap gap-2">
        <input className="flex-1 rounded border p-2" placeholder="Search title/description" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <input className="w-32 rounded border p-2" placeholder="Label" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        <select className="rounded border p-2" value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
          <option value="">Any assignee</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button className="rounded bg-blue-600 px-4 text-white">Search</button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {res && (
        <>
          <p className="mb-2 text-xs text-gray-500">{res.total} results, page {res.page} of {res.totalPages || 1}</p>
          <ul className="space-y-2 text-sm">
            {res.items.map((t) => (
              <li key={t._id} className="rounded border bg-white p-2">
                <Link className="text-blue-600" href={`/workspaces/${id}/boards/${t.boardId}`}>{t.title}</Link>
                {t.labels.map((l) => <span key={l} className="ml-2 rounded bg-gray-100 px-1.5 text-xs">{l}</span>)}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <button disabled={page <= 1} onClick={() => run(page - 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Prev</button>
            <button disabled={page >= res.totalPages} onClick={() => run(page + 1)} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Next</button>
          </div>
        </>
      )}
    </div>
  );
}
