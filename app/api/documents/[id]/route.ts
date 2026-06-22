import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type StoredDocument = {
  file_path: string;
  original_name: string | null;
  mime_type: string | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await query<StoredDocument>("select file_path,original_name,mime_type from documents where id=$1 limit 1", [id]);
  const document = result.rows[0];
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!/^[0-9a-f-]{36}\.[a-z0-9]{1,9}$/i.test(document.file_path)) return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  const uploadsRoot = process.env.UPLOADS_DIR || "/data/uploads";
  const absolutePath = `${uploadsRoot}/${document.file_path}`;

  try {
    const file = await readFile(absolutePath);
    const filename = encodeURIComponent(document.original_name || "document");
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "content-type": document.mime_type || "application/octet-stream",
        "content-disposition": `inline; filename*=UTF-8''${filename}`,
        "cache-control": "private, max-age=300"
      }
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
