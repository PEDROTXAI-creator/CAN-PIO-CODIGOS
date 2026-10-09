import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { HttpError } from '../util.js';

const r = Router();

const CAMPOS = `n.id, n.titulo, n.slug, n.resumo, n.capa_arquivo, n.slot, n.publicado_em, n.views, n.autor_nome,
                c.slug AS categoria_slug, c.nome AS categoria_nome`;
const DE = 'FROM noticias n LEFT JOIN categorias c ON c.id = n.categoria_id';

const mapear = (n) => ({
  id: n.id,
  titulo: n.titulo,
  slug: n.slug,
  resumo: n.resumo,
  slot: n.slot,
  publicado_em: n.publicado_em,
  views: n.views,
  autor_nome: n.autor_nome,
  categoria_slug: n.categoria_slug,
  categoria_nome: n.categoria_nome,
  capa_url: n.capa_arquivo ? `/uploads/${n.capa_arquivo}` : null
});

const porSlot = (slot, limite) =>
  db
    .prepare(
      `SELECT ${CAMPOS} ${DE} WHERE n.status = 'publicado' AND n.slot = ?
       ORDER BY n.ordem ASC, n.publicado_em DESC LIMIT ?`
    )
    .all(slot, limite)
    .map(mapear);

// ---------- Listagem com busca e filtro: GET /api/noticias?categoria=politica&busca=lula&pagina=1&limite=12 ----------
r.get('/', (req, res) => {
  const q = z
    .object({
      categoria: z.string().trim().max(40).optional(),
      busca: z.string().trim().max(100).optional(),
      pagina: z.coerce.number().int().min(1).default(1),
      limite: z.coerce.number().int().min(1).max(50).default(12)
    })
    .parse(req.query);

  const where = ["n.status = 'publicado'"];
  const params = [];
  if (q.categoria && q.categoria !== 'todos') {
    where.push('c.slug = ?');
    params.push(q.categoria);
  }
  if (q.busca) {
    // Escapa % e _ para a busca ser literal (o LIKE do SQLite ignora maiúsculas, mas não acentos)
    const like = `%${q.busca.replace(/[\\%_]/g, '\\$&')}%`;
    where.push("(n.titulo LIKE ? ESCAPE '\\' OR n.resumo LIKE ? ESCAPE '\\' OR n.conteudo LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const cond = `WHERE ${where.join(' AND ')}`;

  const total = db.prepare(`SELECT COUNT(*) AS c ${DE} ${cond}`).get(...params).c;
  const itens = db
    .prepare(`SELECT ${CAMPOS} ${DE} ${cond} ORDER BY n.publicado_em DESC, n.id DESC LIMIT ? OFFSET ?`)
    .all(...params, q.limite, (q.pagina - 1) * q.limite)
    .map(mapear);

  res.json({ total, pagina: q.pagina, limite: q.limite, itens });
});

// Banner / carrossel e grid secundário da home
r.get('/destaques', (req, res) => res.json(porSlot('principal', Number(process.env.MAX_PRINCIPAIS) || 5)));
r.get('/subnoticias', (req, res) => {
  const { limite } = z.object({ limite: z.coerce.number().int().min(1).max(50).default(8) }).parse(req.query);
  res.json(porSlot('subnoticia', limite));
});

// ---------- Notícia completa: aceita id numérico OU slug. Cada leitura soma 1 view ----------
r.get('/:ref', (req, res) => {
  const ref = req.params.ref;
  const coluna = /^\d+$/.test(ref) ? 'n.id' : 'n.slug';
  const n = db.prepare(`SELECT ${CAMPOS}, n.conteudo ${DE} WHERE ${coluna} = ? AND n.status = 'publicado'`).get(ref);
  if (!n) throw new HttpError(404, 'Notícia não encontrada.');
  db.prepare('UPDATE noticias SET views = views + 1 WHERE id = ?').run(n.id);
  res.json({ ...mapear({ ...n, views: n.views + 1 }), conteudo: n.conteudo });
});

export default r;
