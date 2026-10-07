import { NextRequest, NextResponse } from 'next/server';
import { imagekit } from '@/lib/imagekit';
import { getAuthenticatedUser } from '@/lib/auth-server';
import {
  createRateLimiter,
  detectFileType,
  FILE_EXTENSIONS,
  formFile,
  formText,
  isRegistrationUploadFolder,
  paymentProofFilePrefix,
  readFormLimited,
  REGISTRATION_UPLOAD_FOLDERS,
} from '@/lib/security';

export const runtime = 'nodejs';

// Enforce 2MB maximum limit
const MAX_SIZE = 2 * 1024 * 1024;

// Registrants upload a payment screenshot; allow retries but stop bulk abuse of storage.
const uploadLimiter = createRateLimiter({ limit: 20, windowMs: 10 * 60 * 1000 });

/**
 * POST /api/upload
 * Uploads a registration payment screenshot to ImageKit.
 * Requires a signed-in user; the file type is decided by its magic bytes, never by the client's name or MIME type.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required: please sign in before uploading files.' },
        { status: 401 }
      );
    }

    if (!uploadLimiter.hit(auth.user.id)) {
      return NextResponse.json(
        { error: 'Too many uploads. Please wait a few minutes and try again.' },
        { status: 429 }
      );
    }

    const form = await readFormLimited(req, MAX_SIZE + 64 * 1024);
    if (!form.ok) {
      const error = form.status === 413 ? 'File size exceeds maximum limit of 2MB. Please select a smaller file.' : form.error;
      return NextResponse.json({ error }, { status: form.status });
    }
    const file = formFile(form.value, 'file');
    const folder = formText(form.value, 'folder');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!isRegistrationUploadFolder(folder)) {
      return NextResponse.json({ error: 'Invalid upload destination.' }, { status: 400 });
    }

    if (file.size === 0 || file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum limit of 2MB. Please select a smaller file.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const type = detectFileType(buffer);
    const allowed: readonly string[] = REGISTRATION_UPLOAD_FOLDERS[folder];
    if (!type || !allowed.includes(type)) {
      return NextResponse.json(
        {
          error: 'Upload the screenshot as an image (JPG, PNG or WebP).',
        },
        { status: 400 }
      );
    }

    // Server-chosen name and extension: the client's filename never reaches storage. The owner prefix lets
    // /api/register reject a proof URL uploaded by a different user.
    const uploadRes = await imagekit.upload({
      file: buffer,
      fileName: `${paymentProofFilePrefix(auth.user.id)}${Date.now()}.${FILE_EXTENSIONS[type]}`,
      folder,
      useUniqueFileName: true,
      // Private: the stored URL alone doesn't load. Staff view it through short-lived signed URLs
      // from /api/admin/registrations/payment-proof.
      isPrivateFile: true,
      tags: [`uid_${auth.user.id}`],
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
    return NextResponse.json(
      { error: 'Failed to upload file. Please try again.' },
      { status: 500 }
    );
  }
}
