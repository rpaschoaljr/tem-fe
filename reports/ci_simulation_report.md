# Relatório de Simulação de CI - Tem-Fé

* **Data de Execução:** 09/07/2026, 23:01:07
* **Duração Total:** 188.18s
* **Status Geral:** 🔴 FALHOU

## Resumo dos Jobs

| Job | Status | Duração | Detalhes |
| --- | --- | --- | --- |
| **Build & Unit Tests** | 🟢 SUCCESS | 31.01s | 4 etapas executadas |
| **Security Scans (IaC, Secrets, DAST)** | 🔴 FAILED | 157.18s | 6 etapas executadas |

## Detalhes das Etapas

### Job: Build & Unit Tests

| Etapa | Status | Duração | Observações |
| --- | --- | --- | --- |
| Instalação de Dependências (Ignorado - node_modules existente) | ✅ SUCCESS | 0.00s | - |
| Executar Testes Unitários (Karma Headless) | ✅ SUCCESS | 12.46s | - |
| Configurar Variáveis de Ambiente (Ignorado - app.config.ts já existe) | ✅ SUCCESS | 0.00s | - |
| Build do Projeto Angular | ✅ SUCCESS | 18.55s | - |

### Job: Security Scans (IaC, Secrets, DAST)

| Etapa | Status | Duração | Observações |
| --- | --- | --- | --- |
| Gitleaks (Secret Detection) | ✅ SUCCESS | 2.51s | - |
| Checkov (IaC Scan) | ✅ SUCCESS | 9.25s | - |
| Snyk (Dependency Scan) | ⚠️ SKIPPED_OR_ALLOWED_FAILURE | 6.96s | Erro: `Command failed: npm run scan:snyk` |
| Inicializar Emuladores Firebase e Angular | ✅ SUCCESS | 36.59s | - |
| OWASP ZAP (Full Scan) | ❌ FAILED | 61.44s | Erro: `Command failed: node scripts/run-owasp.mjs http://localhost:4200 full` |
| Nuclei (Vulnerability Scan) | ✅ SUCCESS | 27.66s | - |

