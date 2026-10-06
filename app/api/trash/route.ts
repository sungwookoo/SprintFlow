import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await authorize(request, { admin: true, project: true });
  if (session instanceof Response) return session;
  return NextResponse.json({ issues: await prisma.issue.findMany({ where: { projectId: session.projectId!, deletedAt: { not: null } }, select: { id: true, summary: true, issueKey: true } }) });
}

export async function POST(request: Request) {
  const session = await authorize(request, { admin: true, project: true });
  if (session instanceof Response) return session;
  const body = await request.json();
  if (typeof body.id !== "string") return NextResponse.json({ message: "작업을 선택해주세요." }, { status: 400 });
  const issue = await prisma.issue.findFirst({ where: { id: body.id, projectId: session.projectId!, deletedAt: { not: null } } });
  if (!issue) return NextResponse.json({ message: "작업을 찾을 수 없습니다." }, { status: 404 });
  if (body.action === "restore") {
    // Restore independently so a deleted parent cannot hide a restored child.
    await prisma.issue.update({ where: { id: issue.id }, data: { deletedAt: null, parentId: null } });
  } else if (body.action === "purge" && body.confirm === issue.issueKey) {
    // Keep children; permanent deletion must not cascade to other tasks.
    await prisma.$transaction(async tx => {
      await tx.issue.updateMany({ where: { parentId: issue.id, projectId: session.projectId! }, data: { parentId: null } });
      await tx.issue.delete({ where: { id: issue.id } });
    });
  } else return NextResponse.json({ message: "삭제할 작업 키를 확인해주세요." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
