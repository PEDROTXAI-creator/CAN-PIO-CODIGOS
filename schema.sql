CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nome        TEXT NOT NULL,
  senha_hash  TEXT NOT NULL,
  papel       TEXT NOT NULL DEFAULT 'leitor' CHECK (papel IN ('leitor','admin')),
  criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  slug  TEXT NOT NULL UNIQUE,
  nome  TEXT NOT NULL
);

INSERT OR IGNORE INTO categorias (slug, nome) VALUES
  ('politica','Política'), ('economia','Economia'), ('mundo','Mundo'),
  ('esportes','Esportes'), ('cultura','Cultura'), ('tecnologia','Tecnologia');

CREATE TABLE IF NOT EXISTS noticias (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo         TEXT NOT NULL,
  slug           TEXT NOT NULL UNIQUE,
  resumo         TEXT NOT NULL,
  conteudo       TEXT NOT NULL DEFAULT '',
  capa_arquivo   TEXT,
  categoria_id   INTEGER REFERENCES categorias(id),
  autor_nome     TEXT,
  slot           TEXT NOT NULL DEFAULT 'subnoticia' CHECK (slot IN ('principal','subnoticia')),
  status         TEXT NOT NULL DEFAULT 'rascunho'   CHECK (status IN ('rascunho','publicado','arquivado')),
  ordem          INTEGER NOT NULL DEFAULT 0,
  views          INTEGER NOT NULL DEFAULT 0,
  autor_id       INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em  TEXT NOT NULL DEFAULT (datetime('now')),
  publicado_em   TEXT
);

CREATE INDEX IF NOT EXISTS idx_noticias_listagem ON noticias (status, slot, ordem);
