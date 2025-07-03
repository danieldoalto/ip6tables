# Informações do Projeto ip6tables Manager

## Visão Geral
O ip6tables Manager é uma aplicação web para gerenciar regras de firewall ip6tables (IPv6) em sistemas Linux. Ele fornece uma interface amigável para visualizar, adicionar, remover e modificar regras de firewall IPv6.

## Estrutura do Projeto

### Arquivos Principais
- `server.js` - Servidor principal que gerencia requisições HTTP e WebSocket
- `handlers.js` - Manipuladores de rotas HTTP (código original)
- `handlers_ext.js` - Extensão para novos manipuladores de rotas (novas funcionalidades)
- `tpl/` - Diretório com templates e recursos estáticos
  - `client.js` - Lógica principal do lado do cliente (código original)
  - `app.js` - Lógica adicional do lado do cliente (novas funcionalidades)
  - `template.js` - Funções que geram templates HTML
  - `tools.js` - Funções de utilidade e carregamento de configurações
  - `index.html` - Página principal da interface web
  - `theme/` - Temas de estilo CSS

### Portas Utilizadas
- `1338` - Servidor HTTP principal
- `8002` - Servidor WebSocket para comunicação em tempo real

## Funcionalidades Principais

### Interface do Usuário (UI)
- **Menus Dropdown**: Para seleção de tabelas (`filter`, `nat`, `mangle`) e chains.
- **Visualização de Regras IPv6**: Tabela principal que exibe as regras da chain selecionada, com syntax highlighting para melhor legibilidade de endereços e regras IPv6.
- **Edição In-line**: Permite editar regras diretamente na tabela.
- **Breadcrumb de Navegação**: Facilita a navegação entre chains aninhadas.
- **Construtor de Regras (Rule Builder)**: Um diálogo que guia o usuário na criação de regras complexas, com campos para protocolo, origem, destino, estado, etc.
- **Painéis de Monitoramento**: Diálogos para visualização em tempo real de `syslog` e `tcpdump`.
- **Diálogo de Configurações**: Permite ao usuário definir apelidos para interfaces de rede e portas, facilitando o reconhecimento nas regras.
- **Backup e Restauração**: Interface modal para criar um backup completo das regras (`ip6tables-save`) e restaurá-lo a partir de um arquivo, substituindo as regras existentes (`ip6tables-restore`).
- **Movimentação de Regras**: Permite selecionar um bloco de regras e movê-lo para uma nova posição dentro da mesma chain. Inclui uma janela de pré-visualização que compara o estado antigo e o novo antes de aplicar as mudanças, garantindo uma operação segura e atômica através de `ip6tables-save` e `ip6tables-restore`.

### Gerenciamento de Regras
- Visualização de regras ip6tables
- Adição de novas regras
- Remoção de regras existentes
- Modificação de regras

### Monitoramento em Tempo Real
- Visualização de logs do sistema (`/var/log/syslog`)
- Captura de pacotes de rede usando `tcpdump`
- Atualização em tempo real via WebSocket

### Autenticação
- **Sistema de Sessão Segura**: A autenticação foi refatorada para usar sessões baseadas em cookies (`HttpOnly`), garantindo que cada login seja único e seguro, em vez do antigo sistema baseado em IP.
- **Login/Logout**: Fluxo padrão de autenticação com geração de ID de sessão único no login e invalidação no logout.

## Estrutura do Código

### server.js
O servidor principal que gerencia:
1. **Servidor HTTP**
   - Rotas para interface web
   - API para manipulação de regras
   - Autenticação de usuários

2. **Servidor WebSocket**
   - Comunicação em tempo real
   - Monitoramento de logs
   - Captura de pacotes de rede

### handlers.js
Este arquivo é o coração do backend. Ele exporta um módulo que contém todos os manipuladores de rota (route handlers) para as requisições HTTP. Suas principais responsabilidades são:
- **Executar Comandos `ip6tables`**: Funções como `showChannel`, `deleteRule`, e `insertRule` interagem diretamente com o sistema para listar, apagar e adicionar regras.
- **Gerenciamento de Configurações**: As funções `loadSettings` e `saveSettings` cuidam da persistência das configurações do usuário em um arquivo JSON.
- **Autenticação**: Gerencia o login (`authMe`), logout (`logout`) e a verificação de sessão (`isAuth`). O sistema foi refatorado para abandonar a verificação por IP e adotar um mecanismo seguro de sessão com cookies `HttpOnly`, gerando um ID de sessão único para cada cliente.

### client.js
Lógica do lado do cliente que gerencia toda a interatividade da interface. É dividido em três objetos principais:

