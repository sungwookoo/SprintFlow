import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { digest, readSession, signSession, sessionAge, type Session } from "@/lib/auth-crypto";

const cookieName = process.env.NODE_ENV === "production" ? "__Host-sprintflow" : "sprintflow";
export function authConfig() {
  const username = process.env.ADMIN_USERNAME;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const secret = process.env.SESSION_SECRET;
  const origin = process.env.APP_ORIGIN;
  if (!username || !passwordHash || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash) || !secret || secret.length < 32 || !origin) return null;
  return { username, passwordHash, secret, origin, version: digest(`${username}:${passwordHash}`) };
}

export async function getSession(): Promise<Session | null> {
  const config = authConfig();
  if (!config) return null;
  const session = readSession((await cookies()).get(cookieName)?.value ?? "", config.secret);
  if (!session) return null;
  if (session.role === "admin") return session.version === config.version ? session : null;
  if (!session.projectId) return null;
  const project = await prisma.project.findUnique({ where: { id: session.projectId }, select: { accessVersion: true, accessCodeHash: true } });
  return project?.accessCodeHash && String(project.accessVersion) === session.version ? session : null;
}

export async function setSession(session: Omit<Session, "expires">) {
  const config = authConfig();
  if (!config) throw new Error("인증 설정이 필요합니다.");
  (await cookies()).set(cookieName, signSession({ ...session, expires: Date.now() + sessionAge * 1000 }, config.secret), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: sessionAge
  });
}

export async function clearSession() {
  (await cookies()).set(cookieName, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

export function checkOrigin(request: Request) {
  const config = authConfig();
  if (!config) return NextResponse.json({ message: "관리자 인증 설정이 필요합니다." }, { status: 503 });
  if (!["GET", "HEAD"].includes(request.method) && request.headers.get("origin") !== config.origin) {
    return NextResponse.json({ message: "허용되지 않은 요청입니다." }, { status: 403 });
  }
  return null;
}

export async function authorize(request: Request, options: { admin?: boolean; project?: boolean } = { project: true }) {
  const denied = checkOrigin(request);
  if (denied) return denied;
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "다시 로그인해주세요." }, { status: 401 });
  if (options.admin && session.role !== "admin") return NextResponse.json({ message: "관리자만 사용할 수 있습니다." }, { status: 403 });
  if (options.project) {
    if (!session.projectId || !await prisma.project.count({ where: { id: session.projectId } })) {
      return NextResponse.json({ message: "워크스페이스를 선택해주세요." }, { status: 403 });
    }
  }
  return session;
}

// Persisted global limit for this small, single-instance app; no trust in
// client-supplied forwarding headers, and restarting does not reset the limit.
export async function allowLogin(kind: string) {
  const windowStart = BigInt(Math.floor(Date.now() / 300_000) * 300_000);
  return prisma.$transaction(async tx => {
    const row = await tx.loginThrottle.findUnique({ where: { id: kind } });
    const attempts = row?.windowStart === windowStart ? row.attempts + 1 : 1;
    await tx.loginThrottle.upsert({ where: { id: kind }, create: { id: kind, windowStart, attempts }, update: { windowStart, attempts } });
    return attempts <= (kind === "admin" ? 20 : 60);
  });
}

export async function validReferences(projectId: string, refs: { statusId?: unknown; sprintId?: unknown; parentId?: unknown; assigneeId?: unknown; authorId?: unknown }) {
  for (const [field, value] of Object.entries(refs)) {
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") return false;
    const where = { id: value, projectId };
    const count = field === "statusId" ? await prisma.status.count({ where }) : field === "sprintId" ? await prisma.sprint.count({ where }) :
      field === "parentId" ? await prisma.issue.count({ where: { ...where, deletedAt: null } }) : await prisma.member.count({ where });
    if (!count) return false;
  }
  return true;
}
