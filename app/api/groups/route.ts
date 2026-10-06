import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { digest, newGroupCode } from "@/lib/auth-crypto";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await authorize(request, { admin: true });
  if (session instanceof Response) return session;
  const body = await request.json();
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 80) return NextResponse.json({ message: "그룹 이름은 1~80자로 입력해주세요." }, { status: 400 });
  const code = newGroupCode();
  const project = await prisma.project.create({ data: {
    name: body.name.trim(), key: `G${newGroupCode().slice(0, 10).toUpperCase()}`, summary: "그룹 작업과 일정", leadName: "관리자",
    accessCodeHash: digest(code), statuses: { create: [
      { name: "할 일", category: "TODO", color: "#64748b", sortOrder: 0 },
      { name: "진행 중", category: "IN_PROGRESS", color: "#2563eb", sortOrder: 1 },
      { name: "완료", category: "DONE", color: "#15a46b", sortOrder: 2 }
    ] }
  } });
  return NextResponse.json({ id: project.id, code }, { status: 201 });
}
