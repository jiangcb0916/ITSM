import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { AppError } from './errorHandler';

const uploadDir = config.upload.dir;
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx|xls|xlsx|txt|zip)$/i.test(file.originalname);
    if (allowed) cb(null, true);
    else cb(new AppError(400, '不支持的文件类型'));
  },
});

/** 新建工单问题截图：仅图片，单文件 5MB，最多 5 张 */
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp)$/i;
const IMAGE_MAX_SIZE = 5 * 1024 * 1024;

export const uploadTicketImages = multer({
  storage,
  limits: { fileSize: IMAGE_MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!IMAGE_EXT.test(file.originalname)) {
      cb(new AppError(400, '仅支持 jpg、png、gif、webp 格式'));
      return;
    }
    cb(null, true);
  },
}).array('screenshots', 5);
