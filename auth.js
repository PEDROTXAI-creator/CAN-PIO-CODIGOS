import jwt from 'jsonwebtoken';

export const COOKIE = 'canopia_token';
export const TOKEN_HORAS = 8;

export function assinar(u) {
  return jwt.sign({ sub: u.id, email: u.email, nome: u.nome, papel: u.papel }, process.env.JWT_SECRET, {
    expiresIn: `${TOKEN_HORAS}h`,
    algorithm: 'HS256'
  });
}

export function definirCookie(res, usuario) {
  res.cookie(COOKIE, assinar(usuario), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_HORAS * 3600 * 1000,
    path: '/'
  });
}

// Qualquer usuário logado (leitor ou admin)
export function exigirLogin(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ erro: 'Não autenticado.' });
  try {
    const p = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = { id: p.sub, email: p.email, nome: p.nome, papel: p.papel };
    next();
  } catch {
    res.clearCookie(COOKIE);
    res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
}

// Somente administradores
export function exigirAdmin(req, res, next) {
  exigirLogin(req, res, () => {
    if (req.user.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
    next();
  });
}
