// =============================================================================
// POST /api/admin/upload — Upload images to Supabase Storage
// Accepts multipart form data with one or more 'files' + optional 'folder' & 'entityId'
//
// DELETE /api/admin/upload — Delete an image from Supabase Storage
// Body: { bucket, path } or { bucket, url }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadFile,
  deleteFiles,
  verifyImageMagicBytes,
  generateServerFilename,
  generateFilePath,
  extractPathFromUrl,
  BUCKETS,
  PRODUCT_IMAGES_PREFIX,
  CATEGORY_IMAGES_PREFIX,
  ALLOWED_STORAGE_PREFIXES,
  type BucketName,
} from '@/lib/supabase/storage';
import { verifyAdminAccess } from '@/lib/admin/auth-check';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const formData = await request.formData();

    // Configuration from form fields
    const bucket = (formData.get('bucket') as string) || BUCKETS.PRODUCT_IMAGES;
    const folder = (formData.get('folder') as string) || 'products';
    const entityId = (formData.get('entityId') as string) || 'temp';

    // Validate bucket name
    const validBuckets = Object.values(BUCKETS);
    if (!validBuckets.includes(bucket as BucketName)) {
      return NextResponse.json(
        { error: `Invalid bucket: ${bucket}. Allowed: ${validBuckets.join(', ')}` },
        { status: 400 }
      );
    }

    // Collect all file entries
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided. Send files with field name "files".' },
        { status: 400 }
      );
    }

    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files per upload request.' },
        { status: 400 }
      );
    }

    // Process each file
    const results: Array<{
      success: boolean;
      url?: string;
      path?: string;
      filename: string;
      size: number;
      error?: string;
    }> = [];

    for (const file of files) {
      // 1. File size check (5 MB max)
      if (file.size > 5 * 1024 * 1024) {
        results.push({
          success: false,
          filename: file.name,
          size: file.size,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB. Max: 5 MB`,
        });
        continue;
      }

      try {
        // Read file into buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 2. Authoritative Magic Bytes verification (JPEG, PNG, WebP, GIF, AVIF)
        // Do NOT trust file.type provided by client
        const magic = verifyImageMagicBytes(buffer);
        if (!magic.valid || !magic.mimeType || !magic.extension) {
          results.push({
            success: false,
            filename: file.name,
            size: file.size,
            error: magic.error || 'Magic byte verification failed: unsupported image format.',
          });
          continue;
        }

        // 3. Generate filename strictly server-side (do NOT use client file.name)
        const serverFilename = generateServerFilename(magic.extension);
        const targetPrefix = bucket === BUCKETS.CATEGORY_IMAGES ? CATEGORY_IMAGES_PREFIX : PRODUCT_IMAGES_PREFIX;
        const filePath = generateFilePath(folder, entityId, serverFilename, targetPrefix);

        // 4. Upload to Supabase Storage with validated MIME type
        const { url, path: storagePath } = await uploadFile(
          bucket as BucketName,
          filePath,
          buffer,
          magic.mimeType
        );

        results.push({
          success: true,
          url,
          path: storagePath,
          filename: serverFilename,
          size: buffer.length,
        });
      } catch (err: any) {
        results.push({
          success: false,
          filename: file.name,
          size: file.size,
          error: err.message || 'Upload failed',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failedCount === 0,
      message: `${successCount} uploaded${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
      results,
    });
  } catch (err: any) {
    console.error('[Upload API] Unexpected error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdminAccess(request);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json().catch(() => ({}));
    const { bucket = BUCKETS.PRODUCT_IMAGES, path, url } = body;

    // Validate bucket name
    const validBuckets = Object.values(BUCKETS);
    if (!validBuckets.includes(bucket as BucketName)) {
      return NextResponse.json(
        { error: `Invalid bucket: ${bucket}. Allowed: ${validBuckets.join(', ')}` },
        { status: 400 }
      );
    }

    // Determine target file path
    let rawPath = typeof path === 'string' ? path.trim() : '';
    if (!rawPath && typeof url === 'string') {
      rawPath = (extractPathFromUrl(url, bucket as BucketName) || '').trim();
    }

    if (!rawPath) {
      return NextResponse.json(
        { error: 'Provide either a valid "path" or "url" to identify the file to delete.' },
        { status: 400 }
      );
    }

    // Security pre-check: Reject leading slashes, backslashes, path traversal, %2e
    if (rawPath.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid path: leading slashes are not allowed.' },
        { status: 400 }
      );
    }
    if (rawPath.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid path: backslashes are not allowed.' },
        { status: 400 }
      );
    }
    if (rawPath.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid path: path traversal is not allowed.' },
        { status: 400 }
      );
    }
    if (rawPath.toLowerCase().includes('%2e')) {
      return NextResponse.json(
        { error: 'Invalid path: encoded dots (%2e) are not allowed.' },
        { status: 400 }
      );
    }

    // Decode path once with decodeURIComponent before validation
    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(rawPath);
    } catch {
      return NextResponse.json(
        { error: 'Invalid path: failed to decode URL encoded characters.' },
        { status: 400 }
      );
    }

    // Post-decode security checks
    if (decodedPath.startsWith('/')) {
      return NextResponse.json(
        { error: 'Invalid path: leading slashes are not allowed.' },
        { status: 400 }
      );
    }
    if (decodedPath.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid path: backslashes are not allowed.' },
        { status: 400 }
      );
    }
    if (decodedPath.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid path: path traversal is not allowed.' },
        { status: 400 }
      );
    }
    if (decodedPath.toLowerCase().includes('%2e')) {
      return NextResponse.json(
        { error: 'Invalid path: encoded dots (%2e) are not allowed.' },
        { status: 400 }
      );
    }

    // Strictly enforce allowed prefix (with trailing slash)
    const matchedPrefix = ALLOWED_STORAGE_PREFIXES.find((prefix) =>
      decodedPath.startsWith(prefix)
    );

    if (!matchedPrefix) {
      return NextResponse.json(
        {
          error: `Invalid path: only paths starting with ${ALLOWED_STORAGE_PREFIXES.map((p) => `'${p}'`).join(' or ')} are permitted.`,
        },
        { status: 400 }
      );
    }

    // Candidate keys for bucket deletion: full prefixed path and relative key inside bucket
    const relativeKey = decodedPath.slice(matchedPrefix.length);

    const success = await deleteFiles(bucket as BucketName, [decodedPath, relativeKey]);

    return NextResponse.json({ success, path: decodedPath });
  } catch (err: any) {
    console.error('[Upload API DELETE] error:', err);
    return NextResponse.json(
      { error: err.message || 'Delete failed' },
      { status: 500 }
    );
  }
}
