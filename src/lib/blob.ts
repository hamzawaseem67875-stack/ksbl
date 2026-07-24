/**
 * lib/blob.ts
 *
 * Handles product image uploads.
 *
 * If `BLOB_READ_WRITE_TOKEN` is set, uploads to Vercel Blob.
 * If empty, falls back to Supabase Storage using the configured environment variables:
 *   - SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - SUPABASE_STORAGE_BUCKET
 */

import { put } from "@vercel/blob";

export async function uploadImage(
  filename: string,
  imageFile: File | Blob
): Promise<string> {
  const vercelToken = process.env.BLOB_READ_WRITE_TOKEN;

  // ── Route 1: Vercel Blob ──────────────────────────────────────────────────
  if (vercelToken) {
    console.log("[Blob] Uploading to Vercel Blob...");
    const blob = await put(filename, imageFile, {
      access: "public",
      contentType: "image/jpeg",
      token: vercelToken,
    });
    return blob.url;
  }

  // ── Route 2: Supabase Storage Fallback ────────────────────────────────────
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "scans";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing storage configuration: neither Vercel Blob nor Supabase credentials are set."
    );
  }

  console.log(`[Blob] Uploading to Supabase Storage bucket: ${bucketName}...`);

  // Target endpoint for Supabase Storage object upload
  const cleanUrl = supabaseUrl.replace(/\/$/, "");
  const uploadUrl = `${cleanUrl}/storage/v1/object/${bucketName}/${filename}`;

  // Call Supabase Storage API directly via lightweight fetch
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": imageFile.type || "image/jpeg",
      "x-upsert": "true",
    },
    body: imageFile,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase Storage upload failed (${response.status}): ${errorText}`);
  }

  // Return public URL
  // Format: https://{project-ref}.supabase.co/storage/v1/object/public/{bucket}/{filepath}
  return `${cleanUrl}/storage/v1/object/public/${bucketName}/${filename}`;
}
