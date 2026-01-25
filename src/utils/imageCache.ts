// src/utils/imageCache.ts
import RNFS from 'react-native-fs';
import { getDatabase } from '../database/schema';

const IMAGE_CACHE_DIR = `${RNFS.DocumentDirectoryPath}/images`;
const VENDOR_LOGO_DIR = `${RNFS.DocumentDirectoryPath}/images/vendors`;
const ITEM_IMAGE_DIR = `${RNFS.DocumentDirectoryPath}/images/items`;

// Ensure directories exist
const ensureDirectories = async (): Promise<void> => {
  try {
    await RNFS.mkdir(IMAGE_CACHE_DIR);
    await RNFS.mkdir(VENDOR_LOGO_DIR);
    await RNFS.mkdir(ITEM_IMAGE_DIR);
  } catch (error) {
    // Directories might already exist, ignore error
    console.log('Image cache directories ready');
  }
};

// Download and cache image from URL
const downloadImage = async (
  url: string,
  localPath: string
): Promise<string> => {
  try {
    await ensureDirectories();
    
    const downloadResult = await RNFS.downloadFile({
      fromUrl: url,
      toFile: localPath,
    }).promise;
    
    if (downloadResult.statusCode === 200) {
      return localPath;
    } else {
      throw new Error(`Download failed with status ${downloadResult.statusCode}`);
    }
  } catch (error) {
    console.error('Failed to download image:', error);
    throw error;
  }
};

// Cache vendor logo
export const cacheVendorLogo = async (
  vendorId: string,
  logoUrl: string
): Promise<string> => {
  try {
    const filename = `logo_${vendorId}.jpg`;
    const localPath = `${VENDOR_LOGO_DIR}/${filename}`;
    
    // Download image
    await downloadImage(logoUrl, localPath);
    
    // Save to database
    const db = getDatabase();
    const now = new Date().toISOString();
    
    // Check if cache entry exists
    const existing = db.execute(
      'SELECT id FROM image_cache WHERE entity_type = ? AND entity_id = ?',
      ['vendor', vendorId]
    );
    
    if (existing.rows?._array?.length > 0) {
      // Update existing
      db.execute(
        `UPDATE image_cache SET
          remote_url = ?, local_path = ?, cached_at = ?, expires_at = ?
        WHERE entity_type = ? AND entity_id = ?`,
        [
          logoUrl,
          localPath,
          now,
          null, // Pre-signed URLs expire, but we cache indefinitely
          'vendor',
          vendorId,
        ]
      );
    } else {
      // Insert new
      db.execute(
        `INSERT INTO image_cache (
          entity_type, entity_id, remote_url, local_path, cached_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        ['vendor', vendorId, logoUrl, localPath, now, null]
      );
    }
    
    console.log(`Vendor logo cached: ${localPath}`);
    return localPath;
  } catch (error) {
    console.error('Failed to cache vendor logo:', error);
    throw error;
  }
};

// Cache item image
export const cacheItemImage = async (
  itemId: string,
  imageUrl: string
): Promise<string> => {
  try {
    const filename = `item_${itemId}.jpg`;
    const localPath = `${ITEM_IMAGE_DIR}/${filename}`;
    
    // Download image
    await downloadImage(imageUrl, localPath);
    
    // Save to database
    const db = getDatabase();
    const now = new Date().toISOString();
    
    // Check if cache entry exists
    const existing = db.execute(
      'SELECT id FROM image_cache WHERE entity_type = ? AND entity_id = ?',
      ['item', itemId]
    );
    
    if (existing.rows?._array?.length > 0) {
      // Update existing
      db.execute(
        `UPDATE image_cache SET
          remote_url = ?, local_path = ?, cached_at = ?, expires_at = ?
        WHERE entity_type = ? AND entity_id = ?`,
        [
          imageUrl,
          localPath,
          now,
          null,
          'item',
          itemId,
        ]
      );
    } else {
      // Insert new
      db.execute(
        `INSERT INTO image_cache (
          entity_type, entity_id, remote_url, local_path, cached_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        ['item', itemId, imageUrl, localPath, now, null]
      );
    }
    
    // Update item record with local_image_path
    db.execute(
      'UPDATE items SET local_image_path = ? WHERE id = ?',
      [localPath, itemId]
    );
    
    console.log(`Item image cached: ${localPath}`);
    return localPath;
  } catch (error) {
    console.error('Failed to cache item image:', error);
    throw error;
  }
};

// Get local image path for entity
export const getLocalImagePath = async (
  entityType: 'vendor' | 'item',
  entityId: string
): Promise<string | null> => {
  try {
    const db = getDatabase();
    const result = db.execute(
      'SELECT local_path FROM image_cache WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    );
    
    const rows = result.rows?._array || [];
    if (rows.length === 0) return null;
    
    const localPath = rows[0].local_path;
    
    // Check if file exists
    const exists = await RNFS.exists(localPath);
    if (!exists) {
      // File was deleted, remove from cache
      db.execute(
        'DELETE FROM image_cache WHERE entity_type = ? AND entity_id = ?',
        [entityType, entityId]
      );
      return null;
    }
    
    return localPath;
  } catch (error) {
    console.error('Failed to get local image path:', error);
    return null;
  }
};

// Get image source for React Native Image component
export const getImageSource = async (
  entityType: 'vendor' | 'item',
  entityId: string,
  remoteUrl?: string | null
): Promise<{ uri: string } | null> => {
  // Try local cache first
  const localPath = await getLocalImagePath(entityType, entityId);
  if (localPath) {
    return { uri: `file://${localPath}` };
  }
  
  // Fallback to remote URL
  if (remoteUrl) {
    return { uri: remoteUrl };
  }
  
  return null;
};

// Clear image cache for entity
export const clearImageCache = async (
  entityType: 'vendor' | 'item',
  entityId: string
): Promise<void> => {
  try {
    const db = getDatabase();
    
    // Get local path
    const result = db.execute(
      'SELECT local_path FROM image_cache WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    );
    
    const rows = result.rows?._array || [];
    if (rows.length > 0) {
      const localPath = rows[0].local_path;
      
      // Delete file
      try {
        await RNFS.unlink(localPath);
      } catch (error) {
        console.warn('Failed to delete cached image file:', error);
      }
    }
    
    // Remove from database
    db.execute(
      'DELETE FROM image_cache WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    );
    
    console.log(`Image cache cleared for ${entityType}:${entityId}`);
  } catch (error) {
    console.error('Failed to clear image cache:', error);
  }
};

// Clear all cached images
export const clearAllImageCache = async (): Promise<void> => {
  try {
    const db = getDatabase();
    
    // Get all cached images
    const result = db.execute('SELECT local_path FROM image_cache');
    const rows = result.rows?._array || [];
    
    // Delete all files
    for (const row of rows) {
      try {
        await RNFS.unlink(row.local_path);
      } catch (error) {
        // File might not exist, continue
      }
    }
    
    // Clear database
    db.execute('DELETE FROM image_cache');
    
    console.log('All image cache cleared');
  } catch (error) {
    console.error('Failed to clear all image cache:', error);
  }
};

export default {
  cacheVendorLogo,
  cacheItemImage,
  getLocalImagePath,
  getImageSource,
  clearImageCache,
  clearAllImageCache,
};
