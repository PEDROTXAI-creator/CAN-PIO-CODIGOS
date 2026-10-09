// Login/Cadastro: injeta o modal e liga os links existentes do cabeçalho — sem mexer no HTML.
// Também troca o link do Google Forms ("Submeter Conteúdo") pela página interna /submeter.html.
(function () {
  const API = '/api';

  const gatilhos = [...document.querySelectorAll('a')].filter((a) => /Login\/Cadastro/.test(a.textContent));
  document.querySelectorAll('a[href*="forms.gle"]').forEach((a) => { a.href = '/submeter.html'; a.removeAttribute('target'); });

  // Modal (template estático: nenhum dado do usuário entra via innerHTML)
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="authOverlay" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 opacity-0 pointer-events-none transition-opacity duration-300">
      <div id="authBox" class="relative w-full max-w-sm bg-brand-light text-brand-text rounded-2xl shadow-2xl p-7 scale-95 opacity-0 transition duration-300">
        <button type="button" id="authFechar" aria-label="Fechar" class="absolute top-3 right-3 text-2xl text-brand-dark/60 hover:text-brand-dark"><i class="ph ph-x"></i></button>
        <div class="flex gap-4 mb-5 font-serif text-xl font-bold">
          <button type="button" data-aba="login" class="aba border-b-2 pb-1">Entrar</button>
          <button type="button" data-aba="registro" class="aba border-b-2 pb-1">Criar conta</button>
        </div>
        <div class="space-y-3 text-sm">
          <input id="authNome" placeholder="Nome" autocomplete="name" class="w-full rounded-md border border-brand-dark/30 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-brand-dark">
          <input id="authEmail" type="email" placeholder="E-mail" autocomplete="email" class="w-full rounded-md border border-brand-dark/30 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-brand-dark">
          <input id="authSenha" type="password" placeholder="Senha" autocomplete="current-password" class="w-full rounded-md border border-brand-dark/30 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-brand-dark">
          <p id="authErro" class="hidden text-[#8A151B]"></p>
          <button type="button" id="authEnviar" class="w-full bg-brand-dark text-brand-light font-bold py-2.5 rounded-md hover:bg-[#3f4c25] transition-colors"></button>
        </div>
      </div>
    </div>`;
  document.body.append(wrap.firstElementChild);

  const $ = (id) => document.getElementById(id);
  const overlay = $('authOverlay'), box = $('authBox');
  let aba = 'login';

  function definirAba(nova) {
    aba = nova;
    document.querySelectorAll('#authBox .aba').forEach((b) => {
      const ativa = b.dataset.aba === nova;
      b.classList.toggle('border-brand-dark', ativa);
      b.classList.toggle('border-transparent', !ativa);
      b.classList.toggle('text-brand-dark/50', !ativa);
    });
    $('authNome').classList.toggle('hidden', nova !== 'registro');
    $('authSenha').autocomplete = nova === 'registro' ? 'new-password' : 'current-password';
    $('authEnviar').textContent = nova === 'registro' ? 'Criar conta' : 'Entrar';
    $('authErro').classList.add('hidden');
  }

  const abrir = () => {
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    requestAnimationFrame(() => box.classList.remove('scale-95', 'opacity-0'));
  };
  const fechar = () => {
    box.classList.add('scale-95', 'opacity-0');
    overlay.classList.add('opacity-0', 'pointer-events-none');
  };

  async function chamar(rota, corpo) {
    const resp = await fetch(API + rota, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corpo ? JSON.stringify(corpo) : undefined
    });
    const json = resp.status === 204 ? {} : await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json.detalhes?.[0]?.mensagem || json.erro || 'Erro inesperado.');
    return json;
  }

  let usuario = null;
  function atualizarCabecalho() {
    gatilhos.forEach((a) => {
      a.replaceChildren();
      const icone = document.createElement('i');
      icone.className = 'ph ph-user-circle text-lg';
      a.append(icone, document.createTextNode(usuario ? ` ${usuario.nome.split(' ')[0]} (sair)` : ' Login/Cadastro'));
    });
  }

  gatilhos.forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    if (usuario) { await chamar('/auth/logout'); usuario = null; atualizarCabecalho(); return; }
    abrir();
  }));
  document.querySelectorAll('#authBox .aba').forEach((b) => b.addEventListener('click', () => definirAba(b.dataset.aba)));
  $('authFechar').onclick = fechar;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });

  async function enviar() {
    try {
      const corpo = { email: $('authEmail').value, senha: $('authSenha').value };
      if (aba === 'registro') corpo.nome = $('authNome').value;
      usuario = (await chamar(aba === 'registro' ? '/auth/registro' : '/auth/login', corpo)).usuario;
      $('authSenha').value = '';
      atualizarCabecalho();
      fechar();
      document.dispatchEvent(new CustomEvent('canopia:login', { detail: usuario }));
    } catch (e) {
      $('authErro').textContent = e.message;
      $('authErro').classList.remove('hidden');
    }
  }
  $('authEnviar').onclick = enviar;
  $('authSenha').addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });

  definirAba('login');
  // Sessão já existente (cookie)? Mostra o nome no cabeçalho.
  fetch(API + '/auth/me').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) { usuario = j.usuario; atualizarCabecalho(); } });
})();
