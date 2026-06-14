# Arquitetura e Padrões Técnicos (TEM-FE)

## 1. Sliced Data Architecture (Fatiamento de Dados)
Para proteger os dados e otimizar as consultas no Firestore, os dados são divididos em coleções pararelas baseadas no nível de confidencialidade:
- **`members`**: Dados públicos/básicos (Nome, Foto, Cargo).
- **`members_private`**: Dados sensíveis restritos (CPF, Endereço, Telefone).
- **`members_spiritual`**: Dados confidenciais do terreiro (Rituais, Orixás, Observações).

## 2. Padrão de Permissões (Permissions & Roles)
Todo o controle de acesso é unificado na coleção `permissions`.
- **Cargos (Roles):** Utilizam identificadores estritamente em **MAIÚSCULAS** após a remoção de caracteres especiais. Exemplo: `role_DIRETORIA`. O processo é: `toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g, "")`.
- **Hierarquia:** Propriedade `hierarchyLevel`. Nível 10 garante acesso global (Admin/Diretoria).
- **Módulos:** Controles de `read` e `write` por módulo (`finance`, `stock`, `members`, etc.).

### Lógica de Herança Visual (UI)
Na tela "Por Usuário", os acessos exibem a permissão do Cargo do usuário ("Effective Permission"). 
Quando o Administrador clica para alternar a permissão do indivíduo (Override), ele injeta explicitamente `true` ou `false` no documento do usuário. A ausência do valor (`undefined` ou chave inexistente) instrui o sistema a olhar o cargo base.

## 3. Segurança em Nuvem e Custom Claims
A coleção de permissões não deve ser usada ativamente no Frontend para travar a tela (embora guie a interface). 
A segurança real ocorre através de uma **Cloud Function** que, ao disparar no login (ou alteração), empacota as permissões baseadas no Cargo e na Sobrescrita do Usuário, e injeta como **Custom Claims (JWT)**.
As **Firestore Security Rules** validam o token (`request.auth.token.modules...`), garantindo que não haja acessos não autorizados diretos à API sem custo adicional de leitura (evita-se usar `get()` nas rules).

## 4. UI e Estilização
- **Angular Material** como base de componentes visuais.
- Abordagem limpa e binária (ON/OFF) para facilitar a compreensão dos usuários leigos do terreiro.
- Proteção das rotas e componentes reativos utilizando Angular Signals.
