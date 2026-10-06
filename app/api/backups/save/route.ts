import { authorize } from "@/lib/auth";
import { NextResponse } from "next/server";

import { createWorkspaceSnapshot, listBackupFiles, saveSnapshot } from "@/lib/backup";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await authorize(request, { admin: true, project: true });
  if (session instanceof Response) return session;
  const projectId = session.projectId!;
  return NextResponse.json({ backups: await listBackupFiles(projectId) });
}

export async function POST(request: Request) {
  const session = await authorize(request, { admin: true, project: true });
  if (session instanceof Response) return session;
  const projectId = session.projectId!;
  const snapshot = await createWorkspaceSnapshot(projectId);
  const backup = await saveSnapshot(snapshot, projectId);

  return NextResponse.json({ backup }, { status: 201 });
}
