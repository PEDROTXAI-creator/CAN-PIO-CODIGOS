// Conecta o index.html à API: preenche o banner e o grid de subnotícias.
// Se a API falhar, o conteúdo estático da página continua visível.
(function () {
  const API = '/api'; // se a API estiver em outro domínio: 'https://api.seudominio.com/api'

  const el = (tag, cls, texto) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto !== undefined) e.textContent = texto; // textContent = sem risco de XSS
    return e;
  };
  const get = async (url) => {
    const r = await fetch(API + url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  };
  const link = (n) => '/noticia.html?slug=' + encodeURIComponent(n.slug); // página de leitura: próximo passo

  // ---------- Banner (carrossel) ----------
  function renderBanner(itens) {
    const banner = document.getElementById('bannerPrincipal');
    if (!banner || !itens.length) return;

    banner.querySelector(':scope > .bg-gray-400')?.remove(); // remove o placeholder cinza
    const dots = document.getElementById('bannerDots');
    const prev = document.getElementById('bannerPrev');
    const next = document.getElementById('bannerNext');
    [dots, prev, next].forEach((x) => x && x.classList.add('z-10'));
    if (dots) dots.replaceChildren();

    const slides = itens.map((n, i) => {
      const a = el('a', 'absolute inset-0 block transition-opacity duration-700 ' + (i ? 'opacity-0 pointer-events-none' : 'opacity-100'));
      a.href = link(n);
      if (n.capa_url) {
        const img = el('img', 'w-full h-full object-cover');
        img.src = n.capa_url;
        img.alt = '';
        a.append(img);
      } else {
        a.append(el('div', 'w-full h-full bg-brand-dark'));
      }
      const legenda = el('div', 'absolute inset-x-0 bottom-0 p-6 md:p-10 pb-14 bg-gradient-to-t from-black/80 to-transparent text-white');
      legenda.append(el('h3', 'font-serif text-2xl md:text-4xl font-bold', n.titulo), el('p', 'mt-2 max-w-3xl text-sm md:text-base opacity-90', n.resumo));
      a.append(legenda);
      banner.prepend(a);
      if (dots) {
        const d = el('button', 'w-3 h-3 rounded-full ' + (i ? 'bg-gray-400' : 'bg-brand-dark'));
        d.setAttribute('aria-label', 'Notícia ' + (i + 1));
        d.onclick = () => ir(i);
        dots.append(d);
      }
      return a;
    });

    let atual = 0, timer;
    function ir(i) {
      atual = (i + slides.length) % slides.length;
      slides.forEach((s, k) => {
        s.classList.toggle('opacity-100', k === atual);
        s.classList.toggle('opacity-0', k !== atual);
        s.classList.toggle('pointer-events-none', k !== atual);
      });
      dots && [...dots.children].forEach((d, k) => {
        d.classList.toggle('bg-brand-dark', k === atual);
        d.classList.toggle('bg-gray-400', k !== atual);
      });
    }
    const auto = () => { clearInterval(timer); if (slides.length > 1) timer = setInterval(() => ir(atual + 1), 7000); };
    if (prev) prev.onclick = () => { ir(atual - 1); auto(); };
    if (next) next.onclick = () => { ir(atual + 1); auto(); };
    banner.addEventListener('mouseenter', () => clearInterval(timer));
    banner.addEventListener('mouseleave', auto);
    auto();
  }

  // ---------- Grid de subnotícias ----------
  function renderSubnoticias(itens) {
    const grid = document.getElementById('gridSubnoticias');
    if (!grid || !itens.length) return;
    grid.replaceChildren(
      ...itens.map((n) => {
        const a = el('a', 'flex flex-col cg-reveal in cg-card-hover cursor-pointer');
        a.href = link(n);
        if (n.capa_url) {
          const img = el('img', 'h-40 w-full object-cover rounded-2xl mb-3 shadow-inner');
          img.src = n.capa_url;
          img.alt = '';
          img.loading = 'lazy';
          a.append(img);
        } else {
          a.append(el('div', 'bg-[#d1d1d1] h-40 rounded-2xl mb-3 shadow-inner'));
        }
        a.append(el('h3', 'font-sans font-medium text-brand-dark text-sm md:text-base leading-tight', n.titulo));
        return a;
      })
    );
  }

  document.addEventListener('DOMContentLoaded', () => {
    get('/noticias/destaques').then(renderBanner).catch(console.warn);
    get('/noticias/subnoticias?limite=8').then(renderSubnoticias).catch(console.warn);
  });
})();
