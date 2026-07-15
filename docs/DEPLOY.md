# Guia de Publicação no Firebase (Produção)

Este guia descreve como publicar o **Tem-Fé** no projeto Firebase de produção (`sistematemfe`). O ambiente local de desenvolvimento continua usando o projeto de emulador `demo-sistematemfe` — nada aqui afeta esse fluxo.

## Estado atual do setup (atualizado em 2026-07-15)

Já provisionado e configurado:

- [x] Projeto Firebase `sistematemfe` (Web App "Tem fé" registrado)
- [x] Database Firestore `(default)` criado em `southamerica-east1`
- [x] Auth com provedor e-mail/senha habilitado
- [x] API do Firebase Storage habilitada
- [x] API key web restrita (referrers `sistematemfe.web.app`/`sistematemfe.firebaseapp.com`; APIs: identitytoolkit, securetoken, firestore, firebasestorage, firebaseinstallations) — mitiga a chave exposta no histórico do git
- [x] Service account `github-deploy@sistematemfe.iam.gserviceaccount.com` com `roles/firebase.admin`, `roles/cloudfunctions.admin`, `roles/iam.serviceAccountUser`, `roles/run.admin`
- [x] Secrets no GitHub: `GCP_SA_KEY` e `PROD_APP_CONFIG_TS`
- [x] Job `deploy` no CI (gatilho: push na master ou manual), desligado por `DEPLOY_ENABLED=false`

**Pendente (bloqueado pelo plano de billing):**

- [ ] **Ativar o plano Blaze**: <https://console.firebase.google.com/project/sistematemfe/usage/details> — necessário para Functions e para o bucket do Storage. Com ~3 usuários o custo esperado é R$ 0 (as cotas gratuitas continuam no Blaze; só o storage em São Paulo e o registro de imagens de deploy custam centavos).
- [ ] Após o Blaze, na ordem: criar o bucket padrão do Storage (região `southamerica-east1`), configurar alerta de orçamento (R$ 10–20), rodar `gh variable set DEPLOY_ENABLED --body true` e disparar o primeiro deploy (aba Actions → Run workflow).
- [ ] Pós-primeiro-deploy: criar o usuário admin (seção 7) e validar o fluxo de login.

## 1. Pré-requisitos

