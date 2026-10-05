import { NextRequest, NextResponse } from 'next/server';
import { imagekit } from '@/lib/imagekit';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || '/innovision';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Enforce 2MB maximum limit
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum limit of 2MB. Please select a smaller file.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uploadRes = await imagekit.upload({
      file: buffer,
      fileName: `${Date.now()}_${cleanName}`,
      folder,
      useUniqueFileName: true,
    });

    return NextResponse.json({
      success: true,
      url: uploadRes.url,
      fileId: uploadRes.fileId,
      name: uploadRes.name,
      size: file.size,
    });
  } catch (error: unknown) {
    console.error('ImageKit upload error:', error);
    const message = error instanceof Error ? error.message : 'Failed to upload file to ImageKit';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
