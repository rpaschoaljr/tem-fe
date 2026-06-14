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

## 4. Testes das Cloud Functions (Node.js)
As funções na nuvem (como o trigger de propagação de `Custom Claims`) são consideradas críticas, pois validam a segurança que blinda a API. Devem possuir testes isolados simulando os payloads do banco e avaliando a integridade do JWT gerado.
