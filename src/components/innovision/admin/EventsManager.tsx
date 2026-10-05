'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, EventItem } from '@/lib/supabase';
import { isValidGoogleDriveUrl } from '@/lib/auth-server';

interface EventsManagerProps {
  currentUser: UserProfile;
  getAuthToken: () => Promise<string | null>;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setConfirmModal: (modal: {
    isOpen: boolean;
    title: string;
    message: string;
    actionText: string;
    actionType: 'approve' | 'reject' | 'role' | 'default';
    onConfirm: () => void;
  } | null) => void;
  setPreviewImage: (preview: { url: string; title: string } | null) => void;
}

const MAX_POSTER_SIZE = 1 * 1024 * 1024; // 1MB strictly enforced

export const EVENT_CATEGORIES = [
  { key: 'flagship events', label: 'Flagship Events', badgeBg: 'rgba(234, 88, 12, 0.25)', badgeColor: 'oklch(0.76 0.11 38)', border: 'rgba(234, 88, 12, 0.5)' },
  { key: 'main events', label: 'Main Events', badgeBg: 'rgba(168, 85, 247, 0.25)', badgeColor: 'oklch(0.77 0.09 295)', border: 'rgba(168, 85, 247, 0.5)' },
  { key: 'fun events', label: 'Fun Events', badgeBg: 'rgba(20, 184, 166, 0.25)', badgeColor: 'oklch(0.8 0.08 178)', border: 'rgba(20, 184, 166, 0.5)' },
  { key: 'dts events', label: 'DTS Events', badgeBg: 'rgba(234, 179, 8, 0.25)', badgeColor: 'oklch(0.84 0.12 85)', border: 'rgba(234, 179, 8, 0.5)' },
] as const;

export type EventCategoryKey = typeof EVENT_CATEGORIES[number]['key'];

