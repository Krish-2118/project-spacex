import { NextRequest, NextResponse } from 'next/server';
import { verifyStaff, isValidGoogleDriveUrl, isWebPImage } from '@/lib/auth-server';
import { imagekit } from '@/lib/imagekit';
import { formFile, formText, isUuid, jsonText, readFormLimited, readJsonObject } from '@/lib/security';

export const runtime = 'nodejs';

const MAX_POSTER_SIZE = 1 * 1024 * 1024; // 1MB strictly enforced
// Poster plus the text fields and multipart overhead.
const MAX_FORM_BYTES = MAX_POSTER_SIZE + 64 * 1024;

// In display order: flagship, standout, main, then DTS and fun (which share one world on the site).
export const ALLOWED_EVENT_CATEGORIES = [
  'flagship events',
  'standout events',
  'main events',
  'dts events',
  'fun events',
] as const;

export type AllowedEventCategory = typeof ALLOWED_EVENT_CATEGORIES[number];

const TEXT_LIMITS = { title: 200, description: 5000, format: 100, duration: 100, venue: 200, brochure_url: 2048 } as const;

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

    const form = await readFormLimited(req, MAX_FORM_BYTES);
    if (!form.ok) {
      const error = form.status === 413 ? 'Event poster exceeds the maximum allowed size of 1MB.' : form.error;
      return NextResponse.json({ error }, { status: form.status });
    }
    const formData = form.value;
    const title = formText(formData, 'title') ?? '';
    const description = formText(formData, 'description') ?? '';
    const brochureUrl = formText(formData, 'brochure_url') ?? '';
    const rawCategory = (formText(formData, 'category') ?? '').toLowerCase();
    const format = formText(formData, 'format') || null;
    const duration = formText(formData, 'duration') || null;
    const venue = formText(formData, 'venue') || null;
    const posterFile = formFile(formData, 'file');

    // 0. Validate Event Category
    if (!rawCategory || !ALLOWED_EVENT_CATEGORIES.includes(rawCategory as AllowedEventCategory)) {
      return NextResponse.json(
        {
          error: `Invalid event category. Must be one of: [${ALLOWED_EVENT_CATEGORIES.join(', ')}].`,
        },
        { status: 400 }
      );
    }
    const category = rawCategory as AllowedEventCategory;

    const lengthErr = textLimitError({ title, description, format, duration, venue, brochure_url: brochureUrl });
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
      const form = await readFormLimited(req, MAX_FORM_BYTES);
      if (!form.ok) {
        const error = form.status === 413 ? 'Event poster exceeds the maximum allowed size of 1MB.' : form.error;
        return NextResponse.json({ error }, { status: form.status });
      }
      const formData = form.value;
      // Empty text fields mean "unchanged" in the edit form.
      eventId = formText(formData, 'id') ?? '';
      title = formText(formData, 'title') || undefined;
      description = formText(formData, 'description') || undefined;
      brochureUrl = formText(formData, 'brochure_url') || undefined;
      category = formText(formData, 'category') || undefined;
      format = formText(formData, 'format') || undefined;
      duration = formText(formData, 'duration') || undefined;
      venue = formText(formData, 'venue') || undefined;
      newPosterFile = formFile(formData, 'file');
    } else {
      const parsed = await readJsonObject(req);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: parsed.status });
      }
      const body = parsed.value;
      eventId = typeof body.id === 'string' ? body.id.trim() : '';
      title = jsonText(body.title);
      description = jsonText(body.description);
      brochureUrl = jsonText(body.brochure_url);
      category = jsonText(body.category);
      format = jsonText(body.format);
      duration = jsonText(body.duration);
      venue = jsonText(body.venue);
    }

    if (!eventId || !isUuid(eventId)) {
      return NextResponse.json(
        { error: 'Missing required event ID.' },
        { status: 400 }
      );
    }

    const patchLengthErr = textLimitError({ title, description, format, duration, venue, brochure_url: brochureUrl });
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
            error: `Invalid event category. Must be one of: [${ALLOWED_EVENT_CATEGORIES.join(', ')}].`,
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
    if (newPosterFile) {
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
      const body = await readJsonObject(req);
      if (body.ok && typeof body.value.id === 'string') id = body.value.id;
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
