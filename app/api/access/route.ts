import { NextResponse } from "next/server";
import { allowLogin, authConfig, authorize, checkOrigin, clearSession, setSession } from "@/lib/auth";
import { digest, verifyPassword } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const denied = checkOrigin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== "string") return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  if (body.action === "logout") {
    await clearSession();
    return NextResponse.json({ redirect: "/login" });
  }
  if (body.action === "select") {
    const session = await authorize(request, { admin: true });
    if (session instanceof Response) return session;
    if (typeof body.projectId !== "string" || !await prisma.project.count({ where: { id: body.projectId } })) return NextResponse.json({ message: "그룹을 찾을 수 없습니다." }, { status: 404 });
    await setSession({ role: "admin", projectId: body.projectId, version: session.version });
    return NextResponse.json({ redirect: "/" });
  }
  if (!["admin", "group"].includes(body.action)) return NextResponse.json({ message: "잘못된 요청입니다." }, { status: 400 });
  if (!await allowLogin(body.action)) return NextResponse.json({ message: "로그인 시도가 많습니다. 5분 후 다시 시도해주세요." }, { status: 429 });
  const config = authConfig()!;
  if (body.action === "admin") {
    const valid = typeof body.password === "string" && await verifyPassword(body.password, config.passwordHash);
    if (body.username !== config.username || !valid) return NextResponse.json({ message: "로그인 정보를 확인해주세요." }, { status: 401 });
    await setSession({ role: "admin", version: config.version });
    return NextResponse.json({ redirect: "/admin" });
  }
  if (typeof body.code !== "string" || body.code.length > 128) return NextResponse.json({ message: "그룹 코드를 확인해주세요." }, { status: 401 });
  const project = await prisma.project.findUnique({ where: { accessCodeHash: digest(body.code.trim()) } });
  if (!project) return NextResponse.json({ message: "그룹 코드를 확인해주세요." }, { status: 401 });
  await setSession({ role: "participant", projectId: project.id, version: String(project.accessVersion) });
  return NextResponse.json({ redirect: "/" });
}