- Conta Google com acesso ao [Console do Firebase](https://console.firebase.google.com).
- Node na versão do `.nvmrc` e dependências instaladas (`npm ci`).
- Firebase CLI — já está em `devDependencies` (`firebase-tools`); use via `npx firebase ...`.
- **Plano Blaze** (pagamento por uso) no projeto de produção — obrigatório para Cloud Functions v2. Configure um **alerta de orçamento** no Google Cloud antes do primeiro deploy.

Login na CLI:

```bash
npx firebase login
```

## 2. Criar o projeto de produção

1. No Console do Firebase, crie um projeto novo (ex.: `sistematemfe-prod`). **Não** use o id `demo-*` — esse prefixo é reservado para emuladores e os scripts de seed deste repo se recusam a rodar fora dele (de propósito).
2. Habilite os serviços:
   - **Authentication** → método **E-mail/senha**.
   - **Firestore** → modo produção, região **`southamerica-east1`** (a região já está fixada em `firebase.json` e nas Functions; usar outra região quebra o deploy).
   - **Storage** → região `southamerica-east1`.
3. Faça upgrade do projeto para o plano **Blaze** (Functions exigem).

## 3. Registrar o Web App e configurar credenciais

1. No console: **Configurações do projeto → Seus apps → Adicionar app → Web**.
2. Copie o objeto `firebaseConfig` gerado.
3. No repo, o arquivo real de configuração é `src/app/app.config.ts` — ele é **gitignored** (o CI usa `src/app/app.config.example.ts` com valores fake de emulador). Para o build de produção, preencha `app.config.ts` com os valores reais do console (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

Observações importantes:

- A `apiKey` web do Firebase **não é um segredo** (ela vai embutida no bundle publicado de qualquer forma) — a segurança real vem das Rules e do Auth. Ainda assim, **restrinja a chave** (passo 5.2).
- As conexões com emuladores em `app.config.ts` são guardadas por `isDevMode()` — o build de produção (`npm run build`) **não** tenta conectar em emuladores. Nenhuma mudança de código é necessária.
- Nunca commite `app.config.ts` com credenciais reais.

## 4. Apontar a CLI para o projeto de produção

O `.firebaserc` já tem os dois aliases configurados:

- `default` → `demo-sistematemfe` (emulador)
- `prod` → `sistematemfe` (produção)

Todos os comandos de deploy usam `-P prod` explicitamente — assim o alias `default` continua sendo o emulador e ninguém publica em produção por acidente. Se o project id de produção for outro, ajuste o valor de `prod` no `.firebaserc`.

## 5. Checklist de segurança pré-deploy

Faça **antes** do primeiro deploy:

1. **Rotacionar/restringir a API key exposta no histórico do git.** Uma chave `AIza…` do projeto demo vazou em um `firebase-debug.log` commitado no passado (hoje suprimida via `.gitleaksignore`). No [Google Cloud Console → APIs e Serviços → Credenciais](https://console.cloud.google.com/apis/credentials):
   - Se a chave pertencer a um projeto real, **regenere-a**.
   - Em **todas** as API keys (incluindo a nova de produção), aplique **restrição de aplicativo** (HTTP referrers: seu domínio `*.web.app` / `*.firebaseapp.com` / domínio próprio) e **restrição de APIs** (apenas Identity Toolkit, Token Service, Firestore, Storage).
   - Opcional, recomendado: reescrever o histórico do git com [BFG](https://rtyley.github.io/bfg-repo-cleaner/) ou `git filter-repo` para remover o log de vez.
2. **CSP em `firebase.json`**: já limpa — as origens de desenvolvimento (`localhost`/`127.0.0.1`) foram removidas do `connect-src`. Consequência local: o *preview via emulador de Hosting* de um build dev não consegue mais falar com os emuladores (o fluxo normal de dev é `ng serve`, que não usa esses headers e não é afetado).
3. **Rules**: confira que `firestore.rules` e `storage.rules` do repo são as versões atuais (as regras restritivas por permissão). O deploy abaixo publica exatamente esses arquivos.
4. **Dependência `xlsx`**: a versão `0.18.5` do npm tem CVEs conhecidos sem correção publicada no npm (Prototype Pollution CVE-2023-30533 e ReDoS CVE-2024-22363). O risco se aplica ao *parsear* planilhas de terceiros; se o app só *exporta*, o risco é baixo. Mitigações: migrar para o build oficial do CDN da SheetJS (`https://cdn.sheetjs.com`) ou para a lib `exceljs`.
5. **App Check** (recomendado): habilite o [Firebase App Check](https://firebase.google.com/docs/app-check) com reCAPTCHA Enterprise para Firestore/Storage/Functions, reduzindo abuso das APIs fora do app.

## 6. Build e deploy

```bash
# 1. Build do Angular (gera dist/tem-fe/browser, que o Hosting publica)
npm run build

# 2. Build das Functions
npm --prefix functions run build

# 3. Deploy completo
npx firebase deploy -P prod --only firestore:rules,firestore:indexes,storage,functions,hosting
```

Deploys parciais, quando precisar:

```bash
npx firebase deploy -P prod --only hosting          # só o front
npx firebase deploy -P prod --only firestore:rules  # só regras do Firestore
npx firebase deploy -P prod --only storage          # só regras do Storage
npx firebase deploy -P prod --only functions        # só as Functions
```

O app fica disponível em `https://<project-id>.web.app`. Para domínio próprio: **Hosting → Adicionar domínio personalizado** no console (o Firebase provisiona o certificado TLS automaticamente).

## 7. Pós-deploy: primeiro usuário admin

**Não rode os scripts de seed contra produção** (eles se recusam, por design). Crie o admin manualmente:

1. **Authentication → Adicionar usuário**: e-mail e senha do administrador real.
2. **Firestore**: crie o documento de membro em `members/{id}` (com o campo `email` igual ao do usuário criado) e o documento de permissão na coleção `permissions` seguindo o formato usado em `scripts/seed-master.mjs` (roles/hierarchyLevel). A Function `onPermissionUpdate` propaga as permissões para as custom claims do usuário automaticamente.
3. Faça login no app publicado, confirme o acesso de admin e cadastre os demais usuários pela própria interface.

Verifique também:

- Fluxo completo: login → dashboard → upload de foto de perfil (valida as novas regras de Storage) → troca de senha.
- **Functions logs** no console (erros de região/permissão aparecem lá).
- Alerta de orçamento ativo no Google Cloud Billing.

## 8. Deploy automático no CI (já implementado)

O workflow `.github/workflows/ci.yml` tem um job **`deploy`** que publica hosting, rules, indexes e functions no projeto `prod` (`sistematemfe`). Ele roda **após** build/testes e scans passarem, em push na `master` ou disparo manual (aba *Actions → Run workflow*), e fica **desligado** até a variável `DEPLOY_ENABLED` ser `true`.

### Ativação (uma única vez)

> **Passos 1 e 2 já executados** (service account criada e secrets `GCP_SA_KEY`/`PROD_APP_CONFIG_TS` gravados — ver "Estado atual do setup" no topo). Ficam documentados abaixo para reprodutibilidade (ex.: rotação da chave da SA).

1. **Crie a service account de deploy** no projeto de produção (requer [gcloud CLI](https://cloud.google.com/sdk) logado, ou faça o equivalente no console IAM):

   ```bash
   gcloud iam service-accounts create github-deploy --project sistematemfe

   for role in roles/firebase.admin roles/cloudfunctions.admin roles/iam.serviceAccountUser roles/run.admin; do
     gcloud projects add-iam-policy-binding sistematemfe \
       --member "serviceAccount:github-deploy@sistematemfe.iam.gserviceaccount.com" --role "$role"
   done

   gcloud iam service-accounts keys create sa-key.json \
     --iam-account github-deploy@sistematemfe.iam.gserviceaccount.com
   ```

2. **Cadastre os secrets no GitHub** (rode você mesmo, os valores são sensíveis):

   ```bash
   gh secret set GCP_SA_KEY < sa-key.json && rm sa-key.json
   gh secret set PROD_APP_CONFIG_TS < src/app/app.config.ts   # versão com credenciais REAIS de produção
   ```

   > O `PROD_APP_CONFIG_TS` é o conteúdo completo do `app.config.ts` de produção. Monte-o a partir do `app.config.example.ts` com o `firebaseConfig` real do console (seção 3) antes de cadastrar.

3. **(Recomendado)** Em *Settings → Environments → production*, adicione proteção (required reviewers) para exigir aprovação manual antes de cada deploy.

4. **Ligue o deploy**:

   ```bash
   gh variable set DEPLOY_ENABLED --body true
   ```

Para desligar em emergência: `gh variable set DEPLOY_ENABLED --body false`.

## Solução de problemas

| Sintoma | Causa provável |
| --- | --- |
| `Error: HTTP Error 403` no deploy | Conta sem papel de Editor/Owner no projeto, ou API desabilitada no GCP |
| Functions falham no deploy | Projeto não está no plano Blaze, ou região diferente de `southamerica-east1` |
| Login falha em produção com `auth/requests-blocked` ou similar | Restrição de API key bloqueando o domínio — inclua o domínio do Hosting nos referrers permitidos |
| Upload de foto de perfil negado | Usuário sem claim `members.write` e e-mail do token diferente do campo `email` em `members/{id}` (regra de Storage) |
| Página branca após deploy | `npm run build` não foi rodado antes do deploy, ou `dist/tem-fe/browser` divergente do `firebase.json` |
