import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import FormData from 'form-data';
import axios from 'axios';
import { getApiKey, httpsRequest, API_HOST, log, colors, success, error, info, warn } from '../utils.js';

// ==================== SECURITY CONSTANTS ====================

/**
 * Maximum file size for uploads (15 MB) - server limit
 */
const MAX_FILE_SIZE = 15 * 1024 * 1024;

/**
 * Maximum request body/content length (500 MB)
 */
const MAX_REQUEST_SIZE = 500 * 1024 * 1024;

/**
 * Request timeout in milliseconds (30 seconds)
 */
const REQUEST_TIMEOUT = 30000;

/**
 * Allowed file extensions for upload (whitelist)
 */
const ALLOWED_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',  // Images
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',  // Documents
  '.txt', '.csv', '.json', '.xml',                            // Text/Data
  '.zip', '.rar', '.7z',                                       // Archives
  '.mp3', '.mp4', '.wav', '.avi', '.mov'                      // Media
];

/**
 * Blocked file extensions (security risk)
 */
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',              // Windows executables
  '.sh', '.bash', '.zsh',                                      // Shell scripts
  '.js', '.vbs', '.ps1', '.app', '.deb', '.rpm',               // Executable scripts
  '.jar', '.war', '.ear',                                      // Java executables
  '.msi', '.dmg', '.pkg'                                       // Installers
];

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validates file path for security
 * @param {string} filePath - Path to validate
 * @returns {string} - Resolved safe path
 */
function validateUploadPath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path is required');
  }

  // Check for path traversal
  if (filePath.includes('..')) {
    throw new Error('Path traversal not allowed in file path');
  }

  // Check for null bytes
  if (filePath.includes('\0')) {
    throw new Error('Null bytes not allowed in file path');
  }

  // Resolve to absolute path
  const resolvedPath = path.resolve(filePath);

  // Check if path exists
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  // Verify it's a file, not a directory
  const stats = fs.statSync(resolvedPath);
  if (!stats.isFile()) {
    throw new Error(`Not a valid file: ${filePath}`);
  }

  return resolvedPath;
}

/**
 * Validates file extension against allowlist/blocklist
 * @param {string} fileName - File name to validate
 * @returns {string} - File extension (lowercase)
 */
function validateFileExtension(fileName) {
  const ext = path.extname(fileName).toLowerCase();

  // Check blocklist first
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error(`File type not allowed for security reasons: ${ext}`);
  }

  // Warn if not in allowlist (but don't block)
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    warn(`Warning: Uncommon file type ${ext}. Upload may be restricted by server.`);
  }

  return ext;
}

/**
 * Validates file size
 * @param {string} filePath - Path to file
 */
function validateFileSize(filePath) {
  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${(stats.size / 1024 / 1024).toFixed(2)} MB. Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024} MB`);
  }
  if (stats.size === 0) {
    throw new Error('Cannot upload empty file');
  }
}

// ==================== MAIN FUNCTIONS ====================

async function getOssSign(apiKey) {
  const data = JSON.stringify({
    isVip: false
  });

  const response = await httpsRequest(
    {
      hostname: API_HOST,
      port: 443,
      path: '/api/openapi/oss-sign',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(data)
      }
    },
    data
  );

  if (response.statusCode && response.statusCode !== 200) {
    throw new Error(`HTTP ${response.statusCode}: ${response.message || 'Failed to get OSS sign'}`);
  }

  return response;
}

export async function uploadFile(options) {
  const apiKey = getApiKey(options?.apiKey);
  const filePath = options.filePath;

  // Validate file path with security checks
  let resolvedPath;
  try {
    resolvedPath = validateUploadPath(filePath);
  } catch (err) {
    error(err.message);
    info('使用方法: miaoying upload <file-path>');
    process.exit(1);
  }

  const fileName = path.basename(resolvedPath);

  // Validate file extension
  try {
    validateFileExtension(fileName);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  // Validate file size
  try {
    validateFileSize(resolvedPath);
  } catch (err) {
    error(err.message);
    process.exit(1);
  }

  const ext = path.extname(fileName);
  const fileBuffer = fs.readFileSync(resolvedPath);
  const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');
  const ossKey = `uploads/${md5}${ext}`;

  info('正在获取 OSS 独名...');

  let ossInfo;
  try {
    ossInfo = await getOssSign(apiKey);
  } catch (err) {
    error(`获取 OSS 独名失败: ${err.message}`);
    process.exit(1);
  }

  if (!ossInfo) {
    error('获取 OSS 独名失败: 返回数据为空');
    process.exit(1);
  }

  info('正在上传文件...');

  try {
    const form = new FormData();
    form.append('key', ossKey);
    form.append('policy', ossInfo.policy);
    form.append('OSSAccessKeyId', ossInfo.OSSAccessKeyId);
    form.append('signature', ossInfo.signature);
    form.append('success_action_status', '200');
    form.append('file', createReadStream(resolvedPath), fileName);

    const uploadUrl = ossInfo.uploadImageUrl || 'https://hui51.oss-cn-beijing.aliyuncs.com/';

    const response = await axios.post(uploadUrl, form, {
      headers: {
        ...form.getHeaders()
      },
      // Security: Replace Infinity with reasonable limits
      maxBodyLength: MAX_REQUEST_SIZE,
      maxContentLength: MAX_REQUEST_SIZE,
      // Security: Add timeout
      timeout: REQUEST_TIMEOUT
    });

    if (response.status === 200 || response.status === 204) {
      success('文件上传成功！');
      log(colors.bright, '   OSS 路径:', ossKey);
      return ossKey;
    } else {
      error(`上传失败，状态码: ${response.status}`);
      process.exit(1);
    }
  } catch (err) {
    if (err.code === 'ECONNABORTED') {
      error('上传超时，请检查网络连接或尝试上传较小的文件');
    } else if (err.response) {
      // Sanitize error message - don't expose full response data
      error(`上传失败: HTTP ${err.response.status}`);
    } else {
      error(`上传失败: ${err.message}`);
    }
    process.exit(1);
  }
}