- **`parser`**: Responsável por processar e formatar os dados brutos das regras recebidos do servidor. Ele aplica syntax highlighting para facilitar a leitura das regras, transformando o texto puro em HTML formatado.

- **`rules`**: Contém toda a lógica para manipulação das regras de ip6tables. Funções incluem:
  - Exibir listas de regras por chain e tabela.
  - Adicionar, remover e editar regras.
  - Gerenciar chains customizadas (criar e deletar).
  - Navegação entre chains com um sistema de breadcrumb.
  - Monitoramento em tempo real dos contadores de pacotes e bytes.

- **`tools`**: Agrupa funcionalidades de utilidade, como:
  - Salvar e carregar as configurações de ip6tables.
  - Gerenciar o diálogo de configurações, incluindo apelidos para interfaces (LANs) e portas.
  - Um construtor de regras ("Rule Builder") que oferece uma interface gráfica para criar regras complexas.
  - Gerenciamento da conexão WebSocket para os painéis de `syslog` e `tcpdump`.

### template.js
Contém o objeto `tpl` com funções que geram dinamicamente snippets de HTML. Estes templates são usados para construir elementos da UI, como as linhas da tabela de regras, itens de menu e campos no diálogo de configurações.

### tools.js
Este arquivo é responsável por carregar as configurações do usuário (`_settings`) do servidor assim que a página é carregada. Ele também fornece funções globais de utilidade, como `showError()` e `showInfo()`, para exibir feedback visual ao usuário.

### handlers_ext.js
Criado para abrigar novas funcionalidades do backend. O `server.js` foi modificado para carregar dinamicamente as rotas definidas neste arquivo, permitindo estender a API sem alterar o `handlers.js` original.

### tpl/app.js
Arquivo para o novo código JavaScript do frontend. Ele é carregado pelo `index.html` após o `client.js` e será usado para implementar novas interações e funcionalidades na interface do usuário.

## Estratégia de Desenvolvimento

Para facilitar a adição de novas funcionalidades e minimizar conflitos com o código-fonte original, foi adotada uma estratégia de extensão:

- **Backend**: Novas rotas e lógicas de servidor são adicionadas em `handlers_ext.js`. O `server.js` foi configurado para carregar e mesclar essas novas rotas.
- **Frontend**: Novas lógicas de interface e interações são implementadas em `tpl/app.js`, que é carregado pelo `index.html`.

Essa abordagem mantém o código original o mais intacto possível, facilitando a manutenção e a identificação de novas funcionalidades.

## Dependências Principais
- `nodejs-websocket` - Para comunicação WebSocket
- Módulos nativos do Node.js:
  - `http`
  - `url`
  - `fs`
  - `child_process`
  - `crypto`

## Segurança e Requisitos

### Requisitos de Execução
- Node.js 14.x ou superior
- Permissões de superusuário (sudo) para executar comandos ip6tables
- Sistema Linux com suporte a ip6tables

### Recomendações de Segurança
- **Autenticação**: Altere as credenciais padrão (admin/admin) imediatamente após a primeira execução
- **HTTPS**: Recomenda-se executar atrás de um proxy reverso com HTTPS para proteger as credenciais
- **Permissões**: Execute o servidor com `sudo node server.js` para garantir permissões adequadas
- **Firewall**: Restrinja o acesso às portas 1338 (HTTP) e 8002 (WebSocket) apenas para IPs confiáveis
- **Logs**: Monitore os logs do sistema para identificar possíveis problemas ou tentativas de acesso não autorizado

## Fluxo de Trabalho
1. O usuário faz login na interface web
2. Visualiza as regras atuais
3. Pode adicionar, remover ou modificar regras
4. Pode monitorar logs e tráfego em tempo real

## Melhorias Recentes
- Concluída a documentação interna (comentários) de todos os principais arquivos JavaScript do projeto (`server.js`, `handlers.js`, `tpl/client.js`, `tpl/template.js`, `tpl/tools.js`).
- Organização do código em módulos.
- Melhoria nos comentários e documentação geral.

### Correções de Bugs e Melhorias de Desempenho (2025-07-03)

#### 1. Correção de Permissões
- **Problema**: Comandos ip6tables estavam sendo executados sem privilégios de superusuário, causando falhas silenciosas.
- **Solução**: Adicionado prefixo `sudo` a todos os comandos ip6tables em `handlers.js`, incluindo:
  - Função `showChannel`: Para exibição de regras
  - Função `deleteRule`: Para remoção de regras
  - Função `insertRule`: Para adição e reset de regras
  - Função `monitor`: Para monitoramento de contadores
- **Impacto**: Chains customizadas agora aparecem corretamente na interface e todas as operações funcionam com permissões adequadas.

