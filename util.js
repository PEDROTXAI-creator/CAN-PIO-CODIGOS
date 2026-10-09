export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function slugify(texto) {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'noticia'
  );
}

export function slugUnico(db, titulo) {
  const base = slugify(titulo);
  let slug = base;
  let i = 2;
  while (db.prepare('SELECT 1 FROM noticias WHERE slug = ?').get(slug)) slug = `${base}-${i++}`;
  return slug;
}
