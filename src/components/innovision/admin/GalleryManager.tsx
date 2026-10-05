'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, GalleryItem } from '@/lib/supabase';

interface GalleryManagerProps {
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

const MAX_GALLERY_SIZE = 2 * 1024 * 1024; // 2MB strictly enforced

export default function GalleryManager({
  getAuthToken,
  showToast,
  setConfirmModal,
  setPreviewImage,
}: GalleryManagerProps) {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Title State
  const [editingPhoto, setEditingPhoto] = useState<GalleryItem | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [isEditTitleModalOpen, setIsEditTitleModalOpen] = useState(false);
  const [editTitleSubmitting, setEditTitleSubmitting] = useState(false);

  // Fetch Gallery Items (Manual refresh or after actions)
  const fetchGallery = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/gallery', {
        headers,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch gallery images');
      setGallery(data.gallery || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error fetching gallery';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [getAuthToken, showToast]);

  // Initial Load on mount
  useEffect(() => {
    let isMounted = true;
    const loadInitialGallery = async () => {
      try {
        const token = await getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/admin/gallery', {
          headers,
          credentials: 'include',
        });
        const data = await res.json();
        if (!isMounted) return;
        if (!res.ok) throw new Error(data.error || 'Failed to fetch gallery images');
        setGallery(data.gallery || []);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Error fetching gallery';
        showToast(msg, 'error');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadInitialGallery();
    return () => {
      isMounted = false;
    };
  }, [getAuthToken, showToast]);

  // Validate File (.webp only, <= 2MB)
  const validateAndSetFile = (file: File | null) => {
    setUploadError('');
    if (!file) {
      setUploadFile(null);
      setUploadPreview(null);
      return;
    }

    // 1. Strict extension and MIME check
    const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
    if (!isWebp) {
      setUploadError('Invalid format! Gallery photos must strictly be .webp format.');
      setUploadFile(null);
      setUploadPreview(null);
      return;
    }

    // 2. Strict size check: max 2MB
    if (file.size > MAX_GALLERY_SIZE) {
      const currentMb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadError(`File too large! Gallery image must not exceed 2MB. Selected size: ${currentMb}MB.`);
      setUploadFile(null);
      setUploadPreview(null);
      return;
    }

    setUploadFile(file);
    const objectUrl = URL.createObjectURL(file);
    setUploadPreview(objectUrl);
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');

    if (!uploadFile) {
      setUploadError('Please select a .webp image file to upload.');
      return;
    }

    try {
      setUploadSubmitting(true);
      const token = await getAuthToken();

      const formData = new FormData();
      formData.append('file', uploadFile);
      if (uploadTitle.trim()) {
        formData.append('title', uploadTitle.trim());
      }

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/gallery', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload gallery image');

      showToast('Image uploaded to gallery successfully!', 'success');
      setUploadFile(null);
      setUploadPreview(null);
      setUploadTitle('');
      setIsUploadModalOpen(false);
      fetchGallery();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      showToast(msg, 'error');
    } finally {
      setUploadSubmitting(false);
    }
  };

  // Open Edit Title Modal
  const openEditTitle = (photo: GalleryItem) => {
    setEditingPhoto(photo);
    setNewTitle(photo.title || '');
    setIsEditTitleModalOpen(true);
  };

  // Submit Title Update
  const handleEditTitleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPhoto?.id) return;

