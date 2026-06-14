# Copilot Instructions - Projeto TEM-FE

## Objetivo do Projeto
O **TEM-FE** é um sistema de gestão completo para terreiros de religiões afro-brasileiras. O foco principal é centralizar a administração de membros, financeiro e estoque, permitindo que a liderança espiritual foque na caridade, enquanto a tecnologia cuida da burocracia. O sistema utiliza o plano **Blaze (Pay-as-you-go) do Firebase** para habilitar o uso de **Cloud Functions**, mantendo a prioridade na economia de recursos e alta segurança.

---

## 🛡️ Segurança e Integridade
O sistema segue os mais altos padrões de segurança para proteção de dados sensíveis e religiosos.
- **Custom Claims (JWT):** As permissões de acesso não são mais buscadas via Firestore rules (`get()`), mas injetadas diretamente no Token do usuário via Cloud Function. Isso reduz custos de leitura e aumenta a segurança.
- **Permissions Isolation:** A coleção de permissões reais será movida para um local inacessível ao frontend (ex: `_internal_permissions`), sendo manipulada exclusivamente por Cloud Functions.
- **Pentesting Compliance:** O projeto deve ser aprovado em varreduras de ferramentas como **OWASP ZAP**, **Nuclei**, **Checkov**, **Snyk**, **Gitleaks** e **SQLmap**.
- **Security Rules:** Proteção a nível de servidor (Firestore) validando fatias de dados através dos Custom Claims presentes no token.
- **Data Slicing:** Separação física de dados básicos, sensíveis e espirituais.

---

## ⚡ Cloud Functions & Automação
Com o plano Blaze, implementamos lógicas de backend robustas:
1.  **Sincronização de Permissões:** Uma Cloud Function disparada no login (ou via trigger de atualização) que consolida as permissões do usuário e do cargo nos Custom Claims do Firebase Auth.
2.  **Agendamento de Pagamentos (Cron):** Uma tarefa diária que verifica `scheduled_transactions` e realiza os lançamentos automáticos no financeiro.
3.  **Processamento de Imagens:** Redimensionamento e otimização de fotos de membros no Storage.

---

## 🧪 Estratégia de Testes
Iniciando a cultura de qualidade total:
- **Testes Unitários:** Validação de lógicas de serviço, validadores customizados e pipes.
- **Testes de Integração:** Fluxos completos entre componentes e serviços do Firebase (usando emuladores).
- **Testes de Cloud Functions:** Garantia de que as lógicas de backend e segurança estão íntegras.

---

## ✅ Checklist de Progresso

### Gestão de Membros
- [x] Listagem de membros (Básico)
- [x] Cadastro e Edição
- [x] **Fatiamento de Dados (Basic, Private, Spiritual)**
- [x] **Sincronização em Tempo Real (onSnapshot)**
- [ ] Upload de Foto para o Firebase Storage
- [ ] Exportação de Ficha de Membro (PDF)

### Gestão Financeira
- [x] Lançamentos de Entradas/Saídas
- [x] Categorias Customizáveis
- [x] Agendamentos de Transações Recorrentes
- [ ] **Sincronização em Tempo Real (onSnapshot)**
- [ ] Relatórios e Gráficos Mensais (DRE)
- [ ] **Lançamento Automático via Cloud Function (Cron)**

### Gestão de Estoque
- [x] Controle de Entrada/Saída
- [x] Alertas de Estoque Mínimo
- [x] Mesclagem de itens
- [ ] Histórico de movimentações por item

### Infraestrutura e Segurança
- [x] Autenticação (Email/Senha)
- [x] Firebase Emulators no Docker
- [x] Firestore Security Rules (Iniciais)
- [x] **Migração para Plano Blaze**
- [x] **Resolução de Acesso (UI de Permissões e Lógica de Cargos)**
- [ ] **Implementação de Custom Claims (Token JWT)**
- [ ] **Checkov (IaC Security)**
- [ ] **Snyk (Dependency Scan)**
- [ ] **Gitleaks (Secret Detection)**
- [ ] Configuração de CI/CD (GitHub Actions/GCP)
- [ ] Cobertura de Testes Unitários > 80%
- [ ] Pentest Approval (OWASP/Nuclei)

---

## Funcionalidades Implementadas (Detalhado)

### 1. Dashboard
- Resumo visual de membros ativos e alertas de estoque.
- Mural de avisos (Notices) integrados.

### 2. Arquitetura Sliced
- `members`: Nome, Foto, Cargo.
- `members_private`: CPF, Endereço, Telefone.
- `members_spiritual`: Rituais, Orixás, Observações.

### 3. Shared Components
- **GenericListComponent:** Tabela Material reaproveitável com filtros e ordenação.
- **InputMaskDirective:** Máscaras de CPF, CEP e Telefone nativas.

---

## Comandos Principais
```bash
npm start          # Servidor dev em http://localhost:4200
npm run dev:local  # SOBE TUDO: Emuladores + Seed + Angular
node scripts/seed-master.mjs # Repopula o banco local fatiado
```
