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

## 🧪 Estratégia de Testes e Aprendizados Atuais
Iniciando a cultura de qualidade total:
- **Testes Unitários:** Validação de lógicas de serviço, validadores customizados e pipes.
- **Testes de Integração:** Fluxos completos entre componentes e serviços do Firebase (usando emuladores).
- **Testes de Cloud Functions:** Garantia de que as lógicas de backend e segurança estão íntegras.

**O Que Aprendemos Hoje (Angular 22 + Firebase Modular):**
1. **Restrições de Espionagem (spyOn):** O Angular 20 rodando pacotes ESM (ES Modules) bloqueia o `spyOn` direto em importações puras. Para resolver isso, criamos o wrapper `FbUtils` que exporta as funções de forma espionável.
2. **Bash Variable Interpolation:** Evitar comandos `node -e " ... $1 "` pelo terminal. O Bash avalia `$1` como vazio, o que quebrou as strings do `spyOn`. Para operações globais (Regex/AST) em vários arquivos, **sempre utilize um script Node independente (como `migrate_fbutils.js`)**.
3. **TypeScript Inference na Ternária:** Para contornar a falha em mocks repetidos e ao mesmo tempo satisfazer a tipagem estrita do compilador sem o erro `Property 'and' does not exist`, a sintaxe exata e segura que escrevemos no `migrate_fbutils.js` é:
   `(((FbUtils.metodo as any)?.and ? FbUtils.metodo : spyOn(FbUtils, 'metodo')) as any)`
4. **Resolução de Conflitos (ERESOLVE) no Upgrade do Angular:** Nunca utilize a flag `--legacy-peer-deps` cegamente ao fazer upgrades de versão maior (`ng update`). Para pacotes que ficam defasados e não são atualizados automaticamente pelo script do Angular (ex: `@angular/fire`), edite o `package.json` manualmente para alinhar a versão do pacote com a nova geração do Angular, limpe o cache (`rm -rf node_modules package-lock.json && npm cache clean --force`) e rode um `npm install` limpo. O script de migração do Angular pode travar com erros nativos de corrupção do NPM (`Cannot read properties of null (reading 'children')`) caso isso não seja feito adequadamente.
5. **Status Atual e Próximos Passos:** 
   - Upgrade para o Angular 22 realizado com sucesso.
   - 100% dos testes unitários estão passando, com cobertura em ~70.6%. A meta de 80% continua.
   - Foram implementadas as exportações (xlsx) e melhorias nos relatórios financeiros (DRE).
   - **PRIMEIRO PASSO DA PRÓXIMA SESSÃO:** Testar a edição de dados pessoais (Telefone e Endereço) pelo próprio usuário na aba "Meu Perfil" e validar preenchimento automático do ViaCEP. Em seguida, iniciar a implementação do módulo de Vendas (PDV / Frente de Caixa).
----

## ✅ Checklist de Progresso

### Gestão de Membros
- [x] Listagem de membros (Básico)
- [x] Cadastro e Edição
- [x] **Fatiamento de Dados (Basic, Private, Spiritual)**
- [x] **Sincronização em Tempo Real (onSnapshot)**
- [x] Upload de Foto para o Firebase Storage
- [ ] Exportação de Ficha de Membro (PDF)

### Gestão Financeira
- [x] Lançamentos de Entradas/Saídas
- [x] Categorias Customizáveis
- [x] Agendamentos de Transações Recorrentes
- [x] **Sincronização em Tempo Real (onSnapshot)**
- [x] Relatórios e Gráficos Mensais (DRE)
- [x] **Lançamento Automático via Cloud Function (Cron)**

### Gestão de Estoque
- [x] Controle de Entrada/Saída
- [x] Alertas de Estoque Mínimo
- [x] Mesclagem de itens
- [ ] Histórico de movimentações por item
- [ ] Inclusão de Preços nos Itens do Estoque

### Vendas e PDV (Frente de Caixa)
- [ ] Criação de Página de Vendas (acesso restrito sem expor financeiro completo)
- [ ] Baixa automática de estoque ao realizar venda
- [ ] Bloqueio/alerta para venda com itens em estoque negativo
- [ ] Integração do PDV gerando lançamentos financeiros (DRE)

### Infraestrutura e Segurança
- [x] Autenticação (Email/Senha)
- [x] Firebase Emulators no Docker
- [x] Firestore Security Rules (Iniciais)
- [x] **Migração para Plano Blaze**
- [x] **Resolução de Acesso (UI de Permissões e Lógica de Cargos)**
- [x] **Implementação de Custom Claims (Token JWT)**
- [x] **Checkov (IaC Security)**
- [x] **Snyk (Dependency Scan)**
- [x] **Gitleaks (Secret Detection)**
- [x] Configuração de CI/CD (GitHub Actions/GCP)
- [ ] Cobertura de Testes Unitários > 80%
- [x] Pentest Approval (OWASP/Nuclei)
- [ ] Resolver vulnerabilidades e débitos técnicos em pacotes legados reportados pelo Socket Security (tar, xlsx, form-data, zone.js)

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
