import { NextResponse } from "next/server";
import { authorize } from "@/lib/auth";

import { serializeAttachment } from "@/lib/data";
import { prisma } from "@/lib/prisma";

type CreateAttachmentBody = {
  fileName?: string;
  url?: string;
  fileSize?: number;
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
  const payload = (await request.json()) as CreateAttachmentBody;
  const fileName = payload.fileName?.trim();
  const url = payload.url?.trim();

  if (!fileName || !url) {
    return NextResponse.json({ message: "파일명과 URL이 필요합니다." }, { status: 400 });
  }
  try { if (!["https:", "http:"].includes(new URL(url).protocol)) throw new Error(); }
  catch { return NextResponse.json({ message: "첨부 링크는 http 또는 https 주소여야 합니다." }, { status: 400 }); }

  const attachment = await prisma.attachment.create({
    data: {
      issueId: id,
      fileName,
      url,
      fileSize: typeof payload.fileSize === "number" && payload.fileSize >= 0 ? Math.round(payload.fileSize) : 0
    }
  });

  return NextResponse.json({ attachment: serializeAttachment(attachment) }, { status: 201 });
}
