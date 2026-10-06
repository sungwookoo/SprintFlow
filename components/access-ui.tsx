"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function send(url: string, body: object, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "요청을 처리하지 못했습니다.");
  return data;
}
const field = "w-full rounded-lg border border-slate-300 p-3 text-slate-900";
const button = "rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50";

export function LoginForm({ admin = false, configured }: { admin?: boolean; configured: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <main className="mx-auto max-w-md px-6 py-20">
    <h1 className="text-3xl font-bold">SprintFlow</h1>
    <h2 className="mt-4 text-xl font-semibold">{admin ? "관리자 로그인" : "그룹 워크스페이스 입장"}</h2>
    <p className="mt-3 text-sm text-slate-600">{admin ? "관리자는 그룹과 입장 코드를 관리합니다." : "관리자에게 받은 그룹 코드를 입력해주세요. 같은 코드로 입장한 사람들과 작업을 공유합니다."}</p>
    {!configured && <p role="alert" className="mt-4 text-red-700">관리자 인증 설정이 아직 완료되지 않았습니다. 운영자에게 문의해주세요.</p>}
    <form className="mt-6 space-y-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      const values = new FormData(event.currentTarget);
      try { const result = await send("/api/access", { action: admin ? "admin" : "group", username: values.get("username"), password: values.get("password"), code: values.get("code") }); router.replace(result.redirect); router.refresh(); }
      catch (err) { setError((err as Error).message); } finally { setBusy(false); }
    }}>
      {admin ? <><label className="block">아이디<input className={field} name="username" autoComplete="username" required maxLength={100} /></label><label className="block">비밀번호<input className={field} name="password" type="password" autoComplete="current-password" required maxLength={256} /></label></> :
        <label className="block">그룹 코드<input className={field} name="code" type="password" autoComplete="off" autoCapitalize="none" spellCheck={false} required maxLength={128} /></label>}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button className={button} disabled={busy || !configured}>{busy ? "확인 중…" : admin ? "로그인" : "그룹 입장"}</button>
    </form>
    <a className="mt-6 inline-block text-sm text-blue-700 underline" href={admin ? "/login" : "/admin/login"}>{admin ? "그룹 코드로 입장" : "관리자 로그인"}</a>
    <p className="mt-6 text-xs text-slate-500">로그인은 24시간 유지됩니다. 공용 기기에서는 사용 후 로그아웃해주세요.</p>
  </main>;
}

export function AccessBar({ admin, name }: { admin: boolean; name: string }) {
  const [error, setError] = useState("");
  return <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-slate-100 px-6 py-2 text-sm">
    <span>{name} · {admin ? "관리자" : "참여자"}</span>
    <div className="flex gap-4">{admin && <a href="/admin" className="text-blue-700 underline">그룹 관리</a>}
      <button onClick={async () => { try { await send("/api/access", { action: "logout" }); window.location.replace("/login"); } catch (err) { setError((err as Error).message); } }}>로그아웃 / 그룹 전환</button></div>
    {error && <span role="alert">{error}</span>}
  </div>;
}

