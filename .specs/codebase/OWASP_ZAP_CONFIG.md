# Configuração do OWASP ZAP para Varreduras Autenticadas (Firebase Auth)

Este guia detalha como configurar o **OWASP ZAP (Zed Attack Proxy)** para realizar uma varredura completa (Active Scan e Ajax Spider) nas rotas autenticadas do sistema **TEM-FE**, que utiliza o **Firebase Auth** (baseado em JWT e armazenamento client-side).

---

## 🔑 Credenciais Locais de Teste (Ambiente de Emuladores)

Se você estiver rodando a varredura contra os emuladores locais (com `npm run dev:local`), o banco é populado automaticamente pelo script `seed-master.mjs`. Use o usuário com privilégios de **ADMIN/DIRETORIA** para obter cobertura total das funcionalidades:

- **E-mail:** `admin@tem.local`
- **Senha:** `senha123`

---

## 🛠️ Método 1: Injeção de Header Manual via Replacer (Simples e Rápido)
Como os tokens do Firebase Auth são JWTs anexados às requisições, você pode injetar manualmente o token no ZAP. Este método é ideal para varreduras curtas (menos de 1 hora, que é o tempo de expiração do JWT).

### Passo 1: Obter o Token JWT
1. Abra a aplicação em `http://localhost:4200` no seu navegador.
2. Faça login com as credenciais acima.
3. Abra o Console do Desenvolvedor (F12) e execute o seguinte comando para copiar o token JWT atual para a área de transferência:
   ```javascript
   // No console do navegador
   (await (await import('@angular/fire/auth')).getAuth().currentUser.getIdToken())
   ```
   *(Ou inspecione a aba Application -> IndexedDB -> firebaseLocalStorageDb -> obter o token JWT).*

### Passo 2: Configurar o Replacer no OWASP ZAP
1. No OWASP ZAP, acesse: **Tools** (Ferramentas) -> **Options...** (Opções...) -> **Replacer**.
2. Clique em **Add** (Adicionar) para criar uma nova regra:
   - **Description:** `Firebase Auth Token`
   - **Type:** `Request Header (Add if not present)`
   - **Match String:** `Authorization`
   - **Replacement String:** `Bearer <COLE_O_TOKEN_AQUI>`
   - **Enable:** Marca a caixa.
3. Clique em **OK** para salvar.

Agora, todas as requisições enviadas pelo ZAP (Active Scan e Spider) conterão o cabeçalho `Authorization: Bearer <token>`, permitindo que ele passe pelas validações de segurança do Firestore Rules e Cloud Functions.

---

## 🤖 Método 2: Autenticação por Script (Automatizado para Varreduras Longas)
Para varreduras que duram mais de 1 hora ou para integração em pipelines de CI/CD, é recomendável automatizar a obtenção e renovação do token JWT usando um script no ZAP.

### Passo 1: Criar o Script de Autenticação
Crie um script do tipo **Authentication** no ZAP (usando Nashorn/GraalJS ou similar) que faça a requisição POST para o endpoint REST do Firebase Auth para obter um token JWT válido.

**Script de Exemplo (Javascript - ZAP):**
```javascript
/**
 * Script de autenticação do ZAP para Firebase Auth.
 * Realiza uma requisição para a REST API do Firebase Auth para obter o JWT.
 */
function authenticate(helper, paramsValues, credentials) {
    var email = credentials.getParam("Username");
    var password = credentials.getParam("Password");
    var apiKey = paramsValues.get("API_KEY");
    var authUrl = paramsValues.get("AUTH_URL"); // Ex: http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword

    var requestBody = JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: true
    });

    var url = authUrl + "?key=" + apiKey;
    var msg = helper.prepareMessage();
    msg.setRequestHeader(new org.parosproxy.paros.network.HttpRequestHeader(
        "POST", 
        new org.apache.commons.httpclient.URI(url, true), 
        "HTTP/1.1"
    ));
    msg.getRequestHeader().setHeader("Content-Type", "application/json");
    msg.setRequestBody(requestBody);
    
    helper.sendAndReceive(msg, false);

    var responseBody = msg.getResponseBody().toString();
    var json = JSON.parse(responseBody);
    var token = json.idToken;

    // Salva o token em uma variável global da sessão do ZAP
    org.zaproxy.zap.extension.script.ScriptVars.setGlobalVar("firebase_jwt", token);

    return msg;
}

function getRequiredParamsNames() {
    return ["AUTH_URL", "API_KEY"];
}

function getOptionalParamsNames() {
    return [];
}

function getCredentialsParamsNames() {
    return ["Username", "Password"];
}
```

### Passo 2: Criar o Script HTTP Sender para Injetar o Token
Para anexar o token obtido pelo script de autenticação a todas as requisições de saída, crie um script do tipo **HTTP Sender**:

