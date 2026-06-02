import { NextResponse } from "next/server";

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
  const { id } = await context.params;
  const payload = (await request.json()) as CreateCommentBody;
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
