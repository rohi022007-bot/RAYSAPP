import { Message, StorageBreakdown } from '../types';

const STORAGE_KEY_USER = 'rays_auth_user';
const STORAGE_KEY_QUEUE = 'rays_offline_queue';
const STORAGE_KEY_SETTINGS = 'rays_local_settings';
const STORAGE_KEY_MEDIA_CACHE = 'rays_media_cache';

export interface UnsentQueueItem {
  id: string;
  conversationId: string;
  senderId: string;
  payload: any;
  queuedAt: number;
  retryCount: number;
}

export function saveCachedUser(user: any) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEY_USER);
  } else {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  }
}

export function getCachedUser(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getUnsentQueue(): UnsentQueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToUnsentQueue(item: UnsentQueueItem) {
  const current = getUnsentQueue();
  current.push(item);
  localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(current));
}

export function removeFromUnsentQueue(id: string) {
  const current = getUnsentQueue();
  const filtered = current.filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(filtered));
}

export function clearUnsentQueue() {
  localStorage.removeItem(STORAGE_KEY_QUEUE);
}

// Compute client storage breakdown for images, videos, files, voice notes
export function calculateStorageBreakdown(messages: Message[]): StorageBreakdown {
  const breakdown: StorageBreakdown = {
    images: { bytes: 0, count: 0 },
    videos: { bytes: 0, count: 0 },
    files: { bytes: 0, count: 0 },
    voice: { bytes: 0, count: 0 },
    totalBytes: 0,
  };

  messages.forEach((msg) => {
    if (msg.isDeleted || msg.isDeletedForEveryone) return;

    const size = msg.fileSize || (msg.fileUrl ? Math.round(msg.fileUrl.length * 0.75) : 0);

    if (msg.type === 'image') {
      breakdown.images.count += 1;
      breakdown.images.bytes += size || 450000;
    } else if (msg.type === 'video') {
      breakdown.videos.count += 1;
      breakdown.videos.bytes += size || 2500000;
    } else if (msg.type === 'voice') {
      breakdown.voice.count += 1;
      breakdown.voice.bytes += size || 85000;
    } else if (msg.type === 'file') {
      breakdown.files.count += 1;
      breakdown.files.bytes += size || 320000;
    }
  });

  breakdown.totalBytes =
    breakdown.images.bytes + breakdown.videos.bytes + breakdown.files.bytes + breakdown.voice.bytes;

  return breakdown;
}

export function clearLocalMediaCache(): void {
  // Clear local blob URLs and caches
  try {
    sessionStorage.clear();
    localStorage.removeItem(STORAGE_KEY_MEDIA_CACHE);
  } catch (err) {
    console.error('Error clearing local media cache', err);
  }
}

// Client-side image compression
export async function compressImage(file: File, maxDimension: number = 1600, quality: number = 0.82): Promise<{ base64: string; size: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({ base64: e.target?.result as string, size: file.size });
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        const approximateBytes = Math.round(compressedBase64.length * 0.75);

        resolve({ base64: compressedBase64, size: approximateBytes });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
