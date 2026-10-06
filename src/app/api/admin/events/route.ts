import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff, isValidGoogleDriveUrl, isWebPImage } from '@/lib/auth-server';
import { imagekit } from '@/lib/imagekit';
import { isUuid } from '@/lib/security';

export const runtime = 'nodejs';

const MAX_POSTER_SIZE = 1 * 1024 * 1024; // 1MB strictly enforced

export const ALLOWED_EVENT_CATEGORIES = [
  'flagship events',
  'main events',
  'fun events',
  'dts events',
] as const;

export type AllowedEventCategory = typeof ALLOWED_EVENT_CATEGORIES[number];

const TEXT_LIMITS = { title: 200, description: 5000, format: 100, duration: 100, venue: 200 } as const;

/** Returns an error message if any provided text field exceeds its maximum length. */
function textLimitError(fields: Partial<Record<keyof typeof TEXT_LIMITS, string | null | undefined>>): string | null {
  for (const [key, max] of Object.entries(TEXT_LIMITS)) {
    const value = fields[key as keyof typeof TEXT_LIMITS];
    if (typeof value === 'string' && value.length > max) return `Event ${key} must be at most ${max} characters.`;
  }
  return null;
}

// GET all events (Staff access)
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabase } = auth;
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      // If table doesn't exist yet, return helpful warning
      if (error.message?.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          success: true,
          events: [],
          notice: "Table 'events' not yet migrated in Supabase. Please run supabase/schema.sql."
        });
      }
      console.error('/api/admin/events database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, events: events || [] });
  } catch (err: unknown) {
    console.error('/api/admin/events error:', err);
    const message = 'Failed to fetch events';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Create a new event (Authorized IT Team & Admin)
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await req.formData();
    const title = (formData.get('title') as string || '').trim();
    const description = (formData.get('description') as string || '').trim();
    const brochureUrl = (formData.get('brochure_url') as string || '').trim();
    const rawCategory = (formData.get('category') as string || '').trim().toLowerCase();
    const format = formData.get('format') ? (formData.get('format') as string).trim() : null;
    const duration = formData.get('duration') ? (formData.get('duration') as string).trim() : null;
    const venue = formData.get('venue') ? (formData.get('venue') as string).trim() : null;
    const posterFile = formData.get('file') as File | null;

    // 0. Validate Event Category
    if (!rawCategory || !ALLOWED_EVENT_CATEGORIES.includes(rawCategory as AllowedEventCategory)) {
      return NextResponse.json(
        {
          error: `Invalid event category "${rawCategory}". Must be one of: [${ALLOWED_EVENT_CATEGORIES.join(', ')}].`,
        },
        { status: 400 }
      );
    }
    const category = rawCategory as AllowedEventCategory;

    const lengthErr = textLimitError({ title, description, format, duration, venue });
    if (lengthErr) {
      return NextResponse.json({ error: lengthErr }, { status: 400 });
    }

    // 1. Validate Event Name
    if (!title) {
      return NextResponse.json(
        { error: 'Event name is required.' },
        { status: 400 }
      );
    }

    // 2. Validate Event Details
    if (!description) {
      return NextResponse.json(
        { error: 'Event details/description are required.' },
        { status: 400 }
      );
    }

    // 3. Validate Event Brochure (Optional, but if provided must be a valid Google Drive link)
    if (brochureUrl && !isValidGoogleDriveUrl(brochureUrl)) {
      return NextResponse.json(
        {
          error:
            'Invalid brochure link. Event brochure must be a valid Google Drive link (e.g., https://drive.google.com/... or https://docs.google.com/...).',
        },
        { status: 400 }
      );
    }

    // 4. Validate Poster file
    if (!posterFile) {
      return NextResponse.json(
        { error: 'Event poster file is required.' },
        { status: 400 }
      );
    }

    // 4a. Format check: Only .webp
    const isWebpExt = posterFile.name.toLowerCase().endsWith('.webp');
    if (!isWebpExt) {
      return NextResponse.json(
        {
          error:
            'Invalid file format. Only .webp format is allowed for event posters.',
        },
        { status: 400 }
      );
    }

    // 4b. Size check: Max 1MB
    if (posterFile.size > MAX_POSTER_SIZE) {
      const sizeMb = (posterFile.size / (1024 * 1024)).toFixed(2);
      return NextResponse.json(
        {
          error: `Event poster exceeds the maximum allowed size of 1MB. Current file size: ${sizeMb}MB.`,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await posterFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4c. Verify WebP magic bytes
    if (!isWebPImage(posterFile.name, posterFile.type, buffer)) {
      return NextResponse.json(
        {
          error:
            'The uploaded file is not a valid WebP image. Please upload a genuine .webp image.',
        },
        { status: 400 }
      );
    }

    // 5. Upload poster to ImageKit
    const cleanFileName = posterFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uploadRes = await imagekit.upload({
      file: buffer,
      fileName: `event_${Date.now()}_${cleanFileName}`,
      folder: '/innovision/events',
      useUniqueFileName: true,
    });

    const posterUrl = uploadRes.url;

    // 6. Save event in Supabase database
    const { supabase, user } = auth;
    const newEvent: Record<string, unknown> = {
      title,
      description,
      poster_url: posterUrl,
      brochure_url: brochureUrl || null,
      category,
      created_by: user.id,
      updated_by: user.id,
    };
    if (format) newEvent.format = format;
    if (duration) newEvent.duration = duration;
    if (venue) newEvent.venue = venue;

    const { data: createdEvent, error: dbErr } = await supabase
      .from('events')
      .insert(newEvent)
      .select()
      .maybeSingle();

    if (dbErr) {
      console.error('Database error creating event:', dbErr);
      return NextResponse.json(
        {
          error: dbErr.message?.includes('does not exist')
            ? "Table 'events' does not exist in Supabase yet. Please execute the SQL in supabase/schema.sql in your Supabase SQL Editor."
            : 'Failed to save changes.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      event: createdEvent,
      message: 'Event uploaded successfully!',
    });
  } catch (err: unknown) {
    console.error('Error creating event:', err);
    const message = 'Failed to create event';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Edit event details (Authorized IT Team & Admin)
export async function PATCH(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const contentType = req.headers.get('content-type') || '';
    let eventId = '';
    let title: string | undefined;
    let description: string | undefined;
    let brochureUrl: string | undefined;
    let category: string | undefined;
    let format: string | undefined;
    let duration: string | undefined;
    let venue: string | undefined;
    let newPosterFile: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      eventId = (formData.get('id') as string || '').trim();
      title = formData.get('title') ? (formData.get('title') as string).trim() : undefined;
      description = formData.get('description') ? (formData.get('description') as string).trim() : undefined;
      brochureUrl = formData.get('brochure_url') ? (formData.get('brochure_url') as string).trim() : undefined;
      category = formData.get('category') ? (formData.get('category') as string).trim() : undefined;
      format = formData.get('format') ? (formData.get('format') as string).trim() : undefined;
      duration = formData.get('duration') ? (formData.get('duration') as string).trim() : undefined;
      venue = formData.get('venue') ? (formData.get('venue') as string).trim() : undefined;
      newPosterFile = formData.get('file') as File | null;
    } else {
      const body = await req.json();
      eventId = typeof body.id === 'string' ? body.id.trim() : '';
      title = body.title !== undefined ? String(body.title).trim() : undefined;
      description = body.description !== undefined ? String(body.description).trim() : undefined;
      brochureUrl = body.brochure_url !== undefined ? String(body.brochure_url).trim() : undefined;
      category = body.category !== undefined ? String(body.category).trim() : undefined;
      format = body.format !== undefined ? String(body.format).trim() : undefined;
      duration = body.duration !== undefined ? String(body.duration).trim() : undefined;
      venue = body.venue !== undefined ? String(body.venue).trim() : undefined;
    }

    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json(
        { error: 'Missing required event ID.' },
        { status: 400 }
      );
    }

    const patchLengthErr = textLimitError({ title, description, format, duration, venue });
    if (patchLengthErr) {
      return NextResponse.json({ error: patchLengthErr }, { status: 400 });
    }

    // Validate brochure link if supplied
    if (brochureUrl !== undefined && brochureUrl !== '') {
      if (!isValidGoogleDriveUrl(brochureUrl)) {
        return NextResponse.json(
          {
            error:
              'Invalid brochure link. Event brochure must be a valid Google Drive link (e.g., https://drive.google.com/... or https://docs.google.com/...).',
          },
          { status: 400 }
        );
      }
    }

    const { supabase, user } = auth;

    // Check existing event
    const { data: existing, error: fetchErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { error: 'Event not found.' },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined && title !== '') updates.title = title;
    if (description !== undefined && description !== '') updates.description = description;
    if (category !== undefined && category !== '') {
      const normCat = category.trim().toLowerCase();
      if (!ALLOWED_EVENT_CATEGORIES.includes(normCat as AllowedEventCategory)) {
        return NextResponse.json(
          {
            error: `Invalid event category "${category}". Must be one of: [${ALLOWED_EVENT_CATEGORIES.join(', ')}].`,
          },
          { status: 400 }
        );
      }
      updates.category = normCat;
    }
    if (brochureUrl !== undefined) {
      updates.brochure_url = brochureUrl.trim() !== '' ? brochureUrl.trim() : null;
    }
    if (format !== undefined) updates.format = format;
    if (duration !== undefined) updates.duration = duration;
    if (venue !== undefined) updates.venue = venue;

    // If a new poster is uploaded, enforce .webp and 1MB limits
    if (newPosterFile && newPosterFile.size > 0) {
      const isWebpExt = newPosterFile.name.toLowerCase().endsWith('.webp');
      if (!isWebpExt) {
        return NextResponse.json(
          {
            error:
              'Invalid file format. Only .webp format is allowed for event posters.',
          },
          { status: 400 }
        );
      }

      if (newPosterFile.size > MAX_POSTER_SIZE) {
        const sizeMb = (newPosterFile.size / (1024 * 1024)).toFixed(2);
        return NextResponse.json(
          {
            error: `Event poster exceeds the maximum allowed size of 1MB. Current file size: ${sizeMb}MB.`,
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await newPosterFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!isWebPImage(newPosterFile.name, newPosterFile.type, buffer)) {
        return NextResponse.json(
          {
            error:
              'The uploaded file is not a valid WebP image. Please upload a genuine .webp image.',
          },
          { status: 400 }
        );
      }

      const cleanFileName = newPosterFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const uploadRes = await imagekit.upload({
        file: buffer,
        fileName: `event_${Date.now()}_${cleanFileName}`,
        folder: '/innovision/events',
        useUniqueFileName: true,
      });

      updates.poster_url = uploadRes.url;
    }

    const { data: updatedEvent, error: updateErr } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error('/api/admin/events database error:', updateErr);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      event: updatedEvent,
      message: 'Event details updated successfully!',
    });
  } catch (err: unknown) {
    console.error('Error updating event:', err);
    const message = 'Failed to update event';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Delete an event (Authorized IT Team & Admin)
export async function DELETE(req: NextRequest) {
  try {
    const auth = await verifyStaff(req);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {}
    }

    if (!id || !isUuid(id)) {
      return NextResponse.json({ error: 'Missing event ID.' }, { status: 400 });
    }

    const { supabase } = auth;
    const { error } = await supabase.from('events').delete().eq('id', id);

    if (error) {
      console.error('/api/admin/events database error:', error);
      return NextResponse.json({ error: 'Database operation failed.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Event deleted successfully.',
    });
  } catch (err: unknown) {
    console.error('/api/admin/events error:', err);
    const message = 'Failed to delete event';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
