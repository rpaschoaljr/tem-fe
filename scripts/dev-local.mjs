#!/usr/bin/env node
/**
 * Script cross-platform para dev local.
 * Equivale a: docker emulators up → wait-on :9099 → seed → ng serve
 * Funciona no Windows, Mac e Linux sem depender de sintaxe de shell (&&, etc).
 */

import { spawn, execSync } from 'child_process';
import http from 'http';

const EMULATOR_URL = 'http://localhost:9099';
const MAX_RETRIES = 60;
const RETRY_INTERVAL_MS = 2000;

// ── 1. Sobe os emuladores via Docker ──────────────────────────────────────────
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
  execSync('node scripts/seed-emulator.mjs', { stdio: 'inherit' });
} catch (e) {
  console.error('\n❌  Erro ao rodar seed:', e.message);
}

// ── 4. ng serve ───────────────────────────────────────────────────────────────
console.log('\n🚀  Iniciando ng serve...\n');
const ng = spawn('npx', ['ng', 'serve'], { stdio: 'inherit', shell: true });

ng.on('close', (code) => process.exit(code ?? 0));

// Repassa SIGINT/SIGTERM para encerrar o ng serve corretamente
process.on('SIGINT', () => ng.kill('SIGINT'));
process.on('SIGTERM', () => ng.kill('SIGTERM'));
