import { NextResponse } from "next/server";

import { loadLatestSnapshot, restoreWorkspaceSnapshot } from "@/lib/backup";

export const runtime = "nodejs";

type RestoreBody = {
  latest?: boolean;
  snapshot?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RestoreBody;
    const source = body.latest ? await loadLatestSnapshot() : { snapshot: body.snapshot, file: null };
    const restored = await restoreWorkspaceSnapshot(source.snapshot);

    return NextResponse.json({
      restored,
      backup: source.file
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "백업 복원에 실패했습니다." },
      { status: 400 }
    );
  }
}
