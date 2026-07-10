# Relatório de Simulação de CI - Tem-Fé

* **Data de Execução:** 09/07/2026, 23:20:26
* **Duração Total:** 444.92s
* **Status Geral:** 🔴 FALHOU

## Resumo dos Jobs

| Job | Status | Duração | Detalhes |
| --- | --- | --- | --- |
| **Build & Unit Tests** | 🟢 SUCCESS | 31.55s | 4 etapas executadas |
| **Security Scans (IaC, Secrets, DAST)** | 🔴 FAILED | 413.37s | 7 etapas executadas |

## Detalhes das Etapas

### Job: Build & Unit Tests

| Etapa | Status | Duração | Observações |
| --- | --- | --- | --- |
| Instalação de Dependências (Ignorado - node_modules existente) | ✅ SUCCESS | 0.00s | - |
| Executar Testes Unitários (Karma Headless) | ✅ SUCCESS | 12.41s | - |
| Configurar Variáveis de Ambiente (Ignorado - app.config.ts já existe) | ✅ SUCCESS | 0.00s | - |
| Build do Projeto Angular | ✅ SUCCESS | 19.14s | - |

### Job: Security Scans (IaC, Secrets, DAST)

| Etapa | Status | Duração | Observações |
| --- | --- | --- | --- |
| Gitleaks (Secret Detection) | ✅ SUCCESS | 2.66s | - |
| Checkov (IaC Scan) | ✅ SUCCESS | 9.57s | - |
| Snyk (Dependency Scan) | ⚠️ SKIPPED_OR_ALLOWED_FAILURE | 6.43s | Erro: `Command failed: npm run scan:snyk` |
| Inicializar Emuladores Firebase e Angular | ✅ SUCCESS | 42.61s | - |
| OWASP ZAP (Baseline Scan) | ❌ FAILED | 38.73s | Erro: `Command failed: node scripts/run-owasp.mjs http://localhost:4200 baseline` |
| OWASP ZAP (Full Scan) | ❌ FAILED | 120.75s | Erro: `Command failed: node scripts/run-owasp.mjs http://localhost:4200 full` |
| Nuclei (Vulnerability Scan) | ✅ SUCCESS | 180.24s | - |

