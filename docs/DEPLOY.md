# Guia de Publicação no Firebase (Produção)

Este guia descreve como publicar o **Tem-Fé** em um projeto Firebase de produção. Hoje todo o setup do repositório aponta para o projeto de emulador `demo-sistematemfe` — nada aqui afeta seu ambiente local de desenvolvimento.

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

O `.firebaserc` só conhece o alias `default` → `demo-sistematemfe`. Adicione um alias de produção:

```bash
npx firebase use --add
# selecione o projeto de produção e nomeie o alias como "prod"
```

Isso grava o alias no `.firebaserc`. Todos os comandos de deploy abaixo usam `-P prod` explicitamente — assim o alias `default` continua sendo o emulador e ninguém publica em produção por acidente.

## 5. Checklist de segurança pré-deploy

Faça **antes** do primeiro deploy:

1. **Rotacionar/restringir a API key exposta no histórico do git.** Uma chave `AIza…` do projeto demo vazou em um `firebase-debug.log` commitado no passado (hoje suprimida via `.gitleaksignore`). No [Google Cloud Console → APIs e Serviços → Credenciais](https://console.cloud.google.com/apis/credentials):
   - Se a chave pertencer a um projeto real, **regenere-a**.
   - Em **todas** as API keys (incluindo a nova de produção), aplique **restrição de aplicativo** (HTTP referrers: seu domínio `*.web.app` / `*.firebaseapp.com` / domínio próprio) e **restrição de APIs** (apenas Identity Toolkit, Token Service, Firestore, Storage).
   - Opcional, recomendado: reescrever o histórico do git com [BFG](https://rtyley.github.io/bfg-repo-cleaner/) ou `git filter-repo` para remover o log de vez.
2. **CSP em `firebase.json`**: o header `Content-Security-Policy` do Hosting inclui origens de desenvolvimento (`http://localhost:*`, `ws://localhost:*`, `http://127.0.0.1:*`) em `connect-src`. Remova-as antes do deploy de produção (mantenha as origens do Firebase/Google e `https://viacep.com.br`).
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

## 8. Opcional: deploy automático no CI

O workflow atual (`.github/workflows/ci.yml`) builda e roda scans, mas não publica. Para automatizar:

1. Gere uma service account de deploy: `npx firebase init hosting:github` (configura o secret `FIREBASE_SERVICE_ACCOUNT_*` e o workflow) — ou crie manualmente uma SA com papéis *Firebase Hosting Admin* / *Cloud Functions Developer* e guarde o JSON em **GitHub Secrets** (nunca no repo).
2. Adicione um job de deploy condicionado a push na `master` **após** os jobs de build/testes/scans passarem, usando `FirebaseExtended/action-hosting-deploy@v0` (hosting) ou `npx firebase deploy` com `GOOGLE_APPLICATION_CREDENTIALS`.
3. Lembre que o CI copia `app.config.example.ts` → `app.config.ts`; para deploy real, o job precisa gerar um `app.config.ts` com a config de produção (por exemplo, a partir de um secret).

## Solução de problemas

| Sintoma | Causa provável |
| --- | --- |
| `Error: HTTP Error 403` no deploy | Conta sem papel de Editor/Owner no projeto, ou API desabilitada no GCP |
| Functions falham no deploy | Projeto não está no plano Blaze, ou região diferente de `southamerica-east1` |
| Login falha em produção com `auth/requests-blocked` ou similar | Restrição de API key bloqueando o domínio — inclua o domínio do Hosting nos referrers permitidos |
| Upload de foto de perfil negado | Usuário sem claim `members.write` e e-mail do token diferente do campo `email` em `members/{id}` (regra de Storage) |
| Página branca após deploy | `npm run build` não foi rodado antes do deploy, ou `dist/tem-fe/browser` divergente do `firebase.json` |