type Group = { id: string; name: string; key: string; hasCode: boolean; issues: number };
export function GroupManager({ groups, selectedProjectId }: { groups: Group[]; selectedProjectId?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [trash, setTrash] = useState<{ id: string; summary: string; issueKey: string }[]>([]);
  async function act(task: () => Promise<void>) {
    setBusy(true); setMessage(""); setCode("");
    try { await task(); router.refresh(); } catch (err) { setMessage((err as Error).message); } finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-2xl font-bold">그룹 워크스페이스 관리</h1>
    <p className="text-slate-600">그룹마다 작업과 담당자가 분리됩니다. 입장 코드는 참여자에게만 공유하세요. 담당자 이름은 개인 인증 정보가 아닙니다.</p>
    <form className="flex gap-3" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const name = new FormData(form).get("name"); void act(async () => { const result = await send("/api/groups", { name }); setCode(result.code); form.reset(); }); }}>
      <input className={field} name="name" aria-label="새 그룹 이름" placeholder="새 그룹 이름" required maxLength={80} /><button className={`${button} shrink-0`} disabled={busy}>그룹 생성</button>
    </form>
    {code && <div role="status" className="rounded-lg border border-blue-300 bg-blue-50 p-4"><p className="font-bold">새 입장 코드 · 지금 복사해 보관하세요</p><code className="my-3 block select-all break-all text-lg">{code}</code><p className="text-sm">코드는 다시 표시되지 않습니다. 분실하면 재발급할 수 있습니다. 재발급 전 코드와 참여자 로그인은 더 이상 사용할 수 없습니다.</p></div>}
    {message && <p role="alert" className="text-red-700">{message}</p>}
    {groups.map(group => <section key={group.id} className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="text-lg font-bold">{group.name}</h2><p className="text-sm text-slate-500">{group.key} · 작업 {group.issues}개 · {group.hasCode ? "입장 코드 발급됨" : "코드 미발급 · 관리자만 접근 가능"}</p>
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={busy} onClick={() => void act(async () => { await send("/api/access", { action: "select", projectId: group.id }); window.location.replace(new URL("/", window.location.origin).href); })}>워크스페이스 열기</button>
        <button disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => { if (!group.hasCode || window.confirm("기존 코드와 모든 참여자 로그인을 만료하고 새 코드를 발급할까요?")) void act(async () => { const result = await send(`/api/groups/${group.id}`, { action: "rotate" }, "PATCH"); setCode(result.code); }); }}>{group.hasCode ? "입장 코드 재발급" : "입장 코드 발급"}</button>
        <button disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => { const name = window.prompt("그룹 이름", group.name); if (name) void act(async () => { await send(`/api/groups/${group.id}`, { name }, "PATCH"); }); }}>이름 변경</button>
        <button disabled={busy} className="rounded-lg border border-red-300 px-3 py-2 text-red-700" onClick={() => { const confirm = window.prompt(`모든 작업이 영구 삭제됩니다. 삭제하려면 그룹 이름 ‘${group.name}’을 입력하세요.`); if (confirm === group.name) void act(async () => { await send(`/api/groups/${group.id}`, { confirm }, "DELETE"); }); }}>그룹 삭제</button>
      </div>
      {selectedProjectId === group.id && <><button className="text-sm text-blue-700 underline" disabled={busy} onClick={() => void act(async () => { const response = await fetch("/api/trash"); const result = await response.json(); if (!response.ok) throw new Error(result.message); setTrash(result.issues); setMessage(result.issues.length ? "휴지통을 불러왔습니다." : "휴지통이 비어 있습니다."); })}>선택된 그룹 휴지통 보기</button>
        {trash.map(issue => <div className="flex flex-wrap gap-3 border-t pt-3" key={issue.id}><span>{issue.issueKey} · {issue.summary}</span><button className="text-blue-700" disabled={busy} onClick={() => void act(async () => { await send("/api/trash", { id: issue.id, action: "restore" }); setTrash(trash.filter(item => item.id !== issue.id)); })}>복구</button><button className="text-red-700" disabled={busy} onClick={() => { const confirm = window.prompt(`영구 삭제하려면 ${issue.issueKey}를 입력하세요.`); if (confirm === issue.issueKey) void act(async () => { await send("/api/trash", { id: issue.id, action: "purge", confirm }); setTrash(trash.filter(item => item.id !== issue.id)); }); }}>영구 삭제</button></div>)}</>}
    </section>)}
    <p className="text-sm text-slate-500">백업·복원은 워크스페이스를 연 뒤 설정에서 사용합니다. 기존 데이터의 그룹은 코드를 발급한 뒤 참여자에게 공유할 수 있습니다.</p>
  </main>;
}
