# TEM-FE - Gestão de Terreiros

**Vision:** O TEM-FE é um sistema de gestão completo para terreiros de religiões afro-brasileiras. O foco principal é centralizar a administração de membros, financeiro e estoque, permitindo que a liderança espiritual foque na caridade, enquanto a tecnologia cuida da burocracia.

## Goals
- **Gestão de Membros:** Centralizar dados cadastrais, privados (CPF, endereço) e espirituais (Orixás, Rituais) de forma segura.
- **Gestão Financeira:** Lançamentos de entradas/saídas, agendamentos automáticos e controle de mensalidades.
- **Controle de Estoque:** Monitorar a entrada e saída de materiais (velas, ervas, bebidas) com alertas de estoque mínimo.
- **Segurança Absoluta:** O sistema deve estar em conformidade com as melhores práticas de segurança, fatiando os dados para limitar o acesso a informações sensíveis e implementando regras restritas no backend.

## Tech Stack
- **Frontend:** Angular 20 (com Angular Material 20 para UI).
- **Backend/Database:** Firebase 11 (Firestore, Storage, Authentication).
- **Infraestrutura:** Plano Blaze (Pay-as-you-go) do Firebase habilitando o uso de Cloud Functions para processos automatizados.
- **Autenticação e Permissões:** Baseada em Custom Claims injetados via JWT Token por uma Cloud Function.

## Scope
- Autenticação e Autorização granulares (Usuário vs Cargo).
- Separação de dados em coleções particionadas (Sliced Data).
- Funções em nuvem para automação financeira e processamento de imagens.

## Engineering Practices
- **Cost-Efficiency:** As consultas ao Firestore devem ser precisas e bem filtradas. A segurança baseada em Custom Claims e regras locais evita leituras supérfluas ("get()") nas regras de segurança, poupando custos do plano Blaze.
- **Strict Typing:** O projeto TypeScript deve rodar sem erros sob compilação restrita (`strict: true`). Nenhum erro de undefined deve passar.
- **Local Emulators:** Todo o desenvolvimento e validação ocorre nos Emuladores do Firebase no Docker antes da subida para a nuvem.
