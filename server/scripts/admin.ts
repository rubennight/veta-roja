import readline from 'node:readline';
import { createAdmin, setAdminPassword } from '../src/auth/password';
import { loadConfig } from '../src/config';
import { createDb, runMigrations } from '../src/db/client';

/** Lee la contraseña de ADMIN_PASSWORD o la pide en la terminal sin mostrarla. */
async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const muted = rl as unknown as { _writeToOutput: (s: string) => void };
  const original = muted._writeToOutput.bind(rl);
  return new Promise((resolve) => {
    rl.question('Contraseña (mínimo 12 caracteres): ', (answer) => {
      muted._writeToOutput = original;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted._writeToOutput = (s: string) => {
      if (s.includes('Contraseña')) original(s);
    };
  });
}

export async function runAdminCommand(mode: 'create' | 'reset'): Promise<void> {
  const username = process.argv[2];
  if (!username) {
    console.error(`Uso: npm run admin:${mode} -w server -- <usuario>`);
    process.exit(2);
  }
  const config = loadConfig();
  const { db, close } = createDb(config.databaseUrl);
  try {
    await runMigrations(db);
    const password = await readPassword();
    if (mode === 'create') await createAdmin(db, username, password);
    else await setAdminPassword(db, username, password);
    console.log(mode === 'create' ? `Admin "${username}" creado.` : `Contraseña de "${username}" restablecida.`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await close();
  }
}
