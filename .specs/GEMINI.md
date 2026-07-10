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

**O Que Aprendemos Hoje (Angular 22 + Firebase Modular & DAST):**
1. **Restrições de Espionagem (spyOn):** O Angular 20 rodando pacotes ESM (ES Modules) bloqueia o `spyOn` direto em importações puras. Para resolver isso, criamos o wrapper `FbUtils` que exporta as funções de forma espionável.
2. **Bash Variable Interpolation:** Evitar comandos `node -e " ... $1 "` pelo terminal. O Bash avalia `$1` como vazio, o que quebrou as strings do `spyOn`. Para operações globais (Regex/AST) em vários arquivos, **sempre utilize um script Node independente (como `migrate_fbutils.js`)**.
3. **TypeScript Inference na Ternária:** Para contornar a falha em mocks repetidos e ao mesmo tempo satisfazer a tipagem estrita do compilador sem o erro `Property 'and' does not exist`, a sintaxe exata e segura que escrevemos no `migrate_fbutils.js` is:
   `(((FbUtils.metodo as any)?.and ? FbUtils.metodo : spyOn(FbUtils, 'metodo')) as any)`
4. **Resolução de Conflitos (ERESOLVE) no Upgrade do Angular:** Nunca utilize a flag `--legacy-peer-deps` cegamente ao fazer upgrades de versão maior (`ng update`). Para pacotes que ficam defasados e não são atualizados automaticamente pelo script do Angular (ex: `@angular/fire`), edite o `package.json` manualmente para alinhar a versão do pacote com a nova geração do Angular, limpe o cache (`rm -rf node_modules package-lock.json && npm cache clean --force`) e rode um `npm install` limpo.
5. **Integração de Módulos (PDV):** Ao trabalhar com regras de negócio cruzadas (Vendas afetando Estoque e Financeiro), a interface de PDV foi desenhada para otimizar o fluxo de caixa. O Histórico de Vendas substitui visualmente o catálogo, e a edição de vendas foi desenhada como um "estorno + recarga do carrinho" para evitar inconsistências contábeis.
6. **Prevenção de Estoque Negativo:** O uso de tipagem estrita `Number(...)` para estoque e validação do booleano `allowBackorder === true` tanto no frontend quanto no backend previne falhas de comparação dinâmica causadas por valores nulos, strings ou indefinidos no Firestore.
7. **Integração com Categoria de Doação:** Em entidades religiosas, transações de frente de caixa/venda não devem ser registradas sob categorias comerciais genéricas como "VENDAS", mas sim como **DOAÇÃO**. Isto alinha as vendas com o plano de contas regulamentar e simplifica a auditoria da "Doação Real" (Valor doado - Custo dos itens).
8. **Pentest DAST contra Build de Produção em Emuladores:** Configurar os testes DAST (como o OWASP ZAP e o Nuclei) para rodarem diretamente contra a porta do emulador de Hosting do Firebase (`http://localhost:5000`) em vez do servidor de desenvolvimento local. Isso elimina ruídos de desenvolvimento (como `'unsafe-eval'` na CSP) e garante conformidade 100% real com as regras de cache, segurança e headers configuradas no `firebase.json` de produção.
9. **Roteamento de Cache Segmentado no Firebase Hosting:** O Firebase Hosting processa regras de cabeçalhos baseando-se no caminho solicitado originalmente (`source`), e não no destino do rewrite (`/index.html`). Para garantir que as rotas SPA enviem `no-store` enquanto os assets estáticos sejam cacheados por 1 ano (`immutable`), configuramos a regra padrão `**` com `no-store` e aplicamos uma regra secundária com regex de extensões estáticas (`**/*.@(js|css|...)`) sobrescrevendo a validade de cache.
10. **Supressão de Falsos Positivos via Baseline Rules no ZAP:** Em pipelines de CI profissionais, falsos positivos provenientes de dependências consolidadas (como Zone.js e Firebase SDK) são devidamente catalogados e ignorados em um arquivo `zap-rules.conf` carregado pelo Docker do ZAP. Isso impede a quebra de build por motivos externos não-vulneráveis sem anular a seriedade dos testes.
11. **Exclusão Global de URLs do Dev-Server (Vite/Angular) no Pentest DAST:** Ao rodar varreduras ativas contra a porta `4200` (dev-server), o Vite expõe o sistema de arquivos local (`/@fs/`), links internos do compilador (`/@ng/`, `/@vite/`) e mídias (`/media`), além de expor o `node_modules` avulso. Varredores ativos (como o ZAP) tentarão atacar cada um desses arquivos, gerando timeouts de soquete (`ZapSocketTimeoutException: Read timed out`) e travando o pipeline. Configurar o ZAP com expressões regulares globais de exclusão (`globalexcludeurl`) para ignorar esses caminhos garante que o teste varra apenas as rotas reais da aplicação SPA e execute em menos de 2 minutos.
12. **Otimização de Active Scan em CI/CD com ZAP:** Para evitar travamentos silenciosos em regras de varredura ativas longas baseadas em tempo (como `SstiBlindScanRule` que testa sleeps de 15s), configuramos o ZAP com limites máximos de execução de regra (`ascan.maxRuleDurationInMins=2`), paralelismo de requisições (`ascan.threadPerHost=5`) e ignoramos ativamente regras inúteis para a nossa stack (como SSTI 90035/6, LDAP 40015, e EL Java 90025) e falsos positivos do Vite de CORS (`40040`) no `zap-rules.conf`.
13. **Status Atual e Próximos Passos:** 
    - Pentest Approval (OWASP ZAP e Nuclei) concluídos com 100% de sucesso real. Todas as falhas reais de segurança foram solucionadas, os falsos positivos de terceiros foram mapeados legitimamente e o Full Scan com Ajax Spider foi totalmente configurado e otimizado no CI local.
    - PRÓXIMOS PASSOS: Resolver as vulnerabilidades e débitos técnicos em pacotes legados reportados pelo Socket Security (tar, xlsx, form-data, zone.js).