    try {
      setEditTitleSubmitting(true);
      const token = await getAuthToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/admin/gallery', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          id: editingPhoto.id,
          title: newTitle.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update photo title');

      showToast('Gallery image title updated!', 'success');
      setIsEditTitleModalOpen(false);
      setEditingPhoto(null);
      fetchGallery();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      showToast(msg, 'error');
    } finally {
      setEditTitleSubmitting(false);
    }
  };

  // Handle Delete Photo
  const handleDeletePhoto = (photo: GalleryItem) => {
    if (!photo.id) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Gallery Image',
      message: `Are you sure you want to delete this image (${photo.title || 'Untitled memory'}) from the festival gallery?`,
      actionText: 'DELETE IMAGE',
      actionType: 'reject',
      onConfirm: async () => {
        try {
          const token = await getAuthToken();
          const headers: Record<string, string> = {};
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch(`/api/admin/gallery?id=${photo.id}`, {
            method: 'DELETE',
            headers,
            credentials: 'include',
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete photo');

          showToast('Image deleted from gallery.', 'info');
          setGallery((prev) => prev.filter((p) => p.id !== photo.id));
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Delete failed';
          showToast(msg, 'error');
        }
      },
    });
  };

  // Filtered gallery
  const filteredGallery = gallery.filter((item) => {
    if (!searchQuery.trim()) return true;
    return item.title?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const titledCount = gallery.filter((p) => !!p.title?.trim()).length;
  const untitledCount = gallery.length - titledCount;

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
          { label: 'TOTAL PHOTOS', value: gallery.length, color: '#ECE8DF' },
          { label: 'TITLED MEMORIES', value: titledCount, color: 'oklch(0.8 0.12 85)' },
          { label: 'UNTITLED PHOTOS', value: untitledCount, color: 'rgba(236,232,223,0.7)' },
          { label: 'MAX FILE SIZE', value: '2 MB', color: 'oklch(0.8 0.08 178)' },
          { label: 'ALLOWED FORMAT', value: '.WEBP', color: 'oklch(0.77 0.09 295)' },
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
              Cosmic Gallery Archive
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
              {gallery.length} PHOTOS
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
            Manage fest memories. Upload .webp images (≤ 2MB) with an optional caption or title.
          </p>
        </div>

        <button
          id="upload-gallery-btn"
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
          <span>UPLOAD IMAGE</span>
        </button>
      </div>

      {/* 3. SEARCH & REFRESH BAR */}
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
        <div style={{ position: 'relative', flex: 1, maxWidth: '380px' }}>
          <input
            id="search-gallery-input"
            type="text"
            placeholder="Search by photo title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
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
        </div>

        <button
          type="button"
          onClick={fetchGallery}
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

      {/* 4. GALLERY GRID */}
      {loading && !gallery.length ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(236,232,223,0.6)' }}>
          Loading cosmic gallery...
        </div>
      ) : filteredGallery.length === 0 ? (
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
            No gallery images found.
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
            + UPLOAD FIRST IMAGE
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredGallery.map((photo) => (
            <div
              key={photo.id}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(160deg, #1b1a18, #131211 85%)',
                border: '1px solid rgba(236,232,223,0.14)',
                clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                overflow: 'hidden',
                boxShadow: '0 16px 32px rgba(0,0,0,0.5)',
                transition: 'border-color .3s, transform .3s',
              }}
            >
              {/* Photo Display (Chamfered top corners matching card) */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '4 / 3',
                  background: '#0d0c0b',
                  overflow: 'hidden',
                  clipPath: 'polygon(12px 0, 100% 0, 100% 100%, 0 100%, 0 12px)',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setPreviewImage({
                    url: photo.image_url,
                    title: photo.title || 'Gallery Memory',
                  })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.image_url}
                  alt={photo.title || 'Gallery image'}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'transform .4s ease',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    padding: '2px 8px',
                    background: 'rgba(0,0,0,0.7)',
                    border: '1px solid rgba(236,232,223,0.15)',
                    clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                    fontSize: '10px',
                    letterSpacing: '.08em',
                    color: 'rgba(236,232,223,0.8)',
                  }}
                >
                  .WEBP
                </div>
              </div>

              {/* Title & Actions Bar */}
              <div
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 700,
                      color: photo.title ? '#ECE8DF' : 'rgba(236,232,223,0.4)',
                      fontStyle: photo.title ? 'normal' : 'italic',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '180px',
                    }}
                    title={photo.title || 'Untitled Memory'}
                  >
                    {photo.title || 'Untitled Memory'}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '6px',
                    borderTop: '1px solid rgba(236,232,223,0.08)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => openEditTitle(photo)}
                    style={{
                      background: 'rgba(236,232,223,0.08)',
                      border: '1px solid rgba(236,232,223,0.2)',
                      clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                      padding: '4px 10px',
                      color: 'oklch(0.8 0.12 85)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '.06em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>EDIT TITLE</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(photo)}
                    style={{
                      background: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.3)',
                      clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)',
                      padding: '4px 10px',
                      color: '#f87171',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Delete image"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================== UPLOAD GALLERY MODAL ===================== */}
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
              maxWidth: '540px',
              background: '#131210',
              border: '1px solid rgba(236,232,223,0.22)',
              clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
              padding: 'clamp(20px, 3vw, 28px)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
            }}
          >
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
                    fontSize: '20px',
                    color: '#ECE8DF',
                  }}
                >
                  Upload Gallery Image
                </h2>
                <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.5)' }}>
                  Format strictly .webp (max 2MB) · Optional title
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
              {/* File Dropzone */}
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
                  IMAGE FILE (.WEBP ONLY · MAX 2MB) *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".webp,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    validateAndSetFile(f);
                  }}
                  style={{ display: 'none' }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed rgba(236,232,223,0.25)',
                    clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)',
                    padding: '24px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    background: uploadPreview ? 'rgba(0,0,0,0.4)' : 'rgba(236,232,223,0.03)',
                  }}
                >
                  {uploadPreview ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uploadPreview}
                        alt="Gallery preview"
                        style={{
                          maxHeight: '160px',
                          maxWidth: '100%',
                          clipPath: 'polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)',
                          objectFit: 'contain',
                        }}
                      />
                      <span style={{ fontSize: '12px', color: 'oklch(0.8 0.12 85)', fontWeight: 700 }}>
                        ✓ {uploadFile?.name} ({(uploadFile ? uploadFile.size / 1024 : 0).toFixed(0)} KB)
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="oklch(0.8 0.12 85)" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="m21 15-5-5L5 21" />
                      </svg>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#ECE8DF' }}>
                        Click to select .webp image
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(236,232,223,0.5)' }}>
                        Maximum size: <strong>2MB</strong> · Allowed format: <strong>.webp</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Optional Title */}
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
                  IMAGE TITLE (OPTIONAL)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Robo Wars Finalists, Stargazing Night, Hackathon Arena..."
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

              {/* Action Buttons */}
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
                  {uploadSubmitting ? 'UPLOADING TO IMAGEKIT...' : 'ADD TO GALLERY'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== EDIT TITLE MODAL ===================== */}
      {isEditTitleModalOpen && editingPhoto && (
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
              maxWidth: '460px',
              background: '#131210',
              border: '1px solid rgba(236,232,223,0.22)',
              clipPath: 'polygon(16px 0, 100% 0, 100% calc(100% - 16px), calc(100% - 16px) 100%, 0 100%, 0 16px)',
              padding: '24px',
              boxShadow: '0 25px 60px rgba(0,0,0,0.85)',
            }}
          >
            <h3
              style={{
                margin: '0 0 16px',
                fontFamily: 'var(--font-cinzel), serif',
                fontWeight: 900,
                fontSize: '18px',
                color: '#ECE8DF',
              }}
            >
              Update Image Title
            </h3>

            <form onSubmit={handleEditTitleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                placeholder="Enter title (or leave blank for untitled)..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditTitleModalOpen(false)}
                  disabled={editTitleSubmitting}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid rgba(236,232,223,0.2)',
                    background: 'transparent',
                    color: '#ECE8DF',
                    fontSize: '12px',
                    fontWeight: 700,
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                    cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={editTitleSubmitting}
                  style={{
                    padding: '8px 20px',
                    border: 0,
                    background: 'oklch(0.8 0.12 85)',
                    color: '#141312',
                    fontSize: '12px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    clipPath: 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)',
                  }}
                >
                  {editTitleSubmitting ? 'SAVING...' : 'SAVE TITLE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
