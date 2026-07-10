# Estado do Projeto (TEM-FE)

## Concluídos Recentemente
- **Migração da Interface de Permissões**: Removido o sistema visual de 3 estados ("Herdar", "Permitir", "Bloquear") que era confuso. Agora, o front-end mapeia os cargos base do usuário e exibe apenas chaves Verdes ou Vermelhas, funcionando de modo intuitivo (2 estados).
- **Consolidação dos IDs de Roles**: Descoberta e correção de uma divergência de capitalização (Maiúsculas vs Minúsculas) ao referenciar o ID dos Cargos (`role_DIRETORIA`) na UI e nos Serviços. O padrão adotado (uppercase + limpeza regex) é uniforme em todo o sistema.
- **Build Clean (Typescript)**: O compilador Typescript do Angular foi pacificado ao usar propriedades estritas para mapas e loops. As quebras do Vite durante o dev mode que impediam a atualização de UI foram solucionadas.
- **Guia de Configuração do OWASP ZAP**: Documentado o processo completo de configuração de usuário autenticado no OWASP ZAP para realizar varreduras na SPA Angular e no Firebase Auth (local/prod), localizado em `.specs/codebase/OWASP_ZAP_CONFIG.md`.
- **Implementação de JWT Custom Claims**: A sincronização de permissões por meio do Firebase Auth e Cloud Functions (`onPermissionUpdate` e `syncUserClaims`) está 100% operacional. As regras do Firestore (`firestore.rules`) e os serviços do front-end (`AuthService`) usam e validam permissões e níveis de hierarquia exclusivamente via JWT token claims, otimizando custos e latência de leitura no plano Blaze.
- **Upload de Foto de Membro**: Implementado o upload de imagem de perfil para o Firebase Storage com redimensionamento e recorte de imagem no lado do cliente (via `ImageCropperDialogComponent`) tanto na edição de membros quanto na edição de perfil próprio.
- **Auditoria Geral e Aba de Auditoria**: Implementado o rastreamento automático de auditoria no backend (via Cloud Functions triggers `onDocumentWrittenWithAuthContext`) gravando na coleção `audit_logs` quem alterou o que e quando em `members`, `members_private`, `members_spiritual`, `transactions`, `stock` e `sales`. Adicionada uma aba interativa de "Auditoria" nas Configurações do frontend que renderiza as alterações em tempo real com exibição detalhada de diffs.
- **Fluxo de Mensalidades, Alertas Privados e Conectividade Local**: Implementada a Cloud Function Callable `getMyDuesStatus` para consulta segura e privada de status contábil próprio no Dashboard. Adicionados campos de dia de vencimento padrão global e dia/desconto personalizado por membro. Criada a função de auto-preenchimento e cálculo inteligente do valor de mensalidade no formulário de lançamentos manuais. Resolvida a conectividade de emuladores para builds de produção locais e relaxados os cabeçalhos de CSP/COEP/CORP/COOP em `firebase.json` e `angular.json`.

## Em Andamento
- Nenhum. Todas as tarefas propostas do fluxo de caixa e mensalidades foram concluídas com sucesso.

## Blockers
- Nenhum bloqueio severo atualmente. O Emulador do Firebase suporta com folga as validações.

## Próximos Passos Focados
1. Histórico de movimentações por item de estoque.
2. Testes unitários do framework Angular para blindar a lógica complexa de `getUserPermValue`.
3. Tratar as vulnerabilidades em pacotes legados conforme detectado pelo Socket Security.

