import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Serves uploaded images from disk, read fresh on every request.
 *
 * This exists because `next start` indexes the public/ folder once at
 * server boot and doesn't notice files written there afterward — an
 * upload made against an already-running server 404s until the next
 * restart, silently, with no error at upload time. A route handler has
 * no such cache: every request re-reads the filesystem.
 */
const CONTENT_TYPES: Record<string, string> = {
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // Uploaded filenames are always our own `${timestamp}-${hex}.${ext}` —
  // reject anything else outright, before it ever touches the filesystem.
  if (!/^[\w-]+\.[a-z]+$/i.test(filename)) {
    return new NextResponse('Not found', { status: 404 });
  }
  const contentType = CONTENT_TYPES[path.extname(filename).toLowerCase()];
  if (!contentType) {
    return new NextResponse('Not found', { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'public', 'uploads', filename);
  let data: Buffer;
  try {
    data = await fs.readFile(filePath);
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
