const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');

class GCSService {
  constructor() {
    this.storage = new Storage();
    this.bucketName = process.env.PHOTOS_BUCKET_NAME;
    this.photosBaseUrl = process.env.PHOTOS_BASE_URL;
  }

  async uploadGroupPhoto(base64Data, groupId, contentType = 'image/jpeg') {
    try {
      const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const extension = this.getFileExtension(contentType);
      const key = `groups/${groupId}/photo-${timestamp}-${randomString}.${extension}`;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(key);

      await file.save(buffer, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
          metadata: {
            groupId,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      const url = `${this.photosBaseUrl}/${key}`;
      console.log(`Photo uploaded successfully: ${url}`);
      return url;
    } catch (error) {
      console.error('Error uploading photo to GCS:', error);
      throw new Error(`Failed to upload photo: ${error.message}`);
    }
  }

  async uploadUserAvatar(base64Data, userId, contentType = 'image/jpeg') {
    try {
      const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const buffer = Buffer.from(base64Content, 'base64');

      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const extension = this.getFileExtension(contentType);
      const key = `users/${userId}/avatar-${timestamp}-${randomString}.${extension}`;

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(key);

      await file.save(buffer, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
          metadata: {
            userId,
            uploadedAt: new Date().toISOString()
          }
        }
      });

      const url = `${this.photosBaseUrl}/${key}`;
      console.log(`Avatar uploaded successfully: ${url}`);
      return url;
    } catch (error) {
      console.error('Error uploading avatar to GCS:', error);
      throw new Error(`Failed to upload avatar: ${error.message}`);
    }
  }

  async deleteUserAvatar(avatarUrl) {
    try {
      const key = this.extractKeyFromUrl(avatarUrl);
      if (!key) {
        console.warn('Could not extract GCS key from avatar URL:', avatarUrl);
        return;
      }

      const bucket = this.storage.bucket(this.bucketName);
      await bucket.file(key).delete();
      console.log(`Avatar deleted successfully: ${key}`);
    } catch (error) {
      console.error('Error deleting avatar from GCS:', error);
      // Don't throw error for delete operations to avoid breaking profile updates
    }
  }

  async deleteGroupPhoto(photoUrl) {
    try {
      const key = this.extractKeyFromUrl(photoUrl);
      if (!key) {
        console.warn('Could not extract GCS key from photo URL:', photoUrl);
        return;
      }

      const bucket = this.storage.bucket(this.bucketName);
      await bucket.file(key).delete();
      console.log(`Group photo deleted successfully: ${key}`);
    } catch (error) {
      console.error('Error deleting group photo from GCS:', error);
      // Don't throw error for delete operations to avoid breaking group updates
    }
  }

  extractKeyFromUrl(url) {
    try {
      if (!url || !this.photosBaseUrl) {
        return null;
      }

      // Handle GCS URL format: https://storage.googleapis.com/<bucket>/<key>
      if (url.includes(this.photosBaseUrl)) {
        const key = url.replace(this.photosBaseUrl + '/', '');
        return key || null;
      }

      // Handle legacy CloudFront URLs during migration
      // Extract the path portion (groups/xxx/photo-xxx.jpg or users/xxx/avatar-xxx.jpg)
      const match = url.match(/((?:groups|users)\/[^?]+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.error('Error extracting GCS key from URL:', error);
      return null;
    }
  }

  getFileExtension(contentType) {
    const extensions = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };

    return extensions[contentType.toLowerCase()] || 'jpg';
  }

  detectContentType(base64Data) {
    if (base64Data.startsWith('data:image/')) {
      const match = base64Data.match(/data:image\/([a-z]+);base64,/);
      if (match) {
        return `image/${match[1]}`;
      }
    }

    return 'image/jpeg';
  }

  validateImage(base64Data) {
    try {
      const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Content)) {
        return { isValid: false, error: 'Invalid base64 format' };
      }

      const sizeInBytes = (base64Content.length * 3) / 4;
      const maxSizeInBytes = 10 * 1024 * 1024; // 10MB

      if (sizeInBytes > maxSizeInBytes) {
        return {
          isValid: false,
          error: `Image too large: ${Math.round(sizeInBytes / 1024 / 1024)}MB. Maximum: 10MB`
        };
      }

      const contentType = this.detectContentType(base64Data);
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

      if (!allowedTypes.includes(contentType)) {
        return {
          isValid: false,
          error: `Unsupported image format: ${contentType}. Allowed: JPEG, PNG, GIF, WebP`
        };
      }

      return { isValid: true, contentType, sizeInBytes };
    } catch (error) {
      return { isValid: false, error: `Validation error: ${error.message}` };
    }
  }
}

module.exports = new GCSService();
