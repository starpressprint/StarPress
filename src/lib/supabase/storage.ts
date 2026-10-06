// =============================================================================
// StarPress — Supabase Storage Helper (Server-Side Only)
// Handles file uploads, deletions, and public URL generation for product/category images.
// =============================================================================

import crypto from 'crypto';
import { getAdminClient } from './admin';

export const PRODUCT_IMAGES_PREFIX = 'product-images';
export const CATEGORY_IMAGES_PREFIX = 'category-images';
export const ALLOWED_STORAGE_PREFIXES = [
  `${PRODUCT_IMAGES_PREFIX}/`,
  `${CATEGORY_IMAGES_PREFIX}/`,
] as const;

// Bucket names — must match the buckets created in Supabase Dashboard
export const BUCKETS = {
  PRODUCT_IMAGES: 'product-images',
  CATEGORY_IMAGES: 'category-images',
} as const;

export type BucketName = typeof BUCKETS[keyof typeof BUCKETS];

/**
 * Upload a file buffer to Supabase Storage.
 * Returns the public URL on success.
 */
export async function uploadFile(
  bucket: BucketName,
  filePath: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ url: string; path: string }> {
  const supabase = getAdminClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true, // Overwrite if same path exists
      cacheControl: '31536000', // 1 year CDN cache
    });

  if (error) {
    console.error(`[Storage] Upload failed for ${bucket}/${filePath}:`, error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
  };
}

/**
 * Delete a file from Supabase Storage by its path within the bucket.
 */
export async function deleteFile(
  bucket: BucketName,
  filePath: string
): Promise<boolean> {
  const supabase = getAdminClient();

  const { error } = await supabase.storage
    .from(bucket)
    .remove([filePath]);

  if (error) {
    console.error(`[Storage] Delete failed for ${bucket}/${filePath}:`, error);
    return false;
  }

  return true;
}

/**
 * Delete multiple files from Supabase Storage.
 */
export async function deleteFiles(
  bucket: BucketName,
  filePaths: string[]
): Promise<boolean> {
  if (filePaths.length === 0) return true;

  const supabase = getAdminClient();

  const { error } = await supabase.storage
    .from(bucket)
    .remove(filePaths);

  if (error) {
    console.error(`[Storage] Bulk delete failed for ${bucket}:`, error);
    return false;
  }

  return true;
}

export type AllowedImageMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  | 'image/avif';

export interface MagicByteValidationResult {
  valid: boolean;
  mimeType?: AllowedImageMimeType;
  extension?: string;
  error?: string;
}

/**
 * Verify file buffer against authoritative magic bytes for JPEG, PNG, WebP, GIF, and AVIF.
 */
export function verifyImageMagicBytes(buffer: Buffer): MagicByteValidationResult {
  if (!buffer || buffer.length < 12) {
    return {
      valid: false,
      error: 'File payload is empty or too small to be a valid image.',
    };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png', extension: 'png' };
  }

  // 3. GIF: GIF87a or GIF89a
  if (
    buffer[0] === 0x47 && // G
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x38 && // 8
    (buffer[4] === 0x37 || buffer[4] === 0x39) && // 7 or 9
    buffer[5] === 0x61    // a
  ) {
    return { valid: true, mimeType: 'image/gif', extension: 'gif' };
  }

  // 4. WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && // R
    buffer[1] === 0x49 && // I
    buffer[2] === 0x46 && // F
    buffer[3] === 0x46 && // F
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50   // P
  ) {
    return { valid: true, mimeType: 'image/webp', extension: 'webp' };
  }

  // 5. AVIF: ftyp box (bytes 4-7) with brand 'avif' or 'avis'
  if (
    buffer[4] === 0x66 && // f
    buffer[5] === 0x74 && // t
    buffer[6] === 0x79 && // y
    buffer[7] === 0x70    // p
  ) {
    const brand = buffer.toString('ascii', 8, 12);
    if (brand === 'avif' || brand === 'avis') {
      return { valid: true, mimeType: 'image/avif', extension: 'avif' };
    }
    try {
      const ftypSize = buffer.readUInt32BE(0);
      const maxSearch = Math.min(buffer.length, ftypSize, 64);
      for (let i = 12; i + 4 <= maxSearch; i += 4) {
        const compBrand = buffer.toString('ascii', i, i + 4);
        if (compBrand === 'avif' || compBrand === 'avis') {
          return { valid: true, mimeType: 'image/avif', extension: 'avif' };
        }
      }
    } catch {}
  }

  return {
    valid: false,
    error: 'Magic byte inspection failed: file is not a valid JPEG, PNG, WebP, GIF, or AVIF image.',
  };
}

/**
 * Generate a random, cryptographically collision-resistant filename server-side.
 */
export function generateServerFilename(extension: string): string {
  const cleanExt = extension.replace(/^\./, '').toLowerCase();
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${timestamp}-${random}.${cleanExt}`;
}

/**
 * Extract the storage path from a full Supabase public URL.
 * e.g. "https://xxx.supabase.co/storage/v1/object/public/product-images/products/abc/img.webp"
 *   → "product-images/products/abc/img.webp"
 */
export function extractPathFromUrl(url: string, bucket: BucketName = BUCKETS.PRODUCT_IMAGES): string | null {
  try {
    const publicMarker = '/storage/v1/object/public/';
    const publicIdx = url.indexOf(publicMarker);
    if (publicIdx !== -1) {
      return url.substring(publicIdx + publicMarker.length);
    }
    const bucketMarker = `/${bucket}/`;
    const bucketIdx = url.indexOf(bucketMarker);
    if (bucketIdx !== -1) {
      return url.substring(bucketIdx + 1);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a unique file path for an uploaded image prefixed with the allowed prefix.
 */
export function generateFilePath(
  folder: string,
  entityId: string,
  filename: string,
  prefix: string = PRODUCT_IMAGES_PREFIX
): string {
  const cleanFolder = (folder || 'products').replace(/[^a-zA-Z0-9_-]/g, '') || 'products';
  const cleanEntityId = (entityId || 'general').replace(/[^a-zA-Z0-9_-]/g, '') || 'general';
  const cleanPrefix = prefix === CATEGORY_IMAGES_PREFIX ? CATEGORY_IMAGES_PREFIX : PRODUCT_IMAGES_PREFIX;
  return `${cleanPrefix}/${cleanFolder}/${cleanEntityId}/${filename}`;
}

/**
 * Validate an uploaded file for image requirements.
 */
export function validateImageFile(
  file: { size: number; type: string; name: string },
  maxSizeMB: number = 5
): { valid: boolean; error?: string } {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF, AVIF`,
    };
  }

  const maxBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max: ${maxSizeMB} MB`,
    };
  }

  return { valid: true };
}

