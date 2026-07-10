#!/usr/bin/env node

/**
 * Utilitário para executar varredura autenticada com OWASP ZAP.
 * 1. Faz login no emulador Auth com o usuário fornecido (padrão: consulente)
 * 2. Obtém o Token JWT (idToken)
 * 3. Inicia o ZAP injetando o cabeçalho Authorization: Bearer <Token>
 */

import { spawnSync } from 'child_process';
import process from 'process';
import fs from 'fs';

const targetUrl = process.argv[2] || 'http://localhost:4200';
const scanType = process.argv[3] || 'baseline'; // baseline ou full
const email = process.argv[4] || 'consulente@tem.local';
const password = process.argv[5] || 'senha123';

const authPort = process.env.FIREBASE_AUTH_PORT || '9099';
const apiKey = 'fake-api-key-emulator';

async function getToken() {
  const url = `http://localhost:${authPort}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  
  console.log(`🔑 Obtendo token JWT para o usuário ${email}...`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Erro na API de autenticação: ${res.statusText} - ${errText}`);
    }
    
    const data = await res.json();
    return data.idToken;
  } catch (err) {
    console.error('❌ Falha ao obter token JWT do Firebase Auth Emulator:', err.message);
    throw err;
  }
}

async function run() {
  try {
    const token = await getToken();
    console.log('✅ Token JWT obtido com sucesso!');

    const zapScript = scanType === 'full' ? 'zap-full-scan.py' : 'zap-baseline.py';
    
    // Configurações do Replacer para injetar o header Authorization no ZAP
    // Envolvemos as chaves e valores com aspas para que o parser do ZAP entenda o espaço
    const zapConfig = [
      '-config "replacer.full_list.rule(0).description=auth"',
      '-config "replacer.full_list.rule(0).enabled=true"',
      '-config "replacer.full_list.rule(0).matchtype=REQ_HEADER"',
      '-config "replacer.full_list.rule(0).matchstr=Authorization"',
      '-config "replacer.full_list.rule(0).regex=false"',
      `-config "replacer.full_list.rule(0).replacement=Bearer ${token}"`,
      '-config "replacer.full_list.rule(0).tokens=Authorization"',
      
      // Limite de navegadores simultâneos e de tempo (evita loops eternos em websockets)
      '-config "ajaxSpider.numberOfBrowsers=5"',
      '-config "ajaxSpider.maxDuration=5"',
      
      // Limites e otimizações do Active Scan (ascan) para acelerar a execução local e CI
      '-config "ascan.maxRuleDurationInMins=2"',
      '-config "ascan.threadPerHost=5"',
      
      // Excluir rotas de desenvolvimento do Vite/Angular que causam timeouts locais de File System no Docker
      '-config "globalexcludeurl.url_list.url(0).regex=.*\\/@fs\\/.*"',
      '-config "globalexcludeurl.url_list.url(0).description=vite-fs-files"',
      '-config "globalexcludeurl.url_list.url(0).enabled=true"',
      
      '-config "globalexcludeurl.url_list.url(1).regex=.*\\/node_modules\\/.*"',
      '-config "globalexcludeurl.url_list.url(1).description=node-modules-packages"',
      '-config "globalexcludeurl.url_list.url(1).enabled=true"',

      '-config "globalexcludeurl.url_list.url(2).regex=.*\\/@vite\\/.*"',
      '-config "globalexcludeurl.url_list.url(2).description=vite-dev-server-files"',
      '-config "globalexcludeurl.url_list.url(2).enabled=true"',

      '-config "globalexcludeurl.url_list.url(3).regex=.*\\.ts$"',
      '-config "globalexcludeurl.url_list.url(3).description=typescript-source-files"',
      '-config "globalexcludeurl.url_list.url(3).enabled=true"',
      
      '-config "globalexcludeurl.url_list.url(4).regex=.*\\/@ng\\/.*"',
      '-config "globalexcludeurl.url_list.url(4).description=vite-angular-compiler-files"',
      '-config "globalexcludeurl.url_list.url(4).enabled=true"',

      '-config "globalexcludeurl.url_list.url(5).regex=.*\\/media\\/.*"',
      '-config "globalexcludeurl.url_list.url(5).description=vite-media-assets"',
      '-config "globalexcludeurl.url_list.url(5).enabled=true"',

      '-config "globalexcludeurl.url_list.url(6).regex=.*\\/media$"',
      '-config "globalexcludeurl.url_list.url(6).description=vite-media-endpoint"',
      '-config "globalexcludeurl.url_list.url(6).enabled=true"',
      
      // Argumentos do Selenium no Docker para evitar travamentos e poupar memória
      '-config "selenium.chromeArgs.arg(0).argument=--no-sandbox"',
      '-config "selenium.chromeArgs.arg(1).argument=--disable-dev-shm-usage"',
      '-config "selenium.chromeArgs.arg(2).argument=--disable-gpu"'
    ].join(' ');

    // Garantir que a pasta reports exista para receber o relatório do scan
    if (!fs.existsSync('reports')) {
      fs.mkdirSync('reports', { recursive: true });
    }

    const reportFile = `reports/zap_report_${scanType}.html`;

    const dockerArgs = [
      'run', '--rm', '--network', 'host',
      '-e', 'PYTHONUNBUFFERED=1',
      '-v', `${process.cwd()}:/zap/wrk/:rw`,
      'ghcr.io/zaproxy/zaproxy:stable',
      zapScript,
      '-t', targetUrl,
      '-c', 'zap-rules.conf',
      '-z', zapConfig
    ];

    if (scanType === 'full') {
      dockerArgs.push('-j');
    }

    // Adiciona o parâmetro de relatório do ZAP
    dockerArgs.push('-r', reportFile);
    
    console.log(`🚀 Iniciando varredura OWASP ZAP (${scanType}) autenticada contra ${targetUrl}...`);
    // Exibe o comando com o token oculto por motivos de segurança
    const displayArgs = dockerArgs.map(arg => arg.includes(token) ? arg.replace(token, '[REDACTED_JWT_TOKEN]') : arg);
    console.log(`$ docker ${displayArgs.join(' ')}\n`);

    const result = spawnSync('docker', dockerArgs, { stdio: 'inherit' });
    
    if (result.status !== 0) {
      const err = new Error(`OWASP ZAP retornou código de saída ${result.status}`);
      err.status = result.status;
      throw err;
    }
    
    console.log(`✓ Varredura OWASP ZAP concluída com sucesso! Relatório gerado em: ${reportFile}`);
  } catch (err) {
    console.error('❌ Erro na varredura OWASP ZAP:', err.message);
    process.exit(err.status || 1);
  }
}

run();
