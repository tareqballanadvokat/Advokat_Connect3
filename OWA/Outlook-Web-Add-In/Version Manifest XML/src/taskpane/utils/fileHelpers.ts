/**
 * File Helper Utilities
 * Pure helper functions for file operations that don't affect application state
 */

/**
 * Get MIME type from file extension
 * @param extension - File extension (without dot)
 * @returns MIME type string
 */
export function getMimeTypeFromExtension(extension: string): string {
  const mimeTypes: Record<string, string> = {
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    'odt': 'application/vnd.oasis.opendocument.text',
    'ods': 'application/vnd.oasis.opendocument.spreadsheet',
    'odp': 'application/vnd.oasis.opendocument.presentation',
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    // Email
    'msg': 'application/vnd.ms-outlook',
    'eml': 'message/rfc822',
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
    // Web
    'html': 'text/html',
    'htm': 'text/html',
    'css': 'text/css',
    'js': 'text/javascript',
    'json': 'application/json',
    'xml': 'application/xml',
    // Other
    'csv': 'text/csv',
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

/**
 * Convert base64 string to Uint8Array
 * @param base64String - Base64 encoded string
 * @returns Uint8Array containing binary data
 */
export function base64ToUint8Array(base64String: string): Uint8Array {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Extract file extension from filename
 * @param fileName - Full filename with extension
 * @returns File extension in lowercase (without dot), or empty string if no extension
 */
export function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() || '';
}

/**
 * Check if a file type can be viewed in browser
 * @param mimeType - MIME type of the file
 * @returns true if file can be viewed in browser, false otherwise
 */
export function isViewableInBrowser(mimeType: string): boolean {
  const viewableTypes = [
    'application/pdf',
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/bmp', 
    'image/webp', 
    'image/svg+xml',
    'text/plain', 
    'text/html', 
    'text/css', 
    'text/javascript',
    'application/json', 
    'application/xml'
  ];
  
  return viewableTypes.includes(mimeType) || 
         mimeType.startsWith('text/') || 
         mimeType.startsWith('image/');
}

/**
 * Calculate approximate file size from base64 string
 * Base64 encoding adds ~33% overhead, so we multiply by 3/4 to get approximate original size
 * @param base64String - Base64 encoded string
 * @returns Approximate file size in bytes
 */
export function calculateFileSizeFromBase64(base64String: string): number {
  return Math.round((base64String.length * 3) / 4);
}

/**
 * Create a blob from base64 content and MIME type
 * @param base64Content - Base64 encoded file content
 * @param mimeType - MIME type of the file
 * @returns Blob object
 */
export function createBlobFromBase64(base64Content: string, mimeType: string): Blob {
  const bytes = base64ToUint8Array(base64Content);
  return new Blob([bytes as BlobPart], { type: mimeType });
}