14. **Cálculo de Precedência de Mensalidades:** O cálculo de descontos segue a ordem de prioridade: `Isento > Desconto Individual (%) > Desconto de Curso (%) > Valor Base`, aplicado de forma dinâmica e transparente na tela de lançamento financeiro e no backend.
15. **Acesso Seguro a Dados Contábeis via Callable Functions:** A consulta ao status de atraso de mensalidades de membros comuns é encapsulada na Cloud Function Callable `getMyDuesStatus` que localiza o membro por e-mail extraído do token JWT autenticado (já que IDs de membros são gerados randomicamente e não batem com o UID do Auth). Isso protege as informações financeiras gerais impedindo acesso de leitura direto a transações por usuários comuns.
16. **Detecção de Emuladores em Portas Estáticas Locais:** O uso de `isDevMode()` em Angular retorna falso quando a build é compilada com a configuração de produção, quebrando a comunicação com os emuladores ao rodar na porta 5000 do Hosting local. Solucionamos isso estendendo o verificador para verificar se o hostname da página é `localhost` ou `127.0.0.1`.
17. **Políticas de CORP/COEP Restritivas com Emuladores:** O cabeçalho `Cross-Origin-Embedder-Policy: require-corp` causa bloqueios no carregamento de subrecursos locais em portas cruzadas (como o WebChannel do emulador do Firestore na porta 8080). Para possibilitar testes emulados eficientes no localhost, removemos as diretivas de COOP/COEP/CORP do `firebase.json` e do `angular.json` dev-server.
----

## ✅ Checklist de Progresso

### Gestão de Membros
- [x] Listagem de membros (Básico)
- [x] Cadastro e Edição
- [x] **Fatiamento de Dados (Basic, Private, Spiritual)**
- [x] **Sincronização em Tempo Real (onSnapshot)**
- [x] Upload de Foto para o Firebase Storage
- [ ] Exportação de Ficha de Membro (PDF) (Adiado pós-lançamento)

### Gestão Financeira
- [x] Lançamentos de Entradas/Saídas
- [x] Categorias Customizáveis
- [x] Agendamentos de Transações Recorrentes
- [x] **Sincronização em Tempo Real (onSnapshot)**
- [x] Relatórios e Gráficos Mensais (DRE)
- [x] **Lançamento Automático via Cloud Function (Cron)**
- [x] Alerta de mensalidade atrasada/vencendo personalizada no Dashboard (Privada por usuário)

### Gestão de Estoque
- [x] Controle de Entrada/Saída
- [x] Alertas de Estoque Mínimo
- [x] Mesclagem de itens
- [ ] Histórico de movimentações por item
- [x] Inclusão de Preços nos Itens do Estoque

### Vendas e PDV (Frente de Caixa)
- [x] Criação de Página de Vendas (acesso restrito sem expor financeiro completo)
- [x] Bloqueio/alerta para venda com itens em estoque negativo (Permitir "Sob Encomenda")
- [x] Histórico de vendas com estorno e recarga de carrinho
- [x] Baixa automática de estoque ao realizar venda
- [x] Integração do PDV gerando lançamentos financeiros (DRE)

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
- [x] Configuração do OWASP ZAP (Full Scan com Ajax Spider Autenticado e Relatório Completo)
- [ ] Resolver vulnerabilidades e débitos técnicos em pacotes legados reportados pelo Socket Security (tar, xlsx, form-data, zone.js)
- [x] **Auditoria Geral (Triggers no Backend & Aba de Auditoria com Diffs)**
- [x] **Resolução de CSP / Otimização de Critical CSS no angular.json para Hosting**
- [x] **Configuração de Emuladores locais em cabeçalhos de CSP de firebase.json**

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
