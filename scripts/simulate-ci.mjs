#!/usr/bin/env node

/**
 * SIMULADOR LOCAL DO GITHUB ACTIONS PIPELINE (CI/CD)
 * Executa as mesmas etapas de Build, Testes Unitários e Security Scans do GitHub Actions.
 * Monitora o tempo de cada etapa e gera relatórios idênticos.
 */

import { spawn, execSync } from 'child_process';
import net from 'net';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const REPORT_DIR = path.join(ROOT_DIR, 'reports');

// Configurações de Portas
const PORT_CONFIGS = [
  { port: 5000, name: 'Firebase Hosting Emulator' },
  { port: 9099, name: 'Firebase Auth Emulator' },
  { port: 8080, name: 'Firebase Firestore Emulator' },
  { port: 5001, name: 'Firebase Functions Emulator' },
  { port: 9199, name: 'Firebase Storage Emulator' },
  { port: 4000, name: 'Firebase UI' },
  { port: 4400, name: 'Firebase Hub' }
];

// Estado de rastreamento de processos para limpeza
let angularProcess = null;
let emulatorsStarted = false;

// Cores para o terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

// Estrutura para coletar dados do relatório
const reportData = {
  startTime: null,
  endTime: null,
  jobs: {
    'Build & Unit Tests': {
      status: 'PENDING',
      duration: 0,
      steps: []
    },
    'Security Scans (IaC, Secrets, DAST)': {
      status: 'PENDING',
      duration: 0,
      steps: []
    }
  }
};

/**
 * Verifica se uma porta TCP está ocupada
 */
function isPortBusy(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port);
  });
}

/**
 * Aguarda um serviço HTTP responder na porta
 */
