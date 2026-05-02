# Copilot Instructions - Projeto TEM-FE

## Objetivo do Projeto
O **TEM-FE** é um sistema de gestão completo para terreiros de religiões afro-brasileiras. O foco principal é centralizar a administração de membros, financeiro e estoque, permitindo que a liderança espiritual foque na caridade, enquanto a tecnologia cuida da burocracia. O sistema é otimizado para o plano **Spark (Gratuito) do Firebase**, priorizando economia de banda (360MB/dia) e leituras/escritas (50k/20k dia).

---

## 🛡️ Segurança e Integridade
O sistema deve seguir os mais altos padrões de segurança para proteção de dados sensíveis e religiosos.
- **Pentesting Compliance:** O projeto deve ser aprovado em varreduras de ferramentas como **OWASP ZAP**, **Nuclei**, **Checkov**, **Snyk**, **Gitleaks** e **SQLmap** (testando contra NoSQL injection e falhas de lógica).
- **Security Rules:** Proteção a nível de servidor (Firestore) para garantir que apenas usuários autorizados acessem fatias específicas de dados.
- **Data Slicing:** Separação física de dados básicos, sensíveis e espirituais.

## 🧪 Estratégia de Testes
Iniciando a cultura de qualidade total:
- **Testes Unitários:** Validação de lógicas de serviço, validadores customizados e pipes.
- **Testes de Integração:** Fluxos completos entre componentes e serviços do Firebase (usando emuladores).
- **Garantia de Qualidade:** Cada nova funcionalidade deve vir acompanhada de sua respectiva suíte de testes.

## 🚀 DevOps & CI/CD
- **Pipeline:** Configuração de CI/CD para automação de testes, build e deploy.
- **Ambientes:** Separação clara entre Desenvolvimento (Emuladores), Staging e Produção.

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
- [ ] Relatórios e Gráficos Mensais

### Gestão de Estoque
- [x] Controle de Entrada/Saída
- [x] Alertas de Estoque Mínimo
- [x] Mesclagem de itens
- [ ] Histórico de movimentações por item

### Infraestrutura e Segurança
- [x] Autenticação (Email/Senha)
- [x] Firebase Emulators no Docker
- [x] Firestore Security Rules (Iniciais)
- [ ] **Custom Claims no Token (JWT)**
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
