const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

class S3Service {
  constructor() {
    this.s3Client = new S3Client({ 
      region: process.env.AWS_REGION || 'us-west-2' 
    });
    this.bucketName = process.env.PHOTOS_BUCKET_NAME;
    this.cloudFrontDomain = process.env.PHOTOS_CLOUDFRONT_DOMAIN;
  }

  /**
   * Upload a base64 image to S3
   * @param {string} base64Data - Base64 encoded image data (with or without data URL prefix)
   * @param {string} groupId - Group ID for organizing photos
   * @param {string} contentType - MIME type of the image (e.g., 'image/jpeg')
   * @returns {Promise<string>} - CloudFront URL of the uploaded image
   */
  async uploadGroupPhoto(base64Data, groupId, contentType = 'image/jpeg') {
    try {
      // Remove data URL prefix if present (data:image/jpeg;base64,)
      const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Content, 'base64');
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const extension = this.getFileExtension(contentType);
      const key = `groups/${groupId}/photo-${timestamp}-${randomString}.${extension}`;
      
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          groupId: groupId,
          uploadedAt: new Date().toISOString()
        }
      });

      await this.s3Client.send(command);
      
      // Return CloudFront URL
      const cloudFrontUrl = `https://${this.cloudFrontDomain}/${key}`;
      
      console.log(`Photo uploaded successfully: ${cloudFrontUrl}`);
      return cloudFrontUrl;
      
    } catch (error) {
      console.error('Error uploading photo to S3:', error);
      throw new Error(`Failed to upload photo: ${error.message}`);
    }
  }

  /**
   * Upload a user avatar to S3
   * @param {string} base64Data - Base64 encoded image data (with or without data URL prefix)
   * @param {string} userId - User ID for organizing avatars
   * @param {string} contentType - MIME type of the image (e.g., 'image/jpeg')
   * @returns {Promise<string>} - CloudFront URL of the uploaded avatar
   */
  async uploadUserAvatar(base64Data, userId, contentType = 'image/jpeg') {
    try {
      // Remove data URL prefix if present (data:image/jpeg;base64,)
      const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Content, 'base64');
      
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const extension = this.getFileExtension(contentType);
      const key = `users/${userId}/avatar-${timestamp}-${randomString}.${extension}`;
      
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'max-age=31536000', // 1 year cache
        Metadata: {
          userId: userId,
          uploadedAt: new Date().toISOString()
        }
      });

      await this.s3Client.send(command);
      
      // Return CloudFront URL
      const cloudFrontUrl = `https://${this.cloudFrontDomain}/${key}`;
      
      console.log(`Avatar uploaded successfully: ${cloudFrontUrl}`);
      return cloudFrontUrl;
      
    } catch (error) {
      console.error('Error uploading avatar to S3:', error);
      throw new Error(`Failed to upload avatar: ${error.message}`);
    }
  }

  /**
   * Delete a user avatar from S3
   * @param {string} avatarUrl - CloudFront URL of the avatar to delete
   * @returns {Promise<void>}
   */
  async deleteUserAvatar(avatarUrl) {
    try {
      // Extract S3 key from CloudFront URL
      const key = this.extractS3KeyFromUrl(avatarUrl);
      if (!key) {
        console.warn('Could not extract S3 key from avatar URL:', avatarUrl);
        return;
      }

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      await this.s3Client.send(command);
      console.log(`Avatar deleted successfully: ${key}`);
      
    } catch (error) {
      console.error('Error deleting avatar from S3:', error);
      // Don't throw error for delete operations to avoid breaking profile updates
    }
  }

  /**
   * Extract S3 key from CloudFront URL
   * @param {string} url - CloudFront URL
   * @returns {string|null} - S3 key or null if extraction fails
   */
  extractS3KeyFromUrl(url) {
    try {
      if (!url || !url.includes(this.cloudFrontDomain)) {
        return null;
      }
      
      const urlParts = url.split(this.cloudFrontDomain);
      if (urlParts.length < 2) {
        return null;
      }
      
      // Remove leading slash
      return urlParts[1].replace(/^\//, '');
    } catch (error) {
      console.error('Error extracting S3 key from URL:', error);
      return null;
    }
  }

  /**
   * Get file extension from content type
   * @param {string} contentType - MIME type
   * @returns {string} - File extension
   */
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

  /**
   * Detect content type from base64 data
   * @param {string} base64Data - Base64 encoded image data
   * @returns {string} - Detected content type
   */
  detectContentType(base64Data) {
    if (base64Data.startsWith('data:image/')) {
      const match = base64Data.match(/data:image\/([a-z]+);base64,/);
      if (match) {
        return `image/${match[1]}`;
      }
    }
    
    // Default to JPEG if we can't detect
    return 'image/jpeg';
  }

  /**
   * Validate image size and format
   * @param {string} base64Data - Base64 encoded image data
   * @returns {Object} - Validation result with isValid and error properties
   */
  validateImage(base64Data) {
    try {
      // Remove data URL prefix if present
      const base64Content = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      
      // Check if it's valid base64
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Content)) {
        return { isValid: false, error: 'Invalid base64 format' };
      }
      
      // Check size (10MB limit for S3)
      const sizeInBytes = (base64Content.length * 3) / 4;
      const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
      
      if (sizeInBytes > maxSizeInBytes) {
        return { 
          isValid: false, 
          error: `Image too large: ${Math.round(sizeInBytes / 1024 / 1024)}MB. Maximum: 10MB` 
        };
      }
      
      // Detect and validate content type
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

module.exports = new S3Service();