export default function EventsManager({
  getAuthToken,
  showToast,
  setConfirmModal,
  setPreviewImage,
}: EventsManagerProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);

  // Form State for Upload
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadBrochureUrl, setUploadBrochureUrl] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('flagship events');
  const [uploadPosterFile, setUploadPosterFile] = useState<File | null>(null);
  const [uploadPosterPreview, setUploadPosterPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const uploadFileInputRef = useRef<HTMLInputElement>(null);

  // Form State for Edit
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editBrochureUrl, setEditBrochureUrl] = useState('');
  const [editCategory, setEditCategory] = useState<string>('flagship events');
  const [editPosterFile, setEditPosterFile] = useState<File | null>(null);
  const [editPosterPreview, setEditPosterPreview] = useState<string | null>(null);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Events (Manual refresh or after actions)
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/events', {
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch events');
      setEvents(data.events || []);
      if (data.notice) {
        showToast(data.notice, 'info');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching events';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showToast]);

  // Initial Load on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitialEvents = async () => {
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/admin/events', {
          headers,
          credentials: 'include',
        });
        const data = await res.json();
        if (!isMounted) return;
        if (!res.ok) throw new Error(data.error || 'Failed to fetch events');
        setEvents(data.events || []);
        if (data.notice) {
          showToast(data.notice, 'info');
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Error fetching events';
        showToast(msg, 'error');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialEvents();
    return () => {
      isMounted = false;
    };
  }, [getAuthToken, showToast]);

  // Validate File (Poster: .webp only, <= 1MB)
  const validateAndSetPoster = (file: File | null, isEdit = false) => {
    const setError = isEdit ? setEditError : setUploadError;
    const setFile = isEdit ? setEditPosterFile : setUploadPosterFile;
    const setPreview = isEdit ? setEditPosterPreview : setUploadPosterPreview;

    setError('');
    if (!file) {
      setFile(null);
      setPreview(null);
      return;
    }

    // 1. Strict extension and MIME check
    const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
    if (!isWebp) {
      setError('Invalid file format! Event poster must strictly be a .webp image.');
      setFile(null);
      setPreview(null);
      return;
    }

    // 2. Strict size check: max 1MB
    if (file.size > MAX_POSTER_SIZE) {
      const currentMb = (file.size / (1024 * 1024)).toFixed(2);
      setError(`Poster too large! Event poster must not exceed 1MB. Selected size: ${currentMb}MB.`);
      setFile(null);
      setPreview(null);
      return;
    }

    setFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!uploadPosterFile) {
      setUploadError('Please select a .webp event poster (max 1MB).');
      return;
    }

    if (!uploadTitle.trim()) {
      setUploadError('Event name is required.');
      return;
    }

    if (!uploadDescription.trim()) {
      setUploadError('Event details/description are required.');
      return;
    }

    if (uploadBrochureUrl.trim() && !isValidGoogleDriveUrl(uploadBrochureUrl.trim())) {
      setUploadError(
        'Invalid brochure link! Must be a valid Google Drive link (e.g. https://drive.google.com/file/d/...).'
      );
      return;
    }

    try {
      setUploadSubmitting(true);
      const token = await getAuthToken();

      const formData = new FormData();
      formData.append('file', uploadPosterFile);
      formData.append('title', uploadTitle.trim());
      formData.append('description', uploadDescription.trim());
      formData.append('brochure_url', uploadBrochureUrl.trim());
      formData.append('category', uploadCategory);

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload event');

      showToast(`Event "${uploadTitle}" published successfully!`, 'success');

      // Reset form
      setUploadTitle('');
      setUploadDescription('');
      setUploadBrochureUrl('');
      setUploadPosterFile(null);
      setUploadPosterPreview(null);
      setIsUploadModalOpen(false);
      fetchEvents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setUploadSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (event: EventItem) => {
    setEditingEvent(event);
    setEditTitle(event.title || '');
    setEditDescription(event.description || '');
    setEditBrochureUrl(event.brochure_url || '');
    setEditCategory(event.category || 'flagship events');
    setEditPosterFile(null);
    setEditPosterPreview(null);
    setEditError('');
    setIsEditModalOpen(true);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent?.id) return;
    setEditError('');

    if (!editTitle.trim()) {
      setEditError('Event name is required.');
      return;
    }

    if (!editDescription.trim()) {
      setEditError('Event details/description are required.');
      return;
    }

    if (editBrochureUrl.trim() && !isValidGoogleDriveUrl(editBrochureUrl.trim())) {
      setEditError(
        'Invalid brochure link! Must be a valid Google Drive link (e.g. https://drive.google.com/file/d/...).'
      );
      return;
    }

    try {
      setEditSubmitting(true);
      const token = await getAuthToken();

      const formData = new FormData();
      formData.append('id', editingEvent.id);
      formData.append('title', editTitle.trim());
      formData.append('description', editDescription.trim());
      formData.append('brochure_url', editBrochureUrl.trim());
      formData.append('category', editCategory);

      if (editPosterFile) {
        formData.append('file', editPosterFile);
      }

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/events', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update event');

      showToast(`Event "${editTitle}" updated successfully!`, 'success');
      setIsEditModalOpen(false);
      setEditingEvent(null);
      fetchEvents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setEditError(msg);
      showToast(msg, 'error');
    } finally {
      setEditSubmitting(false);
    }
  };

  // Handle Event Deletion
  const handleDeleteEvent = (event: EventItem) => {
    if (!event.id) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Event',
      message: `Are you sure you want to delete "${event.title}"? This event and its details will be removed from the mission manifest.`,
      actionText: 'DELETE EVENT',
      actionType: 'reject',
      onConfirm: async () => {
        try {
          const token = await getAuthToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch(`/api/admin/events?id=${event.id}`, {
            method: 'DELETE',
            headers,
            credentials: 'include',
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete event');

          showToast(`Event "${event.title}" deleted.`, 'info');
          setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Delete failed';
          showToast(msg, 'error');
        }
      },
    });
  };

  // Filtered Events
  const filteredEvents = events.filter((ev) => {
    const matchesSearch =
      !searchQuery.trim() ||
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat =
      categoryFilter === 'all' ||
      ev.category?.toLowerCase() === categoryFilter.toLowerCase();

    return matchesSearch && matchesCat;
  });

  // Category counts for top stat cards
  const countFlagship = events.filter((e) => (e.category || '').toLowerCase() === 'flagship events').length;
  const countMain = events.filter((e) => (e.category || '').toLowerCase() === 'main events').length;
  const countFun = events.filter((e) => (e.category || '').toLowerCase() === 'fun events').length;
  const countDts = events.filter((e) => (e.category || '').toLowerCase() === 'dts events').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. TOP STAT CARDS (Matches the Registrations Tab aesthetic) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
        }}
      >
        {[
          { label: 'TOTAL EVENTS', value: events.length, color: '#ECE8DF' },
          { label: 'FLAGSHIP EVENTS', value: countFlagship, color: 'oklch(0.76 0.11 38)' },
          { label: 'MAIN EVENTS', value: countMain, color: 'oklch(0.77 0.09 295)' },
          { label: 'FUN EVENTS', value: countFun, color: 'oklch(0.8 0.08 178)' },
          { label: 'DTS EVENTS', value: countDts, color: 'oklch(0.84 0.12 85)' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              padding: '20px',
              background: 'rgba(236,232,223,0.03)',
              border: '1px solid rgba(236,232,223,0.1)',
              clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', color: 'rgba(236,232,223,0.6)' }}>
              {stat.label}
            </span>
            <div
              style={{
                marginTop: '8px',
                fontFamily: 'var(--font-cinzel), serif',
                fontWeight: 900,
                fontSize: '32px',
                lineHeight: 1,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 2. TOP BANNER & ACTION CONTROLS */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '20px 24px',
          background: 'rgba(236,232,223,0.02)',
          border: '1px solid rgba(236,232,223,0.1)',
          clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontFamily: 'var(--font-cinzel), serif',
                fontWeight: 900,
                fontSize: '20px',
                color: '#ECE8DF',
                letterSpacing: '.02em',
              }}
            >
              Event Missions Manifest
            </span>
            <span
              style={{
                padding: '3px 8px',
                background: 'rgba(220,183,106,0.12)',
                border: '1px solid rgba(220,183,106,0.3)',
                clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '.08em',
                color: 'oklch(0.8 0.12 85)',
              }}
            >
              {events.length} TOTAL
            </span>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(236,232,223,0.6)',
              letterSpacing: '.02em',
            }}
          >
            Manage fest events, upload .webp posters (≤ 1MB), details, and Google Drive brochures.
          </p>
        </div>

        <button
          id="upload-event-btn"
          type="button"
          onClick={() => {
            setUploadError('');
            setIsUploadModalOpen(true);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 24px',
            border: 0,
            background: 'oklch(0.8 0.12 85)',
            color: '#141312',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '.1em',
            cursor: 'pointer',
            clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
            boxShadow: '0 6px 20px rgba(201,162,74,0.3)',
            transition: 'transform .2s, filter .2s',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>UPLOAD NEW EVENT</span>
        </button>
      </div>

      {/* 3. FILTER & SEARCH BAR (Matches the registration filter bar) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '14px',
          padding: '16px 20px',
          background: 'rgba(236,232,223,0.02)',
          border: '1px solid rgba(236,232,223,0.08)',
          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', flex: 1 }}>
          {/* Search Box */}
          <input
            id="search-events-input"
            type="text"
            placeholder="Search event name or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '280px',
              height: '40px',
              padding: '0 14px',
              background: 'rgba(236,232,223,0.05)',
              border: '1px solid rgba(236,232,223,0.2)',
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
              color: '#ECE8DF',
              fontSize: '13px',
              outline: 'none',
            }}
          />

          {/* Category Filter */}
          <select
            id="filter-event-category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              height: '40px',
              padding: '0 14px',
              background: '#141312',
              border: '1px solid rgba(236,232,223,0.2)',
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
              color: '#ECE8DF',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Categories</option>
            {EVENT_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchEvents}
            style={{
              height: '40px',
              padding: '0 18px',
              background: 'rgba(236,232,223,0.1)',
              border: '1px solid rgba(236,232,223,0.2)',
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
              color: '#ECE8DF',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '.1em',
              cursor: 'pointer',
            }}
          >
            {loading ? 'REFRESHING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* 4. EVENTS GRID */}
      {loading && !events.length ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(236,232,223,0.6)' }}>
          Loading missions manifest...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'rgba(236,232,223,0.02)',
            border: '1px dashed rgba(236,232,223,0.14)',
            clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(236,232,223,0.4)" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <span style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(236,232,223,0.8)' }}>
            No events found matching your criteria.
          </span>
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            style={{
              marginTop: '8px',
              padding: '10px 22px',
              border: 0,
              background: 'oklch(0.8 0.12 85)',
              color: '#141312',
              fontWeight: 800,
              fontSize: '12px',
              letterSpacing: '.1em',
              cursor: 'pointer',
              clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
            }}
          >
            + UPLOAD FIRST EVENT
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '22px',
          }}
        >
          {filteredEvents.map((event) => (
            <article
              key={event.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(160deg, #1b1a18, #131211 85%)',
                border: '1px solid rgba(236,232,223,0.14)',
                clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                overflow: 'hidden',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                transition: 'border-color .3s, transform .3s',
              }}
            >
              {/* Poster Thumbnail (Chamfered top edges) */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '16 / 10',
                  background: '#0d0c0b',
                  overflow: 'hidden',
                  clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={event.poster_url}
                  alt={event.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    cursor: 'pointer',
                    transition: 'transform .5s ease',
                  }}
                  onClick={() =>
                    setPreviewImage({ url: event.poster_url, title: `${event.title} · Poster` })
                  }
                />
                {(() => {
                  const catConfig = EVENT_CATEGORIES.find((c) => c.key === (event.category || '').toLowerCase()) || {
                    label: (event.category || 'EVENT').toUpperCase(),
                    badgeBg: 'rgba(20,19,18,0.85)',
                    badgeColor: 'oklch(0.8 0.12 85)',
                    border: 'rgba(236,232,223,0.2)',
                  };
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '12px',
                        padding: '4px 10px',
                        background: catConfig.badgeBg,
                        backdropFilter: 'blur(6px)',
                        border: `1px solid ${catConfig.border}`,
                        clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                        fontSize: '11px',
                        fontWeight: 800,
                        letterSpacing: '.1em',
                        color: catConfig.badgeColor,
                        textTransform: 'uppercase',
                      }}
                    >
                      {catConfig.label}
                    </div>
                  );
                })()}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '10px',
                    padding: '3px 8px',
                    background: 'rgba(0,0,0,0.75)',
                    border: '1px solid rgba(236,232,223,0.15)',
                    clipPath: 'polygon(3px 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%, 0 3px)',
                    fontSize: '10px',
                    letterSpacing: '.1em',
                    color: 'rgba(236,232,223,0.8)',
                  }}
                >
                  WEBP POSTER
                </div>
              </div>

              {/* Event Details Content */}
              <div
                style={{
                  padding: '18px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: 'var(--font-cinzel), serif',
                      fontWeight: 800,
                      fontSize: '18px',
                      color: '#ECE8DF',
                      lineHeight: '1.2',
                    }}
                  >
                    {event.title}
                  </h3>
                </div>

                {/* Description */}
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: 'rgba(236,232,223,0.75)',
                    lineHeight: '1.6',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {event.description}
                </p>



                {/* Optional Google Drive Brochure Link */}
                {event.brochure_url && (
                  <div style={{ paddingTop: '4px' }}>
                    <a
                      href={event.brochure_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        width: '100%',
                        justifyContent: 'center',
                        background: 'rgba(37,99,235,0.12)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                        color: '#60a5fa',
                        fontSize: '12px',
                        fontWeight: 700,
                        letterSpacing: '.06em',
                        textDecoration: 'none',
                        transition: 'background .2s',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <span>OPEN BROCHURE (GOOGLE DRIVE) ↗</span>
                    </a>
                  </div>
                )}

                {/* Card Action Buttons: Edit & Delete */}
                <div
                  style={{
                    display: 'flex',
                    gap: '10px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(236,232,223,0.1)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openEditModal(event)}
                    style={{
                      flex: 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      padding: '9px 14px',
                      background: 'rgba(236,232,223,0.06)',
                      border: '1px solid rgba(236,232,223,0.22)',
                      clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                      color: '#ECE8DF',
                      fontSize: '12px',
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    <span>EDIT DETAILS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteEvent(event)}
                    style={{
                      padding: '9px 14px',
                      background: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.3)',
                      clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                      color: '#f87171',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Delete event"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ===================== UPLOAD EVENT MODAL ===================== */}
      {isUploadModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            background: 'rgba(7,6,5,0.88)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#131210',
              border: '1px solid rgba(236,232,223,0.22)',
              clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
              padding: 'clamp(20px, 3vw, 32px)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(236,232,223,0.12)',
                marginBottom: '20px',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-cinzel), serif',
                    fontWeight: 900,
                    fontSize: '22px',
                    color: '#ECE8DF',
                  }}
                >
                  Upload Fest Event
                </h2>
                <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.5)', letterSpacing: '.04em' }}>
                  Poster strictly .webp (max 1MB) · Google Drive brochure optional
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'rgba(236,232,223,0.6)',
                  fontSize: '20px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div
                style={{
                  padding: '12px 16px',
                  marginBottom: '16px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #ef4444',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  color: '#fca5a5',
                  fontSize: '13px',
                }}
              >
                ⚠️ {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Event Poster File Upload Zone (.webp & <= 1MB) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.1em',
                    color: 'oklch(0.8 0.12 85)',
                  }}
                >
                  EVENT POSTER (.WEBP ONLY · MAX 1MB) *
                </label>
                <input
                  ref={uploadFileInputRef}
                  type="file"
                  accept=".webp,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    validateAndSetPoster(f, false);
                  }}
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => uploadFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed rgba(236,232,223,0.25)',
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                    padding: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: uploadPosterPreview ? 'rgba(0,0,0,0.4)' : 'rgba(236,232,223,0.03)',
                    transition: 'border-color .2s',
                  }}
                >
                  {uploadPosterPreview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uploadPosterPreview}
                        alt="Poster Preview"
                        style={{
                          maxHeight: '160px',
                          maxWidth: '100%',
                          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                          objectFit: 'contain',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'oklch(0.8 0.12 85)', fontWeight: 700 }}>
                          ✓ {uploadPosterFile?.name} ({(uploadPosterFile ? uploadPosterFile.size / 1024 : 0).toFixed(0)} KB)
                        </span>
                        <span style={{ fontSize: '11px', color: 'rgba(236,232,223,0.5)' }}>
                          · Click to change
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="oklch(0.8 0.12 85)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#ECE8DF' }}>
                        Choose or drop event poster
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.5)' }}>
                        Allowed format: <strong>.webp</strong> · Max size: <strong>1MB</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Event Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#ECE8DF',
                  }}
                >
                  EVENT NAME *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robo Wars Championship, Hackathon 2026..."
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(236,232,223,0.06)',
                    border: '1px solid rgba(236,232,223,0.18)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Event Details (Description) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#ECE8DF',
                  }}
                >
                  EVENT DETAILS / DESCRIPTION *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Comprehensive event details, guidelines, rules, round breakdown, prize pool, team size, etc..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(236,232,223,0.06)',
                    border: '1px solid rgba(236,232,223,0.18)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Event Brochure Google Drive Link */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#ECE8DF',
                  }}
                >
                  EVENT BROCHURE (OPTIONAL · GOOGLE DRIVE LINK)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/... or https://docs.google.com/..."
                  value={uploadBrochureUrl}
                  onChange={(e) => setUploadBrochureUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(236,232,223,0.06)',
                    border:
                      uploadBrochureUrl && isValidGoogleDriveUrl(uploadBrochureUrl)
                        ? '1px solid #10b981'
                        : uploadBrochureUrl
                        ? '1px solid #f59e0b'
                        : '1px solid rgba(236,232,223,0.18)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                {uploadBrochureUrl && (
                  <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600 }}>
                    {isValidGoogleDriveUrl(uploadBrochureUrl) ? (
                      <span style={{ color: '#10b981' }}>✓ Valid Google Drive link verified</span>
                    ) : (
                      <span style={{ color: '#f59e0b' }}>
                        ⚠️ Must be a valid Google Drive URL (drive.google.com or docs.google.com)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Event Category */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', color: 'rgba(236,232,223,0.7)' }}>
                  EVENT CATEGORY
                </label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: '#1b1a18',
                    border: '1px solid rgba(236,232,223,0.22)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(236,232,223,0.1)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploadSubmitting}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid rgba(236,232,223,0.2)',
                    background: 'transparent',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={uploadSubmitting}
                  style={{
                    padding: '10px 24px',
                    border: 0,
                    background: uploadSubmitting ? 'rgba(201,162,74,0.5)' : 'oklch(0.8 0.12 85)',
                    color: '#141312',
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '.08em',
                    cursor: uploadSubmitting ? 'not-allowed' : 'pointer',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  }}
                >
                  {uploadSubmitting ? 'UPLOADING TO IMAGEKIT...' : 'PUBLISH EVENT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== EDIT EVENT DETAILS MODAL ===================== */}
      {isEditModalOpen && editingEvent && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            background: 'rgba(7,6,5,0.88)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#131210',
              border: '1px solid rgba(236,232,223,0.22)',
              clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
              padding: 'clamp(20px, 3vw, 32px)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingBottom: '16px',
                borderBottom: '1px solid rgba(236,232,223,0.12)',
                marginBottom: '20px',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-cinzel), serif',
                    fontWeight: 900,
                    fontSize: '22px',
                    color: '#ECE8DF',
                  }}
                >
                  Edit Event Details
                </h2>
                <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.5)', letterSpacing: '.04em' }}>
                  Updating details for: <strong>{editingEvent.title}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'rgba(236,232,223,0.6)',
                  fontSize: '20px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {editError && (
              <div
                style={{
                  padding: '12px 16px',
                  marginBottom: '16px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid #ef4444',
                  clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  color: '#fca5a5',
                  fontSize: '13px',
                }}
              >
                ⚠️ {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Optional Poster Update (.webp only, <= 1MB) */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.1em',
                    color: 'oklch(0.8 0.12 85)',
                  }}
                >
                  EVENT POSTER (OPTIONAL UPDATE · .WEBP ONLY · MAX 1MB)
                </label>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept=".webp,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    validateAndSetPoster(f, true);
                  }}
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => editFileInputRef.current?.click()}
                  style={{
                    border: '2px dashed rgba(236,232,223,0.25)',
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                    padding: '18px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: 'rgba(236,232,223,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editPosterPreview || editingEvent.poster_url}
                      alt="Current Poster"
                      style={{
                        height: '70px',
                        width: 'auto',
                        clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                        objectFit: 'contain',
                        border: '1px solid rgba(236,232,223,0.2)',
                      }}
                    />
                    <div style={{ textAlign: 'left' }}>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#ECE8DF' }}>
                        {editPosterFile ? `New: ${editPosterFile.name}` : 'Using current poster'}
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.5)' }}>
                        Click to select new .webp poster (max 1MB)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Name */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#ECE8DF',
                  }}
                >
                  EVENT NAME *
                </label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(236,232,223,0.06)',
                    border: '1px solid rgba(236,232,223,0.18)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Event Details */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#ECE8DF',
                  }}
                >
                  EVENT DETAILS / DESCRIPTION *
                </label>
                <textarea
                  required
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(236,232,223,0.06)',
                    border: '1px solid rgba(236,232,223,0.18)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Event Brochure Google Drive Link */}
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    color: '#ECE8DF',
                  }}
                >
                  EVENT BROCHURE (OPTIONAL · GOOGLE DRIVE LINK)
                </label>
                <input
                  type="url"
                  value={editBrochureUrl}
                  onChange={(e) => setEditBrochureUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'rgba(236,232,223,0.06)',
                    border:
                      editBrochureUrl && isValidGoogleDriveUrl(editBrochureUrl)
                        ? '1px solid #10b981'
                        : editBrochureUrl
                        ? '1px solid #f59e0b'
                        : '1px solid rgba(236,232,223,0.18)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
                {editBrochureUrl && (
                  <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 600 }}>
                    {isValidGoogleDriveUrl(editBrochureUrl) ? (
                      <span style={{ color: '#10b981' }}>✓ Valid Google Drive link verified</span>
                    ) : (
                      <span style={{ color: '#f59e0b' }}>
                        ⚠️ Must be a valid Google Drive URL (drive.google.com or docs.google.com)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Event Category */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '11px', fontWeight: 700, letterSpacing: '.08em', color: 'rgba(236,232,223,0.7)' }}>
                  EVENT CATEGORY
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    background: '#1b1a18',
                    border: '1px solid rgba(236,232,223,0.22)',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat.key} value={cat.key}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Buttons */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(236,232,223,0.1)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={editSubmitting}
                  style={{
                    padding: '10px 20px',
                    border: '1px solid rgba(236,232,223,0.2)',
                    background: 'transparent',
                    color: '#ECE8DF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  style={{
                    padding: '10px 24px',
                    border: 0,
                    background: editSubmitting ? 'rgba(201,162,74,0.5)' : 'oklch(0.8 0.12 85)',
                    color: '#141312',
                    fontSize: '13px',
                    fontWeight: 800,
                    letterSpacing: '.08em',
                    cursor: editSubmitting ? 'not-allowed' : 'pointer',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  }}
                >
                  {editSubmitting ? 'SAVING CHANGES...' : 'SAVE EVENT CHANGES'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
