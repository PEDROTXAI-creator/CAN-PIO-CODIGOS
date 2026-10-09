import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { ZodError } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { UPLOAD_DIR } from './upload.js';
import { HttpError } from './util.js';
import authRoutes from './routes/auth.js';
import publicoRoutes from './routes/publico.js';
import adminRoutes from './routes/admin.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Defina JWT_SECRET (mínimo 32 caracteres) no arquivo .env.');
  process.exit(1);
}

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1); // atrás de Nginx/Render/Railway

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // O index.html atual usa Tailwind/Phosphor por CDN + script inline.
        // Ao compilar o Tailwind localmente, remova 'unsafe-inline' e as CDNs.
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://unpkg.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'],
        fontSrc: ["'self'", 'https://unpkg.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    }
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// CSRF: cookie SameSite=Strict + conferência de Origin nas requisições que alteram dados.
const mesmaOrigem = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origem = req.get('origin');
  if (origem && new URL(origem).host !== req.get('host')) return res.status(403).json({ erro: 'Origem não permitida.' });
  next();
};

// Rotas públicas (somente leitura). CORS só é ligado se CORS_ORIGIN for definido.
const publicoCors = process.env.CORS_ORIGIN ? [cors({ origin: process.env.CORS_ORIGIN, methods: ['GET'] })] : [];
app.use('/api/noticias', ...publicoCors, publicoRoutes);

app.get('/api/categorias', (req, res) => res.json(db.prepare('SELECT slug, nome FROM categorias ORDER BY id').all()));
app.use('/api/auth', mesmaOrigem, authRoutes);
app.use('/api/admin', mesmaOrigem, adminRoutes);

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public')));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Tratamento central de erros
app.use((err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      detalhes: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message }))
    });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ erro: err.code === 'LIMIT_FILE_SIZE' ? 'Imagem maior que 5 MB.' : 'Erro no upload.' });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ erro: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const porta = Number(process.env.PORT) || 3000;
app.listen(porta, () => console.log(`Canópia Global rodando em http://localhost:${porta}`));
