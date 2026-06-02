import { NextResponse } from "next/server";

import { createWorkspaceSnapshot, getBackupFileName } from "@/lib/backup";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await createWorkspaceSnapshot();
  const fileName = getBackupFileName(new Date(snapshot.exportedAt));

  return new NextResponse(JSON.stringify(snapshot, null, 2), {
    headers: {
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
