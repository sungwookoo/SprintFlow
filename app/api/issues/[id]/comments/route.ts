import { NextResponse } from "next/server";
import { authorize, validReferences } from "@/lib/auth";

import { serializeComment } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type CreateCommentBody = {
  body?: string;
  authorId?: string | null;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await authorize(request);
  if (session instanceof Response) return session;
  const { id } = await context.params;
  if (!await prisma.issue.count({ where: { id, projectId: session.projectId!, deletedAt: null } })) return NextResponse.json({ message: "작업을 찾을 수 없습니다." }, { status: 404 });
  const payload = (await request.json()) as CreateCommentBody;
  if (!await validReferences(session.projectId!, { authorId: payload.authorId })) return NextResponse.json({ message: "현재 그룹의 담당자만 선택할 수 있습니다." }, { status: 400 });
  const body = payload.body?.trim();

  if (!body) {
    return NextResponse.json({ message: "댓글 내용이 필요합니다." }, { status: 400 });
  }

  const issue = await prisma.issue.findUniqueOrThrow({
    where: { id },
    select: { projectId: true }
  });
  const fallbackAuthor = await prisma.member.findFirst({
    where: { projectId: issue.projectId },
    orderBy: { name: "asc" }
  });

  const comment = await prisma.comment.create({
    data: {
      issueId: id,
      authorId: payload.authorId ?? fallbackAuthor?.id ?? null,
      body
    },
    include: {
      author: true
    }
  });

  return NextResponse.json({ comment: serializeComment(comment) }, { status: 201 });
}
