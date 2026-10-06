import { authorize } from "@/lib/auth";
import { NextResponse } from "next/server";

import { createWorkspaceSnapshot, getBackupFileName } from "@/lib/backup";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await authorize(request, { admin: true, project: true });
  if (session instanceof Response) return session;
  const projectId = session.projectId!;
  const snapshot = await createWorkspaceSnapshot(projectId);
  const fileName = getBackupFileName(new Date(snapshot.exportedAt));

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
