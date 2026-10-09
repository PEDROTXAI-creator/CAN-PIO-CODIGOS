import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { exigirAdmin } from '../auth.js';
import { upload, salvarImagem, removerImagem } from '../upload.js';
import { HttpError, slugUnico } from '../util.js';

const r = Router();
r.use(exigirAdmin);

const SLOTS = ['principal', 'subnoticia'];
const STATUS = ['rascunho', 'publicado', 'arquivado'];
const BASE = `SELECT n.*, c.slug AS categoria_slug, c.nome AS categoria_nome
              FROM noticias n LEFT JOIN categorias c ON c.id = n.categoria_id`;

const categoriaPorSlug = (slug) => {
  const c = slug && db.prepare('SELECT id FROM categorias WHERE slug = ?').get(slug);
  if (!c) throw new HttpError(400, 'Categoria inválida ou não informada.');
  return c.id;
};

const campos = z.object({
  titulo: z.string().trim().min(3).max(150),
  resumo: z.string().trim().min(1).max(500),
  conteudo: z.string().trim().max(50000).optional(),
  categoria: z.string().trim().max(40).optional(),
  autor_nome: z.string().trim().max(80).optional(),
  slot: z.enum(SLOTS).optional(),
  status: z.enum(STATUS).optional()
});

const idDe = (req) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) throw new HttpError(400, 'ID inválido.');
  return id;
};

const obter = (id) => {
  const n = db.prepare(`${BASE} WHERE n.id = ?`).get(id);
  if (!n) throw new HttpError(404, 'Notícia não encontrada.');
  return n;
};

const apresentar = (n) => {
  const { capa_arquivo, ...resto } = n;
  return { ...resto, capa_url: capa_arquivo ? `/uploads/${capa_arquivo}` : null };
};

// Notícia nova (ou movida de slot) entra no topo do slot.
const ordemTopo = (slot) => db.prepare('SELECT COALESCE(MIN(ordem), 0) - 1 AS o FROM noticias WHERE slot = ?').get(slot).o;

