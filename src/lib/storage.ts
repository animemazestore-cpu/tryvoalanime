import { supabase } from './supabase';

export interface UploadOptions {
  bucket?: string;
  folder?: string;
  maxSizeBytes?: number;
}

const DEFAULT_BUCKET = 'product-images';
const DEFAULT_FOLDER = 'products';
const DEFAULT_MAX_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * Converts a File to a base64 Data URL (useful for local fallback or immediate preview)
 */
export const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

/**
 * Compresses an image file client-side to keep uploads fast and fallback URLs lightweight (< 50KB)
 */
export const compressImageIfNeeded = async (
  file: File,
  maxDimension = 900,
  quality = 0.82
): Promise<{ file: File; dataUrl: string }> => {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    const dataUrl = await fileToDataUrl(file);
    return { file, dataUrl };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
                  type: 'image/jpeg',
                });
                resolve({ file: compressedFile, dataUrl });
              } else {
                resolve({ file, dataUrl });
              }
            },
            'image/jpeg',
            quality
          );
        } else {
          resolve({ file, dataUrl: (e.target?.result as string) || '' });
        }
      };
      img.onerror = () => {
        resolve({ file, dataUrl: (e.target?.result as string) || '' });
      };
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => {
      fileToDataUrl(file).then((dataUrl) => resolve({ file, dataUrl }));
    };
    reader.readAsDataURL(file);
  });
};

/**
 * Uploads a single file to Supabase Storage bucket.
 * Returns public URL on success, or falls back to lightweight local data URL if bucket is unreachable.
 */
export const uploadFileToStorage = async (
  file: File,
  options?: UploadOptions
): Promise<{ url: string; error?: string; isFallback?: boolean }> => {
  const bucket = options?.bucket || DEFAULT_BUCKET;
  const folder = options?.folder || DEFAULT_FOLDER;
  const maxSize = options?.maxSizeBytes || DEFAULT_MAX_SIZE;

  // 1. File size check
  if (file.size > maxSize) {
    const sizeMb = Math.round(maxSize / (1024 * 1024));
    return {
      url: '',
      error: `File size exceeds the ${sizeMb}MB limit (${(file.size / (1024 * 1024)).toFixed(1)}MB).`,
    };
  }

  // 2. Compress image if needed for performance and small size
  let activeFile = file;
  let compressedDataUrl = '';
  if (file.type.startsWith('image/')) {
    try {
      const compressed = await compressImageIfNeeded(file);
      activeFile = compressed.file;
      compressedDataUrl = compressed.dataUrl;
    } catch {
      activeFile = file;
    }
  }

  // 3. Prepare clean path
  const ext = activeFile.name.split('.').pop()?.toLowerCase() || 'jpg';
  const cleanName = activeFile.name
    .substring(0, activeFile.name.lastIndexOf('.') || activeFile.name.length)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 40);
  const fileName = `${Date.now()}_${cleanName}.${ext}`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;

  try {
    // 4. Attempt Supabase upload
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, activeFile, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn(`Supabase Storage upload notice on bucket '${bucket}':`, uploadError.message);
      // If upload failed, use lightweight compressed data URL
      const fallbackUrl = compressedDataUrl || (await fileToDataUrl(activeFile));
      return {
        url: fallbackUrl,
        error: `Supabase Storage upload warning (${uploadError.message}). Using compressed preview fallback.`,
        isFallback: true,
      };
    }

    // 5. Retrieve public URL
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (publicData?.publicUrl) {
      return { url: publicData.publicUrl };
    }

    const fallbackUrl = compressedDataUrl || (await fileToDataUrl(activeFile));
    return { url: fallbackUrl, isFallback: true };
  } catch (err: any) {
    console.warn('Storage upload exception, falling back to compressed preview:', err);
    try {
      const fallbackUrl = compressedDataUrl || (await fileToDataUrl(activeFile));
      return {
        url: fallbackUrl,
        error: err?.message || 'Storage error. Using compressed preview.',
        isFallback: true,
      };
    } catch {
      return { url: '', error: 'Failed to process file.' };
    }
  }
};

/**
 * Uploads multiple files sequentially to Supabase Storage
 */
export const uploadMultipleFilesToStorage = async (
  files: File[],
  options?: UploadOptions
): Promise<{ urls: string[]; errors: string[] }> => {
  const urls: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = await uploadFileToStorage(file, options);
    if (result.url) {
      urls.push(result.url);
    }
    if (result.error) {
      errors.push(`${file.name}: ${result.error}`);
    }
  }

  return { urls, errors };
};

/**
 * Extracts bucket and path from a public Supabase Storage URL
 * e.g. https://xyz.supabase.co/storage/v1/object/public/product-images/products/main/123.jpg
 * returns { bucket: 'product-images', path: 'products/main/123.jpg' }
 */
export const extractStoragePathFromUrl = (url: string): { bucket: string; path: string } | null => {
  if (!url || typeof url !== 'string') return null;
  const marker = '/storage/v1/object/public/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const rest = url.substring(idx + marker.length);
  const slashIdx = rest.indexOf('/');
  if (slashIdx === -1) return null;
  const bucket = rest.substring(0, slashIdx);
  const path = rest.substring(slashIdx + 1);
  return { bucket, path };
};

/**
 * Deletes a single file from Supabase Storage by its public URL
 */
export const deleteFileFromStorage = async (url: string): Promise<boolean> => {
  const extracted = extractStoragePathFromUrl(url);
  if (!extracted) return false;
  try {
    const { error } = await supabase.storage
      .from(extracted.bucket)
      .remove([extracted.path]);
    if (error) {
      console.warn(`Failed to delete storage file ${extracted.path}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Exception deleting storage file:', err);
    return false;
  }
};

/**
 * Deletes all images belonging to a product (main image, gallery images, variant images)
 */
export const deleteProductImagesFromStorage = async (product: {
  main_image_url?: string | null;
  additional_images?: string[] | string | null;
  variants?: Array<{ image_url?: string | null }>;
}): Promise<void> => {
  const urlsToDelete: string[] = [];
  if (product.main_image_url) urlsToDelete.push(product.main_image_url);
  
  if (Array.isArray(product.additional_images)) {
    urlsToDelete.push(...product.additional_images);
  } else if (typeof product.additional_images === 'string' && product.additional_images) {
    urlsToDelete.push(...product.additional_images.split(',').map((s) => s.trim()).filter(Boolean));
  }

  if (Array.isArray(product.variants)) {
    for (const v of product.variants) {
      if (v.image_url) urlsToDelete.push(v.image_url);
    }
  }

  const pathsByBucket: Record<string, string[]> = {};
  for (const u of urlsToDelete) {
    const extracted = extractStoragePathFromUrl(u);
    if (extracted) {
      if (!pathsByBucket[extracted.bucket]) {
        pathsByBucket[extracted.bucket] = [];
      }
      if (!pathsByBucket[extracted.bucket].includes(extracted.path)) {
        pathsByBucket[extracted.bucket].push(extracted.path);
      }
    }
  }

  for (const [bucket, paths] of Object.entries(pathsByBucket)) {
    if (paths.length === 0) continue;
    try {
      const { data, error } = await supabase.storage.from(bucket).remove(paths);
      if (error) {
        console.warn(`Failed to remove images from bucket '${bucket}':`, error);
      } else {
        console.log(`Successfully removed ${paths.length} images from bucket '${bucket}':`, data);
      }
    } catch (err) {
      console.warn(`Exception removing files from bucket '${bucket}':`, err);
    }
  }
};
