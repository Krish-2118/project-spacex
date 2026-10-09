import { NextRequest, NextResponse } from 'next/server';
import { verifyEventStaff, isWebPImage } from '@/lib/auth-server';
import { imagekit } from '@/lib/imagekit';
import { formFile, formText, isImageKitPathInFolder, isUuid, readFormLimited, readJsonObject } from '@/lib/security';

export const runtime = 'nodejs';

const MAX_GALLERY_SIZE = 2 * 1024 * 1024; // 2MB strictly enforced

// GET all gallery images (Staff access)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyEventStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabase } = auth;
    const { data: gallery, error } = await supabase
      .from('gallery')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          gallery: [],
          notice: "Table 'gallery' not yet migrated in Supabase. Please run supabase/schema.sql."
        });
      }
      console.error('/api/admin/gallery database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, gallery: gallery || [] });
  } catch (err: unknown) {
    console.error('/api/admin/gallery error:', err);
    const message = 'Failed to fetch gallery images';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Upload an image to the gallery (Authorized IT Team & Admin)
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyEventStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const form = await readFormLimited(req, MAX_GALLERY_SIZE + 64 * 1024);
    if (!form.ok) {
      const error = form.status === 413 ? 'Gallery image exceeds the maximum allowed size of 2MB.' : form.error;
      return NextResponse.json({ error }, { status: form.status });
    }
    const title = formText(form.value, 'title') ?? '';
    const imageFile = formFile(form.value, 'file');

    if (title.length > 200) {
      return NextResponse.json({ error: 'Gallery title must be at most 200 characters.' }, { status: 400 });
    }

    // 1. Validate file exists
    if (!imageFile) {
      return NextResponse.json(
        { error: 'Gallery image file is required.' },
        { status: 400 }
      );
    }

    // 2. Enforce format: Only .webp
    const isWebpExt = imageFile.name.toLowerCase().endsWith('.webp');
    if (!isWebpExt) {
      return NextResponse.json(
        {
          error:
            'Invalid file format. Only .webp format is allowed for gallery images.',
        },
        { status: 400 }
      );
    }

    // 3. Enforce size limit: Max 2MB
    if (imageFile.size > MAX_GALLERY_SIZE) {
      const sizeMb = (imageFile.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        {
          error: `Gallery image exceeds the maximum allowed size of 2MB. Current file size: ${sizeMb}MB.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Verify WebP magic bytes (RIFF...WEBP)
    if (!isWebPImage(imageFile.name, imageFile.type, buffer)) {
      return NextResponse.json(
        {
          error:
            'The uploaded file is not a valid WebP image. Please upload a genuine .webp image.',
        },
        { status: 400 }
      );
    }

    // 5. Upload image to ImageKit
    const cleanFileName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uploadRes = await imagekit.upload({
      file: buffer,
      fileName: `gallery_${Date.now()}_${cleanFileName}`,
      folder: '/innovision/gallery',
      useUniqueFileName: true,
    });

    // 6. Save in Supabase database
    const { supabase, user } = auth;
    const newGalleryItem = {
      title: title || null, // Optional title
      image_url: uploadRes.url,
      file_id: uploadRes.fileId,
      created_by: user.id,
    };

    const { data: createdItem, error: dbErr } = await supabase
      .from('gallery')
      .insert(newGalleryItem)
      .select()
      .maybeSingle();

    if (dbErr) {
      console.error('Database error inserting gallery photo:', dbErr);
      return NextResponse.json(
        {
          error: dbErr.message?.includes('does not exist')
            ? "Table 'gallery' does not exist in Supabase yet. Please execute the SQL in supabase/schema.sql in your Supabase SQL Editor."
            : 'Failed to save changes.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      item: createdItem,
      message: 'Gallery image uploaded successfully!',
    });
  } catch (err: unknown) {
    console.error('Error uploading gallery image:', err);
    const message = 'Failed to upload gallery image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Edit image title (Authorized IT Team & Admin)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyEventStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const parsed = await readJsonObject(req);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const body = parsed.value;
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (body.title !== undefined && body.title !== null && typeof body.title !== 'string') {
      return NextResponse.json({ error: 'Gallery title must be text.' }, { status: 400 });
    }
    const title = typeof body.title === 'string' ? body.title.trim() : null;

    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: 'Missing gallery image ID.' }, { status: 400 });
    }

    if (title && title.length > 200) {
      return NextResponse.json({ error: 'Gallery title must be at most 200 characters.' }, { status: 400 });
    }

    const { supabase } = auth;
    const { data: updatedItem, error: updateErr } = await supabase
      .from('gallery')
      .update({
        title: title || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error('/api/admin/gallery database error:', updateErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      item: updatedItem,
      message: 'Gallery title updated successfully.',
    });
  } catch (err: unknown) {
    console.error('/api/admin/gallery error:', err);
    const message = 'Failed to update gallery image title';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove an image from the gallery (Authorized IT Team & Admin)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyEventStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      const body = await readJsonObject(req);
      if (body.ok && typeof body.value.id === 'string') id = body.value.id;
    }

    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: 'Missing gallery image ID.' }, { status: 400 });
    }

    const { supabase } = auth;

    // Fetch item to obtain file_id if deletion from ImageKit is desired
    const { data: item } = await supabase
      .from('gallery')
      .select('file_id')
      .eq('id', id)
      .maybeSingle();

    if (item?.file_id) {
      try {
        // file_id comes from a database row, so confirm it really is a gallery image before using the ImageKit
        // private key to delete it (never registration proofs or event posters).
        const details = await imagekit.getFileDetails(item.file_id);
        if (isImageKitPathInFolder(details.filePath, '/innovision/gallery')) {
          await imagekit.deleteFile(item.file_id);
        } else {
          console.warn('Refusing to delete ImageKit file outside the gallery folder:', item.file_id, details.filePath);
        }
      } catch (ikErr) {
        console.warn('Notice: ImageKit file deletion skipped or failed:', ikErr);
      }
    }

    const { error } = await supabase.from('gallery').delete().eq('id', id);

    if (error) {
      console.error('/api/admin/gallery database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Gallery image deleted successfully.',
    });
  } catch (err: unknown) {
    console.error('/api/admin/gallery error:', err);
    const message = 'Failed to delete gallery image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
