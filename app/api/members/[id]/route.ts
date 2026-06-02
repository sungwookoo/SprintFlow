import { NextResponse } from "next/server";

import { serializeMember } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type UpdateMemberBody = Partial<{
  name: string;
  initials: string;
  role: string;
  color: string;
}>;

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as UpdateMemberBody;
  const data: UpdateMemberBody = {};

  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.initials === "string" && body.initials.trim()) data.initials = body.initials.trim().slice(0, 3).toUpperCase();
  if (typeof body.role === "string" && body.role.trim()) data.role = body.role.trim();
  if (typeof body.color === "string" && /^#[0-9a-f]{6}$/i.test(body.color)) data.color = body.color;

  const member = await prisma.member.update({
    where: { id },
    data
  });

  return NextResponse.json({ member: serializeMember(member) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  await prisma.member.delete({
    where: { id }
  });

  return NextResponse.json({ ok: true });
}
