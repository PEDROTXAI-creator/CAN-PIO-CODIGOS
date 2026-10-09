import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db } from '../db.js';
import { COOKIE, definirCookie, exigirLogin } from '../auth.js';
import { HttpError } from '../util.js';

const r = Router();

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente em 15 minutos.' }
});

const publico = (u) => ({ id: u.id, nome: u.nome, email: u.email, papel: u.papel });
// Hash falso para gastar o mesmo tempo quando o e-mail não existe (evita enumerar usuários).
const HASH_FALSO = bcrypt.hashSync('senha-falsa-para-tempo-constante', 12);

// Cadastro público: SEMPRE cria "leitor". Admin só nasce via `npm run admin:criar`.
const registroSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200),
  senha: z.string().min(8).max(200)
});

r.post('/registro', limitador, async (req, res) => {
  const d = registroSchema.parse(req.body);
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(d.email)) {
    throw new HttpError(409, 'Este e-mail já está cadastrado.');
  }
  const hash = await bcrypt.hash(d.senha, 12);
  const info = db.prepare("INSERT INTO usuarios (email, nome, senha_hash, papel) VALUES (?, ?, ?, 'leitor')").run(d.email, d.nome, hash);
  const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(info.lastInsertRowid);
  definirCookie(res, u);
  res.status(201).json({ usuario: publico(u) });
});

const loginSchema = z.object({ email: z.string().trim().email().max(200), senha: z.string().min(1).max(200) });

r.post('/login', limitador, async (req, res) => {
  const { email, senha } = loginSchema.parse(req.body);
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  const ok = await bcrypt.compare(senha, u ? u.senha_hash : HASH_FALSO);
  if (!u || !ok) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  definirCookie(res, u);
  res.json({ usuario: publico(u) });
});

r.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.status(204).end();
});

r.get('/me', exigirLogin, (req, res) => res.json({ usuario: req.user }));

export default r;
