'use client';
/* eslint-disable @next/next/no-img-element */

// =============================================================================
// ImageUploader — Drag-and-Drop Image Upload Component for Admin Panel
// Supports: drag-drop, file picker, multiple files, progress bars, reorder, delete
// =============================================================================

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, X, Trash2, GripVertical, Star, Loader2,
  ImageIcon, CheckCircle2, AlertCircle,
} from 'lucide-react';

export interface UploadedImage {
  id: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  position: number;
  /** Storage path in Supabase (for deletion) */
  storagePath?: string;
}

interface UploadingFile {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  /** Supabase storage bucket */
  bucket?: string;
  /** Folder within bucket (e.g. 'products' or 'categories') */
  folder?: string;
  /** Entity ID for organizing files */
  entityId?: string;
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Maximum file size in MB */
  maxSizeMB?: number;
}

export default function ImageUploader({
  images,
  onChange,
  bucket = 'product-images',
  folder = 'products',
  entityId = 'temp',
  maxImages = 10,
  maxSizeMB = 5,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalImages = images.length + uploading.filter((u) => u.status === 'uploading').length;

  // ---- Upload Logic ----
  const uploadFiles = useCallback(
    async (filesToUpload: File[]) => {
      const remaining = maxImages - images.length;
      const batch = filesToUpload.slice(0, remaining);

      if (batch.length === 0) return;

      // Create upload entries with local previews
      const newUploading: UploadingFile[] = batch.map((file) => ({
        id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'uploading' as const,
      }));

      setUploading((prev) => [...prev, ...newUploading]);

      // Upload each file
      let currentImages = [...images];
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      for (const entry of newUploading) {
        if (entry.file.size > maxSizeBytes) {
          setUploading((prev) =>
            prev.map((u) =>
              u.id === entry.id
                ? {
                    ...u,
                    status: "error",
                    error: `File exceeds the maximum ${maxSizeMB}MB upload limit.`,
                  }
                : u
            )
          );
          continue;
        }

        try {
          const formData = new FormData();
          formData.append('files', entry.file);
          formData.append('bucket', bucket);
          formData.append('folder', folder);
          formData.append('entityId', entityId);

          // Simulate progress (since fetch doesn't natively support upload progress)
          const progressInterval = setInterval(() => {
            setUploading((prev) =>
              prev.map((u) =>
                u.id === entry.id && u.progress < 85
                  ? { ...u, progress: u.progress + Math.random() * 15 }
                  : u
              )
            );
          }, 200);

          const res = await fetch('/api/admin/upload', {
            method: 'POST',
            body: formData,
          });

          clearInterval(progressInterval);

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `Upload failed (${res.status})`);
          }

          const data = await res.json();
          const result = data.results?.[0];

          if (!result?.success) {
            throw new Error(result?.error || 'Upload failed');
          }

          // Mark upload as done
          setUploading((prev) =>
            prev.map((u) =>
              u.id === entry.id ? { ...u, progress: 100, status: 'done' } : u
            )
          );

          // Add to images array
          const newImage: UploadedImage = {
            id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            url: result.url,
            altText: entry.file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '),
            isPrimary: currentImages.length === 0,
            position: currentImages.length,
            storagePath: result.path,
          };

          currentImages = [...currentImages, newImage];
          onChange(currentImages);

          // Remove from uploading state after brief delay (so user sees success state)
          setTimeout(() => {
            setUploading((prev) => prev.filter((u) => u.id !== entry.id));
            URL.revokeObjectURL(entry.preview);
          }, 800);
        } catch (err: any) {
          setUploading((prev) =>
            prev.map((u) =>
              u.id === entry.id
                ? { ...u, status: 'error', error: err.message, progress: 0 }
                : u
            )
          );
        }
      }
    },
    [images, onChange, bucket, folder, entityId, maxImages, maxSizeMB]
  );

  // ---- File Selection ----
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) uploadFiles(files);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [uploadFiles]
  );

  // ---- Drag & Drop Zone ----
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (files.length > 0) uploadFiles(files);
    },
    [uploadFiles]
  );

  // ---- Image Actions ----
  const removeImage = useCallback(
    async (index: number) => {
      const img = images[index];
      const newImages = images.filter((_, i) => i !== index);

      // If we removed the primary, set the first remaining as primary
      if (img.isPrimary && newImages.length > 0) {
        newImages[0] = { ...newImages[0], isPrimary: true };
      }

      // Reindex positions
      const reindexed = newImages.map((im, i) => ({ ...im, position: i }));
      onChange(reindexed);

      // Delete from storage and DB in background (non-blocking)
      if (img.url || img.storagePath) {
        fetch('/api/admin/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket,
            path: img.storagePath || undefined,
            url: img.url || undefined,
          }),
        }).catch(() => {});
      }
    },

    [images, onChange, bucket]
  );

  const setPrimary = useCallback(
    (index: number) => {
      const updated = images.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      }));
      onChange(updated);
    },
    [images, onChange]
  );

  const removeUploadingEntry = useCallback((id: string) => {
    setUploading((prev) => {
      const entry = prev.find((u) => u.id === id);
      if (entry) URL.revokeObjectURL(entry.preview);
      return prev.filter((u) => u.id !== id);
    });
  }, []);

  // ---- Drag Reorder Logic ----
  const handleImageDragStart = useCallback((index: number) => {
    setDragSourceIndex(index);
  }, []);

  const handleImageDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleImageDrop = useCallback(
    (targetIndex: number) => {
      if (dragSourceIndex === null || dragSourceIndex === targetIndex) {
        setDragSourceIndex(null);
        setDragOverIndex(null);
        return;
      }

      const reordered = [...images];
      const [moved] = reordered.splice(dragSourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const reindexed = reordered.map((img, i) => ({ ...img, position: i }));
      onChange(reindexed);

      setDragSourceIndex(null);
      setDragOverIndex(null);
    },
    [images, dragSourceIndex, onChange]
  );

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-[#F5A623] bg-amber-50/40 scale-[1.01]'
            : 'border-[#E5E7EB] bg-slate-50/50 hover:border-[#F5A623] hover:bg-amber-50/20'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <div className={`transition-transform ${isDragging ? 'scale-110' : ''}`}>
          <Upload
            size={28}
            className={`mx-auto mb-2.5 ${isDragging ? 'text-[#F5A623]' : 'text-slate-400'}`}
          />
          <p className="text-xs font-semibold text-slate-800">
            {isDragging ? 'Drop images here' : 'Drag & drop images or click to browse'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            PNG, JPG, WebP, GIF, AVIF • Max {maxSizeMB} MB per file • {totalImages}/{maxImages} images
          </p>
        </div>
      </div>

      {/* Uploading Progress */}
      {uploading.length > 0 && (
        <div className="space-y-2">
          {uploading.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-[#E5E7EB] shadow-2xs"
            >
              {/* Thumbnail Preview */}
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-[#E5E7EB]">
                <img
                  src={entry.preview}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>

              {/* File Info & Progress */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{entry.file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  {entry.status === 'uploading' && (
                    <>
                      <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#F5A623] rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(entry.progress, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {Math.round(entry.progress)}%
                      </span>
                    </>
                  )}
                  {entry.status === 'done' && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                      <CheckCircle2 size={12} /> Uploaded
                    </span>
                  )}
                  {entry.status === 'error' && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-rose-600">
                      <AlertCircle size={12} /> {entry.error || 'Failed'}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              {entry.status === 'uploading' && (
                <Loader2 size={14} className="text-[#F5A623] animate-spin shrink-0" />
              )}
              {entry.status === 'error' && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUploadingEntry(entry.id);
                      uploadFiles([entry.file]);
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-semibold text-[#F5A623] hover:bg-amber-50 transition-colors"
                  >
                    Retry
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeUploadingEntry(entry.id);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Images Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img, idx) => (
            <div
              key={img.id}
              draggable
              onDragStart={() => handleImageDragStart(idx)}
              onDragOver={(e) => handleImageDragOver(e, idx)}
              onDrop={() => handleImageDrop(idx)}
              onDragEnd={() => {
                setDragSourceIndex(null);
                setDragOverIndex(null);
              }}
              className={`
                relative rounded-xl border overflow-hidden aspect-square bg-slate-50
                transition-all duration-200 group shadow-2xs
                ${img.isPrimary ? 'border-[#F5A623] ring-2 ring-[#F5A623]/20' : 'border-[#E5E7EB] hover:border-slate-300'}
                ${dragSourceIndex === idx ? 'opacity-40 scale-95' : ''}
                ${dragOverIndex === idx && dragSourceIndex !== idx ? 'border-[#F5A623] ring-2 ring-[#F5A623]/30 scale-105' : ''}
              `}
            >
              {/* Image */}
              {img.url ? (
                <img
                  src={img.url}
                  alt={img.altText || ''}
                  className="absolute inset-0 w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                  <ImageIcon size={24} />
                </div>
              )}

              {/* Top-left: Drag handle + Primary badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1 z-10">
                <div className="p-1 rounded-md bg-black/60 backdrop-blur-sm cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={12} className="text-white" />
                </div>
                {img.isPrimary && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#F5A623] text-black shadow-xs">
                    PRIMARY
                  </span>
                )}
              </div>

              {/* Top-right: Actions */}
              <div className="absolute top-2 right-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                {!img.isPrimary && (
                  <button
                    onClick={() => setPrimary(idx)}
                    title="Set as primary image"
                    className="p-1 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-[#F5A623] transition-colors"
                  >
                    <Star size={12} />
                  </button>
                )}
                <button
                  onClick={() => removeImage(idx)}
                  title="Remove image"
                  className="p-1 rounded-md bg-black/60 backdrop-blur-sm text-white/80 hover:text-rose-400 transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Bottom: File info overlay */}
              <div className="absolute bottom-0 left-0 right-0 px-2.5 py-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[11px] text-white font-medium truncate">{img.altText || 'Product Image'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {images.length === 0 && uploading.length === 0 && (
        <p className="text-center text-xs text-slate-500 py-2">
          No images uploaded yet. Add images to make your product stand out!
        </p>
      )}
    </div>
  );
}
