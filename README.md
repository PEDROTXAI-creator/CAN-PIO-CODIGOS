# Canópia Global — Backend (v2)

Node.js 20.6+ · Express 5 · SQLite (better-sqlite3) · JWT em cookie HttpOnly · bcrypt · Multer · Zod

## 1. Rodar localmente

```bash
cd canopia-backend
npm install
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # cole em JWT_SECRET no .env
npm run migrate                                        # cria/atualiza tabelas e as 6 categorias
npm run admin:criar -- admin@canopia.com "Seu Nome"    # cria o ADMIN (pede a senha, mín. 12 caracteres)
npm start                                              # http://localhost:3000
```

Se você já rodou a versão anterior, `npm run migrate` atualiza o banco existente (os usuários antigos viram admin).

Coloque suas páginas (`index.html`, `sobre.html`, `todas-as-noticias.html`, `noticia.html`) dentro de `public/`.

## 2. Banco de dados

- **usuarios**: id, email (único), nome, senha_hash, **papel** (`leitor` | `admin`), criado_em
- **categorias**: id, slug (único), nome — pré-cadastradas: politica, economia, mundo, esportes, cultura, tecnologia
- **noticias**: id, titulo, slug (único), resumo, conteudo, capa_arquivo, **categoria_id → categorias**, autor_nome,
  slot (`principal` | `subnoticia`), status (`rascunho` | `publicado` | `arquivado`), ordem, views, autor_id → usuarios,
  criado_em, atualizado_em, publicado_em

## 3. API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/noticias?categoria=&busca=&pagina=&limite=` | público |
| GET | `/api/noticias/:id` (id numérico **ou** slug; soma 1 view) | público |
| GET | `/api/noticias/destaques` · `/api/noticias/subnoticias` | público |
| GET | `/api/categorias` | público |
| POST | `/api/auth/registro` `{nome,email,senha}` → cria **leitor** e já loga | público |
| POST | `/api/auth/login` · `/api/auth/logout` · GET `/api/auth/me` | — |
| POST | `/api/admin/noticias` (multipart: titulo, categoria, resumo, conteudo, autor_nome, slot, status, capa) | **admin** |
| GET/PUT/DELETE, PATCH slot/status, POST reordenar, GET metricas | `/api/admin/...` | **admin** |

Admin nunca é criado pelo cadastro público — só pelo terminal (`npm run admin:criar`).

## 4. Front-end

**todas-as-noticias.html**
1. Apague os 6 `<article class="news-card">` de dentro de `<div id="newsGrid">` (deixe a div vazia).
2. Apague o `<script>` do final (filterNews/searchNews/toggleMobileMenu antigos) e coloque:
   ```html
   <script src="/js/noticias-page.js"></script>
   <script>function toggleMobileMenu(){document.getElementById('mobileMenu').classList.toggle('hidden')}</script>
   <script src="/js/auth-ui.js"></script>
   ```
   Os `onclick="filterNews('...')"` e `onkeyup="searchNews()"` continuam funcionando como estão.

**Em todas as páginas** (index, sobre...): inclua `<script src="/js/auth-ui.js"></script>` antes de `</body>`.
Ele liga o "Login/Cadastro" ao modal e troca o link do Google Forms por `/submeter.html`.

**noticia.html**: leia `new URLSearchParams(location.search).get('slug')` e chame `fetch('/api/noticias/' + slug)`.
