// todas-as-noticias.html — substitui os cards fixos + filterNews()/searchNews() por dados da API.
// Mantém os mesmos nomes de função (filterNews, searchNews), então o HTML não precisa mudar os onclick/onkeyup.
(function () {
  const API = '/api';
  const POR_PAGINA = 12;

  const grid = document.getElementById('newsGrid');
  const vazio = document.getElementById('noResults');
  const inputBusca = document.getElementById('searchInput');

  let categoria = 'todos';
  let busca = '';
  let pagina = 1;
  let total = 0;
  let requisicao = 0; // descarta respostas antigas se o usuário clicar/digitar rápido

  // Botão "Carregar mais" criado via JS logo abaixo do grid
  const maisBtn = document.createElement('button');
  maisBtn.textContent = 'Carregar mais notícias';
  maisBtn.className = 'hidden mx-auto mt-10 px-6 py-2.5 rounded-md bg-brand-dark text-brand-light font-bold text-sm hover:bg-[#3f4c25] transition-colors';
  maisBtn.onclick = () => { pagina++; carregar(false); };
  grid.after(maisBtn);

  const el = (tag, cls, texto) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto !== undefined && texto !== null) e.textContent = texto; // textContent evita XSS
    return e;
  };

  // O banco guarda UTC ("2026-09-30 14:00:00"); exibimos dd/mm/aaaa
  const dataBR = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR') : '');

  function criarCard(n) {
    const card = el('article', 'news-card bg-white rounded-lg overflow-hidden border border-gray-300 shadow-sm hover:shadow-md transition-shadow');
    card.dataset.category = n.categoria_slug || '';

    const a = el('a', 'block group');
    a.href = 'noticia.html?slug=' + encodeURIComponent(n.slug);

    const capa = el('div', 'aspect-video w-full bg-gray-200 overflow-hidden relative');
    if (n.capa_url) {
      const img = el('img', 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-300');
      img.src = n.capa_url;
      img.alt = n.titulo;
      img.loading = 'lazy';
      capa.append(img);
    }
    if (n.categoria_nome) {
      capa.append(el('span', 'absolute top-3 left-3 bg-brand-dark text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded', n.categoria_nome));
    }

    const corpo = el('div', 'p-5');
    const meta = [dataBR(n.publicado_em), n.autor_nome ? 'Por ' + n.autor_nome : ''].filter(Boolean).join(' • ');
    corpo.append(
      el('span', 'text-xs text-brand-text/60', meta),
      el('h2', 'font-serif text-xl font-bold text-brand-dark mt-2 mb-2 group-hover:underline leading-snug', n.titulo),
      el('p', 'font-sans text-sm text-brand-text/80 line-clamp-3', n.resumo)
    );

    a.append(capa, corpo);
    card.append(a);
    return card;
  }

  async function carregar(reiniciar) {
    const minha = ++requisicao;
    if (reiniciar) { pagina = 1; grid.replaceChildren(); }

    const params = new URLSearchParams({ pagina, limite: POR_PAGINA });
    if (categoria !== 'todos') params.set('categoria', categoria);
    if (busca) params.set('busca', busca);

    try {
      const resp = await fetch(`${API}/noticias?${params}`);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const dados = await resp.json();
      if (minha !== requisicao) return; // chegou atrasada

      total = dados.total;
      dados.itens.forEach((n) => grid.append(criarCard(n)));
      vazio.classList.toggle('hidden', grid.children.length > 0);
      maisBtn.classList.toggle('hidden', grid.children.length >= total);
    } catch (e) {
      console.error(e);
      vazio.classList.remove('hidden');
      vazio.querySelector('p').textContent = 'Não foi possível carregar as notícias. Tente novamente.';
    }
  }

  // ---- Funções chamadas pelos onclick/onkeyup do HTML ----
  window.filterNews = function (cat) {
    categoria = cat;
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${cat}'`));
    });
    carregar(true);
  };

  let timer;
  window.searchNews = function () {
    clearTimeout(timer); // espera o usuário parar de digitar (300 ms) antes de chamar a API
    timer = setTimeout(() => {
      busca = inputBusca.value.trim();
      carregar(true);
    }, 300);
  };

  // ---- Inicialização: respeita /todas-as-noticias.html?categoria=mundo ----
  document.addEventListener('DOMContentLoaded', () => {
    const inicial = new URLSearchParams(location.search).get('categoria');
    inicial ? window.filterNews(inicial) : carregar(true);
  });
})();
