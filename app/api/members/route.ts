import { NextResponse } from "next/server";

import { serializeMember } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type CreateMemberBody = {
  projectId?: string;
  name?: string;
  initials?: string;
  role?: string;
  color?: string;
};

const defaultColors = ["#2563eb", "#15a46b", "#7c3aed", "#e11d48", "#d97706", "#0891b2"];

function normalizeInitials(name: string, initials?: string) {
  const value = initials?.trim();
  if (value) return value.slice(0, 3).toUpperCase();

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function normalizeColor(color: string | undefined, index: number) {
  if (color && /^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  return defaultColors[index % defaultColors.length];
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateMemberBody;
  const projectId = body.projectId;
  const name = body.name?.trim();

  if (!projectId || !name) {
    return NextResponse.json({ message: "projectId와 name이 필요합니다." }, { status: 400 });
  }

  const count = await prisma.member.count({ where: { projectId } });
  const member = await prisma.member.create({
    data: {
      projectId,
      name,
      initials: normalizeInitials(name, body.initials),
      role: body.role?.trim() || "팀원",
      color: normalizeColor(body.color, count)
    }
  });

  return NextResponse.json({ member: serializeMember(member) }, { status: 201 });
}
