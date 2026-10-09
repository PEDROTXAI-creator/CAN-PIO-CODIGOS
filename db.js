import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = path.resolve(process.env.DB_PATH || './data/canopia.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Migração idempotente: só cria o que ainda não existe.
export function migrar() {
  const sql = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  db.exec(sql);

  // Atualiza bancos criados pela versão anterior (que não tinham estas colunas).
  const tem = (tabela, coluna) => db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna);
  if (!tem('usuarios', 'papel')) {
    db.exec("ALTER TABLE usuarios ADD COLUMN papel TEXT NOT NULL DEFAULT 'leitor'");
    db.exec("UPDATE usuarios SET papel = 'admin'"); // todos os usuários antigos eram admins
  }
  if (!tem('noticias', 'categoria_id')) db.exec('ALTER TABLE noticias ADD COLUMN categoria_id INTEGER REFERENCES categorias(id)');
  if (!tem('noticias', 'autor_nome')) db.exec('ALTER TABLE noticias ADD COLUMN autor_nome TEXT');
  db.exec('CREATE INDEX IF NOT EXISTS idx_noticias_categoria ON noticias (categoria_id)');
}
migrar();