```javascript
/**
 * Script HTTP Sender do ZAP para injetar o header Authorization nas requisições do sistema.
 */
function sendingRequest(msg, initiator, helper) {
    var url = msg.getRequestHeader().getURI().toString();
    
    // Filtra para enviar o token apenas para o nosso domínio do sistema ou emulador Firestore/Functions
    if (url.indexOf("localhost:8080") !== -1 || url.indexOf("localhost:5001") !== -1 || url.indexOf("firebase") !== -1) {
        var token = org.zaproxy.zap.extension.script.ScriptVars.getGlobalVar("firebase_jwt");
        if (token) {
            msg.getRequestHeader().setHeader("Authorization", "Bearer " + token);
        }
    }
}

function responseReceived(msg, initiator, helper) {
    // Não faz nada na resposta
}
```

### Passo 3: Configurar o Contexto no ZAP
1. Vá em **Session Properties** (Propriedades da Sessão) -> **Contexts** -> **Default Context**.
2. Em **Authentication**:
   - Mude para **Script-Based Authentication**.
   - Selecione o script de autenticação que você criou acima.
   - Defina os parâmetros:
     - `AUTH_URL`: `http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` (Emulador) ou `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` (Produção).
     - `API_KEY`: `fake-api-key-emulator` (Emulador) ou a API Key real do Firebase.
3. Em **Users**:
   - Adicione um novo usuário.
   - Defina o nome como `Admin ZAP`.
   - Preencha o e-mail (`admin@tem.local`) e senha (`senha123`).
   - Marque o usuário como **Enabled** (Habilitado).

---

## 🕸️ Rastreamento com Ajax Spider (Interface Visual Angular)
O Spider convencional do ZAP envia requisições puras e não executa o Javascript do Angular. Para rastrear a interface da SPA, use o **Ajax Spider** (que utiliza navegadores reais via Selenium).

Como o Firebase Auth armazena os tokens no banco IndexedDB do navegador do Selenium, você precisa que o Ajax Spider efetue o login na tela antes de iniciar o rastreamento.

### Configurando o Login Automático no Ajax Spider:
1. Vá em **Session Properties** -> **Contexts** -> **Default Context** -> **Authentication**.
2. Se optar pela autenticação baseada em formulário do ZAP:
   - Escolha **Form-based Authentication**.
   - **Login Form Target URL:** `http://localhost:4200/login`
   - **Login Request POST Data:** `email={%username%}&password={%password%}`
3. Para garantir que o navegador de automação do Selenium realmente faça o login visual:
   - Configure o Ajax Spider para iniciar a varredura a partir da página `http://localhost:4200/login`.
   - ZAP consegue identificar os inputs de email e senha automaticamente e submeter se configurado nas propriedades do contexto.
   - Alternativamente, use a extensão **Zest** no ZAP para gravar uma macro de login:
     1. Inicie a gravação no ZAP.
     2. Vá na página de login, digite `admin@tem.local`, `senha123` e clique em "Entrar".
     3. Pare a gravação do Zest Script.
     4. Defina esse Zest script gravado como o script de autenticação do seu contexto.

Com isso, sempre que o ZAP iniciar a sessão ou o Ajax Spider for executado, ele rodará a macro Zest para logar, preenchendo o LocalStorage/IndexedDB no navegador headless com as credenciais válidas do Firebase, liberando o acesso do Spider a todas as rotas e componentes protegidos da SPA Angular.

---

## 🚀 Integração e Estratégia de CI/CD (GitHub Actions)

Para automatizar este teste a cada **push** sem atrasar o desenvolvimento e mantendo a máxima eficiência de detecção de brechas, siga as recomendações abaixo:

### 1. Que usuário utilizar no CI/CD?
Recomendamos rodar o scan autenticado com um **Usuário de Privilégio Mínimo** (especificamente `consulente@tem.local`, senha `senha123`).

* **Por que não rodar apenas como Admin?**
  Se você varrer apenas com um usuário Admin, o ZAP terá permissão total. Ele testará injeções ou XSS nas telas internas, mas **não conseguirá detectar falhas críticas de controle de acesso (BOLA/BFLA)**. Ou seja, se o Firestore estiver com as regras abertas permitindo que qualquer pessoa leia o financeiro, o ZAP logado como Admin achará normal.
* **A vantagem do privilégio mínimo:**
  Ao logar como `CONSULENTE`, o ZAP tentará acessar e fazer requisições ativas nos recursos restritos (ex: ler a coleção `transactions`, consultar a coleção `members_private` ou cadastrar itens no estoque). Como o cargo de `CONSULENTE` possui o menor nível de acesso no sistema, se o Firestore e as Cloud Functions bloquearem os requests com `403 Permission Denied`, o ZAP constatará que o sistema está blindado. Se ele conseguir ler ou alterar dados, emitirá um alerta de vulnerabilidade crítica de controle de acesso.

### 2. Executando os Emuladores Firebase no GitHub Actions
Para que o teste de segurança dinâmico do ZAP funcione no GitHub Actions, a aplicação Angular precisa conseguir conversar com o banco e o serviço de autenticação. 
Atualmente, o workflow apenas inicia o Angular (`npm start &`), o que faz com que a autenticação falhe, pois os emuladores de backend não estão ativos no runner.

