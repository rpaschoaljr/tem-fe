# Estratégia de Testes (TEM-FE)

## 1. Emuladores do Firebase
A fundação de validação de todo o fluxo online/offline passa pelos Emuladores do Firebase rodando em um container Docker local.
Isso garante que todos os testes sejam feitos num ambiente hermético, sem incorrer em custos no plano Blaze.

## 2. Segurança e Pentesting
- **Firestore Security Rules:** A validação do fatiamento (`sliced data`) e permissões baseadas em JWT Custom Claims. Toda alteração nas regras DEVE ser analisada pelo `firebase-security-rules-auditor`.
- **Análises Estáticas (Futuro):** O código deve passar em baterias contínuas de segurança:
  - `Checkov` para infraestrutura.
  - `Snyk` para bibliotecas e pacotes `npm`.
  - `Gitleaks` para garantir que senhas ou chaves Service Account nunca vazem.

## 3. Testes Unitários e Componentes (Angular)
- Todo serviço complexo (ex: `ConfigService`, `AuthService` e cálculos de impostos/estoque) deve possuir testes de caminhos de falha (*Sad Paths*).
- O compilador Typescript do Angular está operando em modo estrito. Erros em tempo de compilação bloqueiam a construção da UI; portanto, testes básicos e uso correto de tipagem evitam falhas.
- **Comando Padrão para Testes**: Como não temos o Chrome instalado no ambiente, utilize obrigatoriamente o Firefox em modo headless para rodar as suites:
  ```bash
  npm run test -- --browsers FirefoxHeadless --watch=false
  ```

## 4. Testes das Cloud Functions (Node.js)
As funções na nuvem (como o trigger de propagação de `Custom Claims`) são consideradas críticas, pois validam a segurança que blinda a API. Devem possuir testes isolados simulando os payloads do banco e avaliando a integridade do JWT gerado.

## 5. Mocks e Angular 20 (ESM Immutability)
Ao rodar testes unitários no Angular 20 (ESM nativo), não é possível utilizar `spyOn` diretamente nas funções importadas do `@angular/fire/firestore` ou `@angular/fire/auth`, pois elas são propriedades de módulos "read-only" (apresentam erro de "not declared writable").
Para contornar isso com "Zero Trust":
1. **Centralização (`FbUtils`)**: Toda chamada às funções do Firebase deve ser feita por meio de um utilitário interno (`FbUtils` localizado em `src/app/shared/utils/firebase-utils.ts`), que reexporta as funções originais como propriedades de um objeto mutável.
2. **Espionagem (`spyOn`)**: Nos arquivos de teste (`.spec.ts`), nunca espionar bibliotecas originais. Espionar o utilitário local:
   Para não quebrar a inferência do TypeScript ao checar se o método já possui um mock ativo antes de invocar o `spyOn` (o que causa `Property 'and' does not exist`), utilize esta sintaxe 100% Type-Safe:
   ```typescript
   (((FbUtils.updateDoc as any)?.and ? FbUtils.updateDoc : spyOn(FbUtils, 'updateDoc')) as any).and.returnValue(Promise.resolve());
   ```
   Essa abordagem previne o erro `has already been spied upon` do Jasmine e compila perfeitamente.
