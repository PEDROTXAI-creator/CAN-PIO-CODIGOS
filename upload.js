import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from './util.js';

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './public/uploads');
const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

// Arquivo fica em memória até passar pela validação; nada inválido toca o disco.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10 },
  fileFilter: (req, file, cb) =>
    MIMES.includes(file.mimetype) ? cb(null, true) : cb(new HttpError(415, 'Envie uma imagem JPG, PNG ou WebP.'))
});

// O MIME declarado pelo cliente pode mentir: conferimos os bytes iniciais (magic numbers).
function detectarExtensao(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

// O nome original é descartado: o arquivo recebe um UUID + extensão detectada.
export async function salvarImagem(file) {
  const ext = detectarExtensao(file.buffer);
  if (!ext) throw new HttpError(415, 'O conteúdo do arquivo não é uma imagem válida.');
  const nome = `${crypto.randomUUID()}.${ext}`;
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, nome), file.buffer, { flag: 'wx' });
  return nome;
}

export async function removerImagem(nome) {
  if (!nome) return;
  await fs.unlink(path.join(UPLOAD_DIR, path.basename(nome))).catch(() => {});
}