Para resolver isso, você deve ajustar o arquivo `.github/workflows/ci.yml` na etapa de `security-scans`:

```yaml
      # 1. Iniciar os emuladores Firebase locais (Docker) no runner
      - name: Start Firebase Emulators
        run: |
          docker compose up --build -d firebase-emulators
          
      # 2. Instalar dependências e compilar Cloud Functions no runner para que as regras de Claims rodem
      - name: Build Cloud Functions
        run: |
          npm install --prefix functions
          npm run build --prefix functions

      # 3. Aguardar o Emulador Auth estar pronto e rodar o Seed para criar os usuários
      - name: Wait for Emulators and Run Seed
        run: |
          npx wait-on http://localhost:9099 -t 60000
          node scripts/seed-master.mjs

      # 4. Iniciar o app Angular
      - name: Start Angular App for ZAP
        run: npm start &
        
      - name: Wait for App to be ready
        run: npx wait-on http://localhost:4200 -t 90000

      # 5. Executar o ZAP com a estratégia de privilégio mínimo
      - name: OWASP ZAP (Baseline Scan)
        run: npm run scan:owasp || true
```

*Nota: Para varredura autenticada contínua no CI, você pode exportar a configuração do seu Contexto ZAP (`.context`) e o script de autenticação para dentro do repositório (ex: na pasta `.zap/`) e passar esses arquivos para o container do ZAP através do comando de execução CLI.*

---

## ⚡ Otimização do Active Scan em Ambientes Local/CI (Evitando Timeouts e Travamentos)

Durante a execução do **Active Scan completo (Full Scan)** autenticado contra a porta `4200` (dev-server do Angular gerenciado pelo **Vite**), observou-se que o ZAP tentou atacar arquivos internos e de pacotes, gerando travamentos de mais de 23 minutos com milhares de exceptions do tipo `ZapSocketTimeoutException: Read timed out`.

Para solucionar isso e fazer o teste rodar em **menos de 2 minutos**, aplicamos as seguintes melhorias que devem ser mantidas:

### 1. Exclusão Global de URLs do Dev-Server (Vite/Angular)
O Vite expõe o sistema de arquivos local pela rota virtual `/@fs/`, componentes internos por `/@ng/`, arquivos do motor por `/@vite/` e módulos npm em `/node_modules/`. O ZAP tentava hackear esses arquivos de biblioteca um a um, travando a CPU e a rede.

Excluímos estes caminhos configurando regras globais de regex do ZAP no script de execução [run-owasp.mjs](file:///home/paschoal/Documentos/Sistema centro/tem-fe/scripts/run-owasp.mjs) via parâmetro `-config`:
* `globalexcludeurl.url_list.url(0).regex=.*\\/@fs\\/.*` (Exclui acesso a arquivos locais do disco)
* `globalexcludeurl.url_list.url(1).regex=.*\\/node_modules\\/.*` (Exclui varreduras contra pacotes do node_modules)
* `globalexcludeurl.url_list.url(2).regex=.*\\/@vite\\/.*` (Exclui arquivos internos do Vite)
* `globalexcludeurl.url_list.url(3).regex=.*\\.ts$` (Exclui arquivos TS expostos de source maps)
* `globalexcludeurl.url_list.url(4).regex=.*\\/@ng\\/.*` (Exclui rotas do compilador do Angular)
* `globalexcludeurl.url_list.url(5).regex=.*\\/media\\/.*` (Exclui mídias do dev-server)
* `globalexcludeurl.url_list.url(6).regex=.*\\/media$` (Exclui o endpoint de mídia)

### 2. Controle de Tempo e Paralelismo do Active Scan
No Docker do ZAP, injetamos chaves para acelerar o motor de ataque e impedir travas eternas:
* `ascan.maxRuleDurationInMins=2`: Define que nenhuma regra individual do active scan pode levar mais de 2 minutos. Se ela exceder, é cortada e o ZAP passa para a próxima.
* `ascan.threadPerHost=5`: Aumenta para 5 o número de requisições de escaneamento concorrentes para acelerar I/O de rede local.

### 3. Regras Ignoradas no `zap-rules.conf`
Desabilitamos ativamente regras que dependem de rede externa ou de tecnologias ausentes no projeto (como Java e LDAP) para reduzir logs de erros e falsos alertas no CI:
* **`90034` (Cloud Metadata):** Evita loops em conexões de metadados fictícios em `169.254.169.254`.
* **`40046` (SSRF):** Evita timeouts gerados por testes OAST/Callback externos.
* **`90035` & `90036` (SSTI / SSTI Blind):** Injeção de template (irrelevante para Firebase e evita loops de sleep 15s no terminal).
* **`40015` (LDAP Injection):** Injeção em LDAP (incompatível com Firebase NoSQL).
* **`90025` (Expression Language Injection):** Regra Java EL inútil em Node.js.
* **`40040` (CORS Misconfiguration):** Ignora o cabeçalho CORS aberto (`*`) adicionado pelo dev-server do Vite para HMR local (falso positivo exclusivo de desenvolvimento).*
