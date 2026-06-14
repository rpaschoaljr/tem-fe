# Estado do Projeto (TEM-FE)

## Concluídos Recentemente
- **Migração da Interface de Permissões**: Removido o sistema visual de 3 estados ("Herdar", "Permitir", "Bloquear") que era confuso. Agora, o front-end mapeia os cargos base do usuário e exibe apenas chaves Verdes ou Vermelhas, funcionando de modo intuitivo (2 estados).
- **Consolidação dos IDs de Roles**: Descoberta e correção de uma divergência de capitalização (Maiúsculas vs Minúsculas) ao referenciar o ID dos Cargos (`role_DIRETORIA`) na UI e nos Serviços. O padrão adotado (uppercase + limpeza regex) é uniforme em todo o sistema.
- **Build Clean (Typescript)**: O compilador Typescript do Angular foi pacificado ao usar propriedades estritas para mapas e loops. As quebras do Vite durante o dev mode que impediam a atualização de UI foram solucionadas.

## Em Andamento
- Configuração do projeto e rotinas para a padronização do desenvolvimento (através dos arquivos da pasta `.specs`).
- Preparação para migração total da autorização para **JWT Custom Claims** pelas Cloud Functions.

## Blockers
- Nenhum bloqueio severo atualmente. O Emulador do Firebase suporta com folga as validações.

## Próximos Passos Focados
1. Finalizar as implementações Cloud Function (Sincronização de permissões no token Auth).
2. Avançar com as necessidades de upload de Imagens (Foto de Membro).
3. Testes unitários do framework Angular para blindar a lógica complexa de `getUserPermValue`.