// ---------- Listagem com filtros ----------
r.get('/noticias', (req, res) => {
  const q = z
    .object({
      status: z.enum(STATUS).optional(),
      slot: z.enum(SLOTS).optional(),
      categoria: z.string().trim().max(40).optional(),
      busca: z.string().trim().max(100).optional(),
      pagina: z.coerce.number().int().min(1).default(1),
      limite: z.coerce.number().int().min(1).max(100).default(20)
    })
    .parse(req.query);

  const where = [];
  const params = [];
  if (q.status) { where.push('status = ?'); params.push(q.status); }
  if (q.slot) { where.push('slot = ?'); params.push(q.slot); }
  if (q.categoria) { where.push('categoria_id = (SELECT id FROM categorias WHERE slug = ?)'); params.push(q.categoria); }
  if (q.busca) { where.push('titulo LIKE ?'); params.push(`%${q.busca}%`); }
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM noticias ${cond}`).get(...params).c;
  const itens = db
    .prepare(`${BASE} ${cond} ORDER BY n.atualizado_em DESC LIMIT ? OFFSET ?`)
    .all(...params, q.limite, (q.pagina - 1) * q.limite)
    .map(apresentar);

  res.json({ total, pagina: q.pagina, limite: q.limite, itens });
});

// ---------- Métricas ----------
r.get('/metricas', (req, res) => {
  const porStatus = db.prepare('SELECT status, COUNT(*) AS total FROM noticias GROUP BY status').all();
  const porSlot = db
    .prepare("SELECT slot, COUNT(*) AS total FROM noticias WHERE status = 'publicado' GROUP BY slot")
    .all();
  const views = db.prepare('SELECT COALESCE(SUM(views), 0) AS total FROM noticias').get().total;
  const maisLidas = db
    .prepare("SELECT id, titulo, slug, views FROM noticias WHERE status = 'publicado' ORDER BY views DESC LIMIT 5")
    .all();
  const publicadasPorDia = db
    .prepare(
      `SELECT date(publicado_em) AS dia, COUNT(*) AS total FROM noticias
       WHERE publicado_em >= datetime('now', '-30 days') GROUP BY dia ORDER BY dia`
    )
    .all();
  res.json({ porStatus, porSlot, views_totais: views, mais_lidas: maisLidas, publicadas_por_dia: publicadasPorDia });
});

// ---------- Reordenar dentro de um slot: { slot, ids: [3, 1, 2] } ----------
r.post('/noticias/reordenar', (req, res) => {
  const { slot, ids } = z
    .object({ slot: z.enum(SLOTS), ids: z.array(z.number().int()).min(1).max(200) })
    .parse(req.body);
  const up = db.prepare('UPDATE noticias SET ordem = ? WHERE id = ? AND slot = ?');
  db.transaction(() => ids.forEach((id, i) => up.run(i, id, slot)))();
  res.json({ ok: true });
});

r.get('/noticias/:id', (req, res) => res.json(apresentar(obter(idDe(req)))));

// ---------- Criar (multipart: titulo, resumo, conteudo, slot, status, capa) ----------
r.post('/noticias', upload.single('capa'), async (req, res) => {
  const d = campos.parse(req.body);
  const slot = d.slot ?? 'subnoticia';
  const status = d.status ?? 'rascunho';
  const categoriaId = categoriaPorSlug(d.categoria); // valida antes de gravar a imagem
  const capa = req.file ? await salvarImagem(req.file) : null;

  const info = db
    .prepare(
      `INSERT INTO noticias (titulo, slug, resumo, conteudo, capa_arquivo, categoria_id, autor_nome, slot, status, ordem, autor_id, publicado_em)
       VALUES (@titulo, @slug, @resumo, @conteudo, @capa, @categoria, @autorNome, @slot, @status, @ordem, @autor,
               CASE WHEN @status = 'publicado' THEN datetime('now') END)`
    )
    .run({
      titulo: d.titulo,
      slug: slugUnico(db, d.titulo),
      resumo: d.resumo,
      conteudo: d.conteudo ?? '',
      capa,
      categoria: categoriaId,
      autorNome: d.autor_nome || req.user.nome,
      slot,
      status,
      ordem: ordemTopo(slot),
      autor: req.user.id
    });

  res.status(201).json(apresentar(obter(info.lastInsertRowid)));
});

// ---------- Atualizar (parcial; capa opcional troca a imagem) ----------
r.put('/noticias/:id', upload.single('capa'), async (req, res) => {
  const atual = obter(idDe(req));
  const d = campos.partial().parse(req.body);

  const sets = [];
  const vals = { id: atual.id };
  for (const k of ['titulo', 'resumo', 'conteudo', 'status', 'autor_nome']) {
    if (d[k] !== undefined) { sets.push(`${k} = @${k}`); vals[k] = d[k]; }
  }
  if (d.categoria !== undefined) { sets.push('categoria_id = @categoria'); vals.categoria = categoriaPorSlug(d.categoria); }
  if (d.slot !== undefined && d.slot !== atual.slot) {
    sets.push('slot = @slot', 'ordem = @ordem');
    vals.slot = d.slot;
    vals.ordem = ordemTopo(d.slot);
  }
  if (d.status === 'publicado' && !atual.publicado_em) sets.push("publicado_em = datetime('now')");

  let novaCapa = null;
  if (req.file) {
    novaCapa = await salvarImagem(req.file);
    sets.push('capa_arquivo = @capa');
    vals.capa = novaCapa;
  }
  if (!sets.length) throw new HttpError(400, 'Nada para atualizar.');

  sets.push("atualizado_em = datetime('now')");
  db.prepare(`UPDATE noticias SET ${sets.join(', ')} WHERE id = @id`).run(vals);
  if (novaCapa) await removerImagem(atual.capa_arquivo);

  res.json(apresentar(obter(atual.id)));
});

// ---------- Mudar de posição (promover / rebaixar) ----------
r.patch('/noticias/:id/slot', (req, res) => {
  const { slot } = z.object({ slot: z.enum(SLOTS) }).parse(req.body);
  const n = obter(idDe(req));
  if (n.slot !== slot) {
    db.prepare("UPDATE noticias SET slot = ?, ordem = ?, atualizado_em = datetime('now') WHERE id = ?").run(
      slot,
      ordemTopo(slot),
      n.id
    );
  }
  res.json(apresentar(obter(n.id)));
});

// ---------- Mudar status (publicar / arquivar / voltar a rascunho) ----------
r.patch('/noticias/:id/status', (req, res) => {
  const { status } = z.object({ status: z.enum(STATUS) }).parse(req.body);
  const n = obter(idDe(req));
  db.prepare(
    `UPDATE noticias SET status = ?, atualizado_em = datetime('now'),
       publicado_em = CASE WHEN ? = 'publicado' AND publicado_em IS NULL THEN datetime('now') ELSE publicado_em END
     WHERE id = ?`
  ).run(status, status, n.id);
  res.json(apresentar(obter(n.id)));
});

// ---------- Excluir definitivamente (para tirar do ar sem apagar, use status "arquivado") ----------
r.delete('/noticias/:id', async (req, res) => {
  const n = obter(idDe(req));
  db.prepare('DELETE FROM noticias WHERE id = ?').run(n.id);
  await removerImagem(n.capa_arquivo);
  res.status(204).end();
});

export default r;
