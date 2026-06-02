import { NextResponse } from "next/server";

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
  const { id } = await context.params;
  const payload = (await request.json()) as CreateAttachmentBody;
  const fileName = payload.fileName?.trim();
  const url = payload.url?.trim();

  if (!fileName || !url) {
    return NextResponse.json({ message: "파일명과 URL이 필요합니다." }, { status: 400 });
  }

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
