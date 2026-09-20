import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import path from 'node:path';
import fs from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];
const MAX_BYTES = 8 * 1024 * 1024;
const NORMAL_MAX_DIMENSION = 1600;
const NORMAL_QUALITY = 82;
const ORIGINAL_QUALITY = 95;

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was sent.' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Images only: jpg, png, webp, avif or gif.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That image is over 8 MB. Shrink it first.' }, { status: 400 });
  }

  const uploadOriginal = form.get('original') === 'true';
  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const dir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(dir, { recursive: true });

  // Animated GIFs pass through untouched: sharp collapses animation to a
  // single frame by default, which is silent corruption you notice much later.
  if (file.type === 'image/gif') {
    const name = `${Date.now()}-${randomBytes(4).toString('hex')}.gif`;
    await fs.writeFile(path.join(dir, name), inputBuffer);
    return NextResponse.json({ url: `/uploads/${name}` });
  }

  // Metadata is stripped in both modes — phone photos carry the shooting
  // location in EXIF, and that has no business on a public site either way.
  // "original" means full resolution, not byte-for-byte.
  let pipeline = sharp(inputBuffer).rotate();
  if (!uploadOriginal) {
    pipeline = pipeline.resize({
      width: NORMAL_MAX_DIMENSION,
      height: NORMAL_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }
  const outputBuffer = await pipeline
    .webp({ quality: uploadOriginal ? ORIGINAL_QUALITY : NORMAL_QUALITY })
    .toBuffer();

  const name = `${Date.now()}-${randomBytes(4).toString('hex')}.webp`;
  await fs.writeFile(path.join(dir, name), outputBuffer);

  return NextResponse.json({ url: `/uploads/${name}` });
}
