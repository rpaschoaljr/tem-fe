#!/usr/bin/env node
/**
 * Script cross-platform para dev local.
 * Equivale a: docker emulators up → wait-on :9099 → seed → ng serve
 * Funciona no Windows, Mac e Linux sem depender de sintaxe de shell (&&, etc).
 */

import { spawn, execSync } from 'child_process';
import http from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Carrega variáveis do .env
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env opcional */ }

const EMULATOR_URL = `http://localhost:${process.env.FIREBASE_AUTH_PORT || '9099'}`;
const PROJECT_ID = process.env.FIREBASE_PROJECT || 'demo-sistematemfe';
const MAX_RETRIES = 60;
const RETRY_INTERVAL_MS = 2000;

// ── 1. Instala dependências e compila Cloud Functions ──────────────────────────
console.log('\n📦  Instalando dependências das Cloud Functions...');
try {
  execSync('npm install --prefix functions', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️  Aviso: Falha ao instalar dependências das funções.');
}

console.log('\n📦  Compilando Cloud Functions...');
try {
  execSync('npm run build --prefix functions', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️  Aviso: Falha ao compilar funções. Verifique se o diretório existe.');
}

console.log('\n🐳  Iniciando emuladores Firebase (Docker)...');
try {
  execSync('docker compose up --build -d firebase-emulators', { stdio: 'inherit' });
} catch {
  console.error('❌  Falha ao iniciar Docker. Certifique-se que o Docker está rodando.');
  process.exit(1);
}

// ── 2. Aguarda o emulador Auth responder ──────────────────────────────────────
console.log(`\n⏳  Aguardando Auth emulator em ${EMULATOR_URL}...`);

async function waitForEmulator() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const ok = await new Promise((resolve) => {
      const req = http.get(EMULATOR_URL, (res) => resolve(res.statusCode < 500));
      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => { req.destroy(); resolve(false); });
    });

    if (ok) {
      process.stdout.write('\r✅  Emulator Auth pronto!              \n');
      return;
    }
    process.stdout.write(`\r⏳  Tentativa ${i}/${MAX_RETRIES}...`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
  }
  console.error('\n❌  Emulator não respondeu. Veja os logs: npm run emulators:logs');
  process.exit(1);
}

await waitForEmulator();

// ── 3. Seed ───────────────────────────────────────────────────────────────────
console.log('\n🌱  Rodando seed...\n');
try {
  execSync('node scripts/seed-master.mjs', { stdio: 'inherit' });
} catch (e) {
  console.error('\n❌  Erro ao rodar seed:', e.message);
}

// ── 4. ng serve ───────────────────────────────────────────────────────────────
console.log('\n🚀  Iniciando ng serve...\n');
const ng = spawn('npx', ['ng', 'serve'], { stdio: 'inherit', shell: true });

function shutdown() {
  console.log('\n🛑  Encerrando serviços (Docker compose down)...');
  ng.kill('SIGINT');
  try {
    execSync('docker compose down', { stdio: 'inherit' });
  } catch (e) {
    console.error('⚠️  Erro ao baixar containers:', e.message);
  }
  process.exit(0);
}

// Repassa SIGINT/SIGTERM para encerrar tudo corretamente
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

ng.on('close', (code) => {
  if (code !== null) shutdown();
});
