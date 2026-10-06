import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { digest, newGroupCode } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, context: Context) {
  const session = await authorize(request, { admin: true });
  if (session instanceof Response) return session;
  const { id } = await context.params;
  if (!await prisma.project.count({ where: { id } })) return NextResponse.json({ message: "그룹을 찾을 수 없습니다." }, { status: 404 });
  const body = await request.json();
  if (body.action === "rotate") {
    const code = newGroupCode();
    await prisma.project.update({ where: { id }, data: { accessCodeHash: digest(code), accessVersion: { increment: 1 } } });
    return NextResponse.json({ code });
  }
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80) return NextResponse.json({ message: "그룹 이름은 1~80자로 입력해주세요." }, { status: 400 });
  await prisma.project.update({ where: { id }, data: { name: body.name.trim() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, context: Context) {
  const session = await authorize(request, { admin: true });
  if (session instanceof Response) return session;
  const { id } = await context.params;
  const body = await request.json();
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || body.confirm !== project.name) return NextResponse.json({ message: "삭제할 그룹 이름을 정확히 입력해주세요." }, { status: 400 });
  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
