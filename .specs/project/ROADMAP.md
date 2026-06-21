# Roadmap (TEM-FE)

## Gestão de Membros
- [x] Listagem de membros (Básico)
- [x] Cadastro e Edição
- [x] Fatiamento de Dados (Basic, Private, Spiritual)
- [x] Sincronização em Tempo Real (onSnapshot)
- [ ] Upload de Foto para o Firebase Storage
- [ ] Exportação de Ficha de Membro (PDF)

## Gestão Financeira
- [x] Lançamentos de Entradas/Saídas
- [x] Categorias Customizáveis
- [x] Agendamentos de Transações Recorrentes
- [x] Sincronização em Tempo Real (onSnapshot)
- [ ] Relatórios e Gráficos Mensais (DRE)
- [x] Lançamento Automático via Cloud Function (Cron)

## Gestão de Estoque
- [x] Controle de Entrada/Saída
- [x] Alertas de Estoque Mínimo
- [x] Mesclagem de itens
- [ ] Histórico de movimentações por item

## Infraestrutura e Segurança
- [x] Autenticação (Email/Senha)
- [x] Firebase Emulators no Docker
- [x] Firestore Security Rules (Iniciais)
- [x] Migração para Plano Blaze
- [x] Resolução de Acesso (UI de Permissões)
- [x] Implementação de Custom Claims (Token JWT via Functions)
- [ ] Checkov (IaC Security)
- [ ] Snyk (Dependency Scan)
- [ ] Gitleaks (Secret Detection)
- [ ] Configuração de CI/CD (GitHub Actions/GCP)
- [ ] Cobertura de Testes Unitários > 80%
- [ ] Pentest Approval (OWASP/Nuclei)
