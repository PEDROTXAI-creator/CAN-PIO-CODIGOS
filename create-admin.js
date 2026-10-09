import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../src/db.js';

const [emailArg, ...nomeArg] = process.argv.slice(2);
if (!emailArg || !nomeArg.length) {
  console.error('Uso: npm run admin:criar -- email@exemplo.com "Nome do Admin"');
  process.exit(1);
}

const email = z.string().email().parse(emailArg);
const nome = nomeArg.join(' ').trim();

function perguntarSenha(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl._writeToOutput = (s) => rl.output.write(rl.mudo && !/[\r\n]/.test(s) ? '*' : s);
    rl.question(pergunta, (resp) => { rl.close(); resolve(resp); });
    rl.mudo = true;
  });
}

const senha = await perguntarSenha('Senha (mín. 12 caracteres): ');
console.log();
if (senha.length < 12) {
  console.error('Senha muito curta.');
  process.exit(1);
}

const hash = await bcrypt.hash(senha, 12);
db.prepare(
  `INSERT INTO usuarios (email, nome, senha_hash, papel) VALUES (?, ?, ?, 'admin')
   ON CONFLICT(email) DO UPDATE SET nome = excluded.nome, senha_hash = excluded.senha_hash, papel = 'admin'`
).run(email, nome, hash);

console.log(`Admin "${email}" criado/atualizado.`);