function waitOnHttp(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Timeout aguardando por ${url}`));
        return;
      }
      http.get(url, (res) => {
        if (res.statusCode < 500) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        // Ignora erros de conexão e tenta novamente
      });
    }, 2000);
  });
}

/**
 * Executa um comando e retorna o status e a saída
 */
function runStep(name, command, cwd = ROOT_DIR, allowFailure = false) {
  console.log(`\n${colors.bright}${colors.cyan}▶ Executando: ${name}${colors.reset}`);
  console.log(`${colors.gray}$ ${command}${colors.reset}\n`);

  const startTime = Date.now();
  try {
    execSync(command, { stdio: 'inherit', cwd, env: { ...process.env, CI: 'true' } });
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.green}✓ ${name} concluído com sucesso em ${duration}s${colors.reset}`);
    return { name, status: 'SUCCESS', duration, error: null };
  } catch (err) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n${colors.red}✗ ${name} falhou após ${duration}s${colors.reset}`);
    if (allowFailure) {
      console.log(`${colors.yellow}⚠️ Falha ignorada (permitido nas configurações do pipeline)${colors.reset}`);
      return { name, status: 'SKIPPED_OR_ALLOWED_FAILURE', duration, error: err.message };
    }
    return { name, status: 'FAILED', duration, error: err.message };
  }
}


/**
 * Limpa processos e containers iniciados
 */
function cleanup() {
  console.log(`\n${colors.bright}${colors.yellow}🧹 Iniciando limpeza do ambiente de testes...${colors.reset}`);
  
  if (angularProcess) {
    console.log(`${colors.gray}Encerrando servidor do Angular...${colors.reset}`);
    try {
      angularProcess.kill('SIGTERM');
    } catch (e) {
      // Ignora erro
    }
  }

  if (emulatorsStarted) {
    console.log(`${colors.gray}Encerrando emuladores do Firebase (docker compose down)...${colors.reset}`);
    try {
      execSync('docker compose down', { stdio: 'ignore', cwd: ROOT_DIR });
    } catch (e) {
      console.error('Erro ao baixar containers:', e.message);
    }
  }

  console.log(`${colors.green}✓ Limpeza concluída!${colors.reset}\n`);
}

/**
 * Cria o arquivo de relatório em Markdown
 */
function generateMarkdownReport() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  const totalDuration = ((reportData.endTime - reportData.startTime) / 1000).toFixed(2);
  let md = `# Relatório de Simulação de CI - Tem-Fé\n\n`;
  md += `* **Data de Execução:** ${new Date().toLocaleString()}\n`;
  md += `* **Duração Total:** ${totalDuration}s\n`;
  
  const overallSuccess = Object.values(reportData.jobs).every(
    job => job.status === 'SUCCESS' || job.status === 'SUCCESS_WITH_WARNINGS'
  );
  md += `* **Status Geral:** ${overallSuccess ? '🟢 PASSOU' : '🔴 FALHOU'}\n\n`;

  md += `## Resumo dos Jobs\n\n`;
  md += `| Job | Status | Duração | Detalhes |\n`;
  md += `| --- | --- | --- | --- |\n`;

  for (const [jobName, job] of Object.entries(reportData.jobs)) {
    const jobStatusEmoji = job.status === 'SUCCESS' ? '🟢 SUCCESS' : job.status === 'SUCCESS_WITH_WARNINGS' ? '🟡 WARNINGS' : '🔴 FAILED';
    md += `| **${jobName}** | ${jobStatusEmoji} | ${job.duration}s | ${job.steps.length} etapas executadas |\n`;
  }

  md += `\n## Detalhes das Etapas\n\n`;

  for (const [jobName, job] of Object.entries(reportData.jobs)) {
    md += `### Job: ${jobName}\n\n`;
    md += `| Etapa | Status | Duração | Observações |\n`;
    md += `| --- | --- | --- | --- |\n`;
    for (const step of job.steps) {
      const stepEmoji = step.status === 'SUCCESS' ? '✅' : step.status === 'SKIPPED_OR_ALLOWED_FAILURE' ? '⚠️' : '❌';
      md += `| ${step.name} | ${stepEmoji} ${step.status} | ${step.duration}s | ${step.error ? `Erro: \`${step.error}\`` : '-'} |\n`;
    }
    md += `\n`;
  }

  const reportPath = path.join(REPORT_DIR, 'ci_simulation_report.md');
  fs.writeFileSync(reportPath, md);
  console.log(`\n${colors.bright}${colors.green}📄 Relatório Markdown salvo em: ${reportPath}${colors.reset}`);
}

/**
 * Exibe o resumo final no console de forma formatada
 */
function printSummaryTable() {
  console.log(`\n${colors.bright}========================================================================${colors.reset}`);
  console.log(`🏁  ${colors.bright}SUMÁRIO DA SIMULAÇÃO DO PIPELINE DE CI/CD${colors.reset}`);
  console.log(`========================================================================`);
  
  const totalDuration = ((reportData.endTime - reportData.startTime) / 1000).toFixed(2);
  console.log(`Duração Total: ${colors.bright}${totalDuration}s${colors.reset}`);
  
  for (const [jobName, job] of Object.entries(reportData.jobs)) {
    const jobColor = job.status === 'SUCCESS' ? colors.green : job.status === 'SUCCESS_WITH_WARNINGS' ? colors.yellow : colors.red;
    console.log(`\nJob: ${colors.bright}${jobName}${colors.reset} (${jobColor}${job.status}${colors.reset} - ${job.duration}s)`);
    
    for (const step of job.steps) {
      const stepColor = step.status === 'SUCCESS' ? colors.green : step.status === 'SKIPPED_OR_ALLOWED_FAILURE' ? colors.yellow : colors.red;
      const stepSymbol = step.status === 'SUCCESS' ? '✓' : step.status === 'SKIPPED_OR_ALLOWED_FAILURE' ? '⚠️' : '✗';
      console.log(`  ${stepColor}${stepSymbol} [${step.duration}s] ${step.name}${colors.reset}`);
    }
  }
  console.log(`========================================================================\n`);
}

/**
 * Executa as validações iniciais de porta
 */
async function runPortPrechecks() {
  console.log(`\n${colors.bright}🔍 Executando verificações de porta pré-CI...${colors.reset}`);
  let conflictFound = false;

  for (const cfg of PORT_CONFIGS) {
    const busy = await isPortBusy(cfg.port);
    if (busy) {
      console.error(`${colors.red}🛑 Conflito: A porta ${cfg.port} (${cfg.name}) já está em uso!${colors.reset}`);
      conflictFound = true;
    } else {
      console.log(`${colors.gray}  - Porta ${cfg.port} (${cfg.name}): ${colors.green}LIVRE${colors.reset}`);
    }
  }

  if (conflictFound) {
    console.error(`\n${colors.red}❌ Erro: Uma ou mais portas necessárias estão ocupadas.${colors.reset}`);
    console.error(`${colors.yellow}Por favor, encerre o ambiente de desenvolvimento local (como "npm run dev:local" ou containers Docker ativos) antes de rodar o simulador do CI.${colors.reset}\n`);
    process.exit(1);
  }
  console.log(`${colors.green}✓ Todas as portas críticas estão livres! Iniciando pipeline...${colors.reset}\n`);
}

/**
 * Executa o fluxo principal
 */
async function main() {
  // Captura sinais de encerramento para garantir cleanup
  process.on('SIGINT', () => {
    console.log(`\n\n${colors.red}🚨 Execução cancelada pelo usuário!${colors.reset}`);
    cleanup();
    process.exit(1);
  });
  
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(1);
  });

  // 1. Verificações de portas
  await runPortPrechecks();

  reportData.startTime = Date.now();

  // ========================================================================
  // JOB 1: Build & Unit Tests
  // ========================================================================
  console.log(`\n${colors.bright}========================================================================${colors.reset}`);
  console.log(`🚀 ${colors.bright}INICIANDO JOB: Build & Unit Tests${colors.reset}`);
  console.log(`========================================================================`);
  const job1Start = Date.now();
  const job1Steps = reportData.jobs['Build & Unit Tests'].steps;

  // Etapa 1.1: Garantir que dependências locais existem
  if (!fs.existsSync(path.join(ROOT_DIR, 'node_modules'))) {
    const s1 = runStep('Instalação de Dependências', 'npm install');
    job1Steps.push(s1);
    if (s1.status === 'FAILED') {
      reportData.jobs['Build & Unit Tests'].status = 'FAILED';
      reportData.endTime = Date.now();
      printSummaryTable();
      process.exit(1);
    }
  } else {
    job1Steps.push({ name: 'Instalação de Dependências (Ignorado - node_modules existente)', status: 'SUCCESS', duration: '0.00', error: null });
  }

  // Etapa 1.2: Rodar testes unitários Angular
  const s2 = runStep('Executar Testes Unitários (Karma Headless)', 'npm run test -- --no-watch --browsers=ChromeHeadless');
  job1Steps.push(s2);
  if (s2.status === 'FAILED') {
    reportData.jobs['Build & Unit Tests'].status = 'FAILED';
    reportData.endTime = Date.now();
    printSummaryTable();
    process.exit(1);
  }

  // Etapa 1.3: Copiar Configuração de Exemplo se necessário
  if (!fs.existsSync(path.join(ROOT_DIR, 'src', 'app', 'app.config.ts'))) {
    const s3 = runStep('Configurar Variáveis de Ambiente de Exemplo', 'cp src/app/app.config.example.ts src/app/app.config.ts');
    job1Steps.push(s3);
  } else {
    job1Steps.push({ name: 'Configurar Variáveis de Ambiente (Ignorado - app.config.ts já existe)', status: 'SUCCESS', duration: '0.00', error: null });
  }

  // Etapa 1.4: Compilar o projeto Angular
  const s4 = runStep('Build do Projeto Angular', 'npm run build');
  job1Steps.push(s4);
  if (s4.status === 'FAILED') {
    reportData.jobs['Build & Unit Tests'].status = 'FAILED';
    reportData.endTime = Date.now();
    printSummaryTable();
    process.exit(1);
  }

  reportData.jobs['Build & Unit Tests'].status = 'SUCCESS';
  reportData.jobs['Build & Unit Tests'].duration = ((Date.now() - job1Start) / 1000).toFixed(2);

  // ========================================================================
  // JOB 2: Security Scans (IaC, Secrets, DAST)
  // ========================================================================
  console.log(`\n${colors.bright}========================================================================${colors.reset}`);
  console.log(`🛡️  ${colors.bright}INICIANDO JOB: Security Scans (IaC, Secrets, DAST)${colors.reset}`);
  console.log(`========================================================================`);
  const job2Start = Date.now();
  const job2Steps = reportData.jobs['Security Scans (IaC, Secrets, DAST)'].steps;

  // Etapa 2.1: Gitleaks
  const sec1 = runStep('Gitleaks (Secret Detection)', 'npm run scan:secrets', ROOT_DIR, true);
  job2Steps.push(sec1);

  // Etapa 2.2: Checkov
  const sec2 = runStep('Checkov (IaC Scan)', 'npm run scan:checkov', ROOT_DIR, true);
  job2Steps.push(sec2);

  // Etapa 2.3: Snyk
  let snykAuth = false;
  if (process.env.SNYK_TOKEN) {
    snykAuth = true;
  } else {
    try {
      execSync('npx snyk whoami', { stdio: 'ignore', cwd: ROOT_DIR });
      snykAuth = true;
    } catch (e) {
      snykAuth = false;
    }
  }

  let sec3;
  if (snykAuth) {
    sec3 = runStep('Snyk (Dependency Scan)', 'npm run scan:snyk', ROOT_DIR, true);
  } else {
    console.log(`\n${colors.yellow}⚠️  Snyk ignorado: CLI do Snyk não está autenticada localmente.${colors.reset}`);
    console.log(`${colors.gray}Para habilitar este teste, rode "npx snyk auth" no terminal.${colors.reset}\n`);
    sec3 = { name: 'Snyk (Dependency Scan)', status: 'SKIPPED_OR_ALLOWED_FAILURE', duration: '0.00', error: 'CLI do Snyk não está autenticada localmente. Rode "npx snyk auth" para habilitar.' };
  }
  job2Steps.push(sec3);

  // Etapa 2.4: Inicialização dos Emuladores Firebase e Servidor Angular
  console.log(`\n${colors.bright}${colors.cyan}▶ Executando: Inicializar Emuladores Firebase e Servidor Angular${colors.reset}\n`);
  const emuStart = Date.now();
  try {
    console.log('📦 Instalando dependências e compilando Cloud Functions...');
    execSync('npm install --prefix functions', { stdio: 'inherit', cwd: ROOT_DIR });
    console.log('🐳 Subindo containers dos emuladores...');
    execSync('docker compose up --build -d firebase-emulators', { stdio: 'inherit', cwd: ROOT_DIR });
    emulatorsStarted = true;

    console.log('⏳ Aguardando emulador Auth responder...');
    await waitOnHttp('http://localhost:9099/', 60000);

    console.log('🌱 Alimentando o banco local (Seed Master)...');
    execSync('node scripts/seed-master.mjs', { stdio: 'inherit', cwd: ROOT_DIR });

    console.log('🚀 Iniciando o servidor de desenvolvimento do Angular (npm start)...');
    angularProcess = spawn('npm', ['start'], { cwd: ROOT_DIR, shell: true });

    console.log('⏳ Aguardando o servidor Angular responder em http://localhost:4200...');
    await waitOnHttp('http://localhost:4200/', 90000);

    const emuDuration = ((Date.now() - emuStart) / 1000).toFixed(2);
    console.log(`\n${colors.green}✓ Inicializar Emuladores Firebase e Angular concluído em ${emuDuration}s${colors.reset}`);
    job2Steps.push({ name: 'Inicializar Emuladores Firebase e Angular', status: 'SUCCESS', duration: emuDuration, error: null });
  } catch (err) {
    const emuDuration = ((Date.now() - emuStart) / 1000).toFixed(2);
    console.error(`\n${colors.red}✗ Inicializar Emuladores Firebase e Angular falhou após ${emuDuration}s${colors.reset}`);
    job2Steps.push({ name: 'Inicializar Emuladores Firebase e Angular', status: 'FAILED', duration: emuDuration, error: err.message });
    cleanup();
    reportData.jobs['Security Scans (IaC, Secrets, DAST)'].status = 'FAILED';
    reportData.endTime = Date.now();
    printSummaryTable();
    process.exit(1);
  }

  // Etapa 2.5: OWASP ZAP (Full Scan)
  // Aponta para a porta 4200 do dev server do Angular
  const zapCmd = 'node scripts/run-owasp.mjs http://localhost:4200 full';
  const sec4 = runStep('OWASP ZAP (Full Scan)', zapCmd, ROOT_DIR, false);
  job2Steps.push(sec4);

  // Etapa 2.6: Nuclei Scan
  // Aponta para a porta 4200 do dev server do Angular
  const nucleiCmd = 'docker run --rm --network host projectdiscovery/nuclei:latest -u http://localhost:4200';
  const sec5 = runStep('Nuclei (Vulnerability Scan)', nucleiCmd, ROOT_DIR, true);
  job2Steps.push(sec5);

  // 6. Limpeza final
  cleanup();

  // Define status do Job 2
  const job2Failed = job2Steps.some(step => step.status === 'FAILED');
  const job2HasWarnings = job2Steps.some(step => step.status === 'SKIPPED_OR_ALLOWED_FAILURE');
  reportData.jobs['Security Scans (IaC, Secrets, DAST)'].status = job2Failed ? 'FAILED' : job2HasWarnings ? 'SUCCESS_WITH_WARNINGS' : 'SUCCESS';
  reportData.jobs['Security Scans (IaC, Secrets, DAST)'].duration = ((Date.now() - job2Start) / 1000).toFixed(2);

  reportData.endTime = Date.now();

  // Apresenta resultados
  printSummaryTable();
  generateMarkdownReport();

  const finalSuccess = Object.values(reportData.jobs).every(
    job => job.status === 'SUCCESS' || job.status === 'SUCCESS_WITH_WARNINGS'
  );

  if (finalSuccess) {
    console.log(`${colors.green}${colors.bright}🎉 Parabéns! Todos os testes e validações passaram com sucesso!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.error(`${colors.red}${colors.bright}❌ Falha: Algumas etapas do pipeline falharam. Verifique os logs acima ou o relatório gerado.${colors.reset}\n`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Erro fatal no simulador de CI:', err);
  cleanup();
  process.exit(1);
});
