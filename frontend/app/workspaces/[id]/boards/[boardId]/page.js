"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { io } from "socket.io-client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import Shell from "@/components/Shell";
import { useAuth } from "@/components/AuthProvider";
import { API, api, getToken, refresh } from "@/lib/api";
import { calcPosition } from "@/lib/ordering";

const byPos = (a, b) => a.position - b.position;

// Upsert a task into its list (removing it from its previous list). Events carrying an older version are ignored.
function applyTask(lists, task) {
  const existing = lists.flatMap((l) => l.tasks).find((t) => t._id === task._id);
  if (existing && existing.version > task.version) return lists;
  return lists.map((l) => {
    const rest = l.tasks.filter((t) => t._id !== task._id);
    return l._id === task.listId ? { ...l, tasks: [...rest, task].sort(byPos) } : { ...l, tasks: rest };
  });
}
const removeTask = (lists, id) => lists.map((l) => ({ ...l, tasks: l.tasks.filter((t) => t._id !== id) }));

export default function BoardPage() {
  const { id, boardId } = useParams();
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [members, setMembers] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const connectedBefore = useRef(false);

  const role = (members.find((m) => m.id === user?.id) || {}).role;
  const canWrite = ["OWNER", "ADMIN", "MEMBER"].includes(role);

  const load = useCallback(async () => {
    try {
      const b = await api(`/workspaces/${id}/boards/${boardId}`);
      setBoard(b);
      setLists(b.lists);
    } catch (e) { setError(e.message); }
  }, [id, boardId]);

  useEffect(() => {
    load();
    api(`/workspaces/${id}/members`).then(setMembers).catch(() => {});
  }, [id, load]);

  // Real-time: join the board room and keep local state in sync with server events
  useEffect(() => {
    const socket = io(API, { auth: (cb) => cb({ token: getToken() }), withCredentials: true });
    socket.on("connect", () => {
      socket.emit("board:join", boardId, (ok) => setLive(Boolean(ok)));
      if (connectedBefore.current) load(); // recover events missed while disconnected
      connectedBefore.current = true;
    });
    socket.on("disconnect", () => setLive(false));
    socket.on("connect_error", async (e) => {
      if (e.message === "unauthorized") {
        const d = await refresh(); // the access token had expired
        if (d) socket.connect();
      }
    });
    socket.on("task:created", (t) => setLists((ls) => applyTask(ls, t)));
    socket.on("task:updated", (t) => setLists((ls) => applyTask(ls, t)));
    socket.on("task:moved", (t) => setLists((ls) => applyTask(ls, t)));
    socket.on("task:deleted", ({ id: tid }) => setLists((ls) => removeTask(ls, tid)));
    socket.on("list:created", (l) => setLists((ls) => (ls.some((x) => x._id === l._id) ? ls : [...ls, { ...l, tasks: [] }].sort(byPos))));
    socket.on("list:rebalanced", () => load());
    return () => { socket.emit("board:leave", boardId); socket.disconnect(); };
  }, [boardId, load]);

  function onDragEnd({ destination, source, draggableId }) {
    if (!destination || !canWrite) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const dest = lists.find((l) => l._id === destination.droppableId);
    const others = dest.tasks.filter((t) => t._id !== draggableId);
    const prev = others[destination.index - 1] || null;
    const next = others[destination.index] || null;
    const task = lists.flatMap((l) => l.tasks).find((t) => t._id === draggableId);

    // Optimistic update: reflect the move immediately; the server event later supplies the authoritative position
    const position = calcPosition(prev ? prev.position : null, next ? next.position : null);
    setLists((ls) => applyTask(ls, { ...task, listId: dest._id, position }));
    api(`/workspaces/${id}/tasks/${draggableId}/move`, {
      method: "POST",
      body: { listId: dest._id, prevId: prev ? prev._id : null, nextId: next ? next._id : null },
    }).catch((e) => { setError(`Move failed: ${e.message}`); load(); });
  }

  async function addList(e) {
    e.preventDefault();
    const name = new FormData(e.target).get("name");
    e.target.reset();
    try { await api(`/workspaces/${id}/boards/${boardId}/lists`, { method: "POST", body: { name } }); }
    catch (x) { setError(x.message); }
  }
  async function addTask(listId, title) {
    try { await api(`/workspaces/${id}/boards/${boardId}/lists/${listId}/tasks`, { method: "POST", body: { title } }); }
    catch (x) { setError(x.message); }
  }

  return (
    <Shell>
      <div className="mb-4 flex items-center gap-3">
        <Link href={`/workspaces/${id}`} className="text-sm text-blue-600">&larr; Back</Link>
        <h1 className="text-xl font-semibold">{board ? board.name : "Board"}</h1>
        <span className={`rounded px-2 py-0.5 text-xs ${live ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{live ? "Live" : "Offline"}</span>
        {role === "VIEWER" && <span className="text-xs text-gray-500">Read-only</span>}
      </div>
      {error && <p className="mb-3 text-sm text-red-600">{error} <button className="underline" onClick={() => setError("")}>dismiss</button></p>}

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {lists.map((l) => (
            <div key={l._id} className="w-72 shrink-0 rounded-lg bg-gray-200 p-3">
              <h3 className="mb-2 flex justify-between text-sm font-semibold">{l.name}<span className="text-gray-500">{l.tasks.length}</span></h3>
              <Droppable droppableId={l._id}>
                {(p) => (
                  <div ref={p.innerRef} {...p.droppableProps} className="min-h-[24px] space-y-2">
                    {l.tasks.map((t, i) => (
                      <Draggable key={t._id} draggableId={t._id} index={i} isDragDisabled={!canWrite}>
                        {(dp) => (
                          <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps} onClick={() => setEditing(t)}
                            className="cursor-pointer rounded border bg-white p-2 text-sm shadow-sm">
                            <div>{t.title}</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {t.labels.map((x) => <span key={x} className="rounded bg-blue-50 px-1.5 text-xs text-blue-700">{x}</span>)}
                              {t.assigneeId && <span className="rounded bg-gray-100 px-1.5 text-xs">{(members.find((m) => m.id === t.assigneeId) || {}).name || "assigned"}</span>}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {p.placeholder}
                  </div>
                )}
              </Droppable>
              {canWrite && <AddTask onAdd={(title) => addTask(l._id, title)} />}
            </div>
          ))}
          {canWrite && (
            <form onSubmit={addList} className="w-72 shrink-0">
              <input name="name" required placeholder="+ Add list" className="w-full rounded border bg-white p-2 text-sm" />
            </form>
          )}
        </div>
      </DragDropContext>

      {editing && (
        <EditModal
          task={editing} members={members} canWrite={canWrite} wsId={id}
          onClose={() => setEditing(null)}
          onConflict={(current) => { setLists((ls) => applyTask(ls, current)); setError("This task was modified by someone else. The latest version has been loaded; please try again."); }}
        />
      )}
    </Shell>
  );
}

function AddTask({ onAdd }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }} className="mt-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+ Add task" className="w-full rounded border bg-white p-1.5 text-sm" />
    </form>
  );
}

function EditModal({ task, members, canWrite, wsId, onClose, onConflict }) {
  const [f, setF] = useState({ title: task.title, description: task.description || "", labels: (task.labels || []).join(", "), assigneeId: task.assigneeId || "" });
  const [error, setError] = useState("");

  async function save(e) {
    e.preventDefault();
    try {
      await api(`/workspaces/${wsId}/tasks/${task._id}`, {
        method: "PATCH",
        body: {
          version: task.version, title: f.title, description: f.description,
          labels: f.labels.split(",").map((s) => s.trim()).filter(Boolean),
          assigneeId: f.assigneeId || null,
        },
      });
      onClose();
    } catch (x) {
      if (x.status === 409 && x.data) { onConflict(x.data.current); onClose(); } else setError(x.message);
    }
  }
  async function del() {
    try { await api(`/workspaces/${wsId}/tasks/${task._id}`, { method: "DELETE" }); onClose(); }
    catch (x) { setError(x.message); }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-lg bg-white p-5">
        <h2 className="text-lg font-semibold">Task</h2>
        <input className="w-full rounded border p-2" value={f.title} disabled={!canWrite} onChange={(e) => setF({ ...f, title: e.target.value })} required />
        <textarea className="w-full rounded border p-2" rows={3} placeholder="Description" value={f.description} disabled={!canWrite} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <input className="w-full rounded border p-2" placeholder="Labels (comma separated)" value={f.labels} disabled={!canWrite} onChange={(e) => setF({ ...f, labels: e.target.value })} />
        <select className="w-full rounded border p-2" value={f.assigneeId} disabled={!canWrite} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-between">
          {canWrite ? <button type="button" onClick={del} className="text-red-600">Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded border px-3 py-1">Close</button>
            {canWrite && <button className="rounded bg-blue-600 px-3 py-1 text-white">Save</button>}
          </div>
        </div>
      </form>
    </div>
  );
}