#### 2. Centralização de Configurações
- **Problema**: Parâmetros de configuração como portas HTTP e WebSocket estavam hardcoded no código.
- **Solução**: Todos os parâmetros de configuração foram centralizados no arquivo `config.json`.
- **Implementação**: O servidor foi refatorado para carregar dinamicamente as configurações, seguindo os princípios SOLID e DRY.
- **Impacto**: Maior facilidade de manutenção e configuração do sistema.

#### 3. Correção do Botão Reset
- **Problema**: O botão de reset não zerava corretamente os contadores da chain atual na interface.
- **Causa Raíz**: Dois problemas identificados:
  1. Falta de permissões para executar comandos ip6tables
  2. Função `monitor` utilizava `iptables` (IPv4) em vez de `ip6tables` (IPv6)
- **Solução**:
  1. Adicionado prefixo `sudo` ao comando de reset em `insertRule`
  2. Corrigida a função `monitor` para usar `sudo ip6tables` em vez de `iptables`
  3. Modificada a função `resetCounters` no frontend para forçar uma atualização completa após o reset
- **Impacto**: O botão de reset agora zera corretamente os contadores e a interface reflete as mudanças imediatamente.

#### 4. Logging e Depuração
- **Melhoria**: Adicionados logs detalhados para execução de comandos ip6tables.
- **Implementação**: Uso de `console.log()` para registrar comandos executados e seus resultados.
- **Impacto**: Facilita a depuração e identificação de problemas em tempo real.
- **Implementada funcionalidade de Movimentação de Regras**: 
  - **Backend**: Adicionadas as rotas `/previewMoveRules` e `/moveRulesBlock` em `handlers_ext.js` para pré-visualizar e aplicar a movimentação de blocos de regras de forma atômica.
  - **Frontend**: Criada uma janela modal para que o usuário defina o bloco de regras a ser movido e o destino, com uma tela de confirmação que exibe um `diff` visual das mudanças antes de aplicá-las.

- **Implementada funcionalidade Edit Chain (Edição textual de chain)**:
  - **Backend**: Adicionada a rota `/editChain` em `handlers_ext.js`, permitindo editar todas as regras de uma chain específica via texto, de forma segura e atômica, preservando as demais chains/tabelas.
    - Algoritmo robusto garante que apenas as regras da chain editada são substituídas (case-insensitive, sem duplicidade).
    - Logs detalhados para diagnóstico de problemas e auditoria.
  - **Frontend**: Modal inspirado na janela de movimentação de regras, com campo de texto (1 regra por linha, numerada para visualização), botões Load, Reset, Salvar e Exit.
    - Numeração é removida automaticamente antes de aplicar as regras.
    - Permite importar regras de arquivo texto e restaurar conteúdo original facilmente.

- **Implementada funcionalidade de Backup e Restauração**:
  - **Backend**: Adicionadas as rotas `/backupRules` e `/restoreRules` em `handlers_ext.js` para gerar e restaurar backups utilizando `ip6tables-save` e `ip6tables-restore`.
  - **Frontend**: Criada uma janela modal em `index.html` e a lógica de interação em `tpl/app.js` para permitir que o usuário baixe e envie arquivos de backup.

- **Unificação da Interface das Modais**:
  - **CSS**: Refatoração completa dos estilos das janelas modais (`backup-modal.css`) para criar um design unificado e consistente, alinhado com o tema principal da aplicação.
  - **Contraste e Acessibilidade**: Melhorado o contraste dos botões e textos, garantindo melhor legibilidade.
  - **HTML e JS**: Atualizados os arquivos `index.html` e `app.js` para aplicar as novas classes de estilo de forma consistente em todas as modais (Backup/Restore, Mover Regras).

- **Refatoração do Sistema de Autenticação**:
  - **Segurança**: O sistema de autenticação, que era baseado em IP, foi substituído por um mecanismo de sessão segura com cookies `HttpOnly`.
  - **Sessões Únicas**: Cada login agora gera um ID de sessão único, permitindo que múltiplos clientes se autentiquem de forma independente, mesmo que compartilhem o mesmo IP.


## Correções e Melhorias Recentes
- [2025-06] **Edit Chain**: Corrigido bug crítico onde regras eram duplicadas ao salvar alterações em uma chain. Agora a substituição é precisa e atômica, sem afetar outras chains.
- [2025-06] **Logs detalhados**: Backend aprimorado com logs extensivos para facilitar debug e auditoria.

## Próximos Passos
- [ ] Adicionar mais testes
- [ ] Melhorar tratamento de erros
- [ ] Adicionar mais documentação
- [ ] Implementar recursos adicionais de monitoramento
