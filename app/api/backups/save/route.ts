import { NextResponse } from "next/server";

import { createWorkspaceSnapshot, listBackupFiles, saveSnapshot } from "@/lib/backup";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ backups: await listBackupFiles() });
}

export async function POST() {
  const snapshot = await createWorkspaceSnapshot();
  const backup = await saveSnapshot(snapshot);

  return NextResponse.json({ backup }, { status: 201 });
}
