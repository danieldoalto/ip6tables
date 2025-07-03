# ip6tables WEB GUI

> **Nota**: Esta é uma interface web para gerenciamento de regras ip6tables (IPv6) em sistemas Linux.

![ip6tables Web Interface](http://i.mcgl.ru/RGGJv4MAvA)

## 🚀 Suporte Completo ao IPv6

- **Suporte IPv6**: Adaptação completa para gerenciar regras ip6tables
- **Todas as Funcionalidades**: Mantém todas as melhorias do projeto iptables original
- **Interface Dedicada**: Porta separada (1338) para evitar conflitos com a versão IPv4
- **Experiência do Usuário**: UI adaptada para exibição de endereços IPv6
- **Operações Seguras**: Todas as operações críticas (backup, restore, edição de chain) adaptadas para ip6tables

## ✨ Principais Recursos

* Visualize e edite regras ip6tables em uma interface web amigável
* Adicione e remova regras IPv6 com um simples clique
* Crie e gerencie chains personalizadas para seu firewall IPv6
* **Mova blocos de regras**: Selecione um intervalo de regras IPv6 e mova-as para uma nova posição na mesma chain
* **Edit Chain (Edição textual de chain)**: Edite todas as regras IPv6 de uma chain específica em formato texto
* **Backup e Restauração**: Crie um backup completo das suas regras IPv6 e restaure a partir de um arquivo
* **Monitoramento em tempo real**: Visualize syslog e tráfego de rede IPv6
* **Autenticação de usuário**: Sistema de sessão seguro com cookies `HttpOnly`

## 📦 Instalação

### Pré-requisitos

- Node.js 14.x ou superior
- NPM (geralmente vem com o Node.js)
  
### Passos para instalação

1. **Clone o repositório**
   ```bash
   git clone https://github.com/danieldoalto/ip6tables.git
   ```

2. **Instale as dependências**
   ```bash
   cd ip6tables
   npm install
   ```

3. **Inicie o servidor**
   ```bash
   node server.js
   ```

4. **Acesse a interface**
   Abra seu navegador e acesse:
   ```
   http://localhost:1338
   ```

## 🚀 Como usar

### Credenciais padrão
- **Usuário**: admin
- **Senha**: admin

> **Importante**: Altere as credenciais padrão após o primeiro login nas configurações do sistema.

### Configuração Inicial

1. **Autenticação**:
   - Faça login com as credenciais fornecidas
   - Recomenda-se alterar a senha padrão imediatamente

2. **Gerenciamento de Regras**:
   - Selecione a tabela desejada (filter, nat, mangle)
   - Escolha uma chain para visualizar suas regras
   - Utilize os botões de ação para adicionar, remover ou modificar regras
   - **Edit Chain**: Clique no botão "Edit Chain" para abrir a janela de edição textual da chain selecionada. Você pode:
     - Carregar as regras atuais da chain em formato texto (1 regra por linha, numeradas apenas para visualização)
     - Editar, adicionar ou remover regras diretamente no campo de texto
     - Usar o botão "Load" para importar regras de um arquivo texto
     - Usar o botão "Reset" para restaurar o conteúdo original da chain
     - Salvar as alterações com "Salvar" (aplica apenas na chain selecionada, sem afetar as demais)
     - Sair sem salvar com "Exit"
   - O sistema garante que apenas as regras da chain editada são alteradas, preservando todas as outras chains/tabelas.

3. **Backup e Restauração**:
   - Acesse o menu "Backup" para baixar um backup atual
   - Utilize "Restaurar" para carregar um backup anterior

## 🛠️ Troubleshooting e Boas Práticas

- Ao editar uma chain pelo modo textual, a numeração exibida é apenas para conferência visual e não faz parte da regra aplicada.
- Execute o servidor com permissões de superusuário (sudo) para garantir o funcionamento correto dos comandos ip6tables.
- Os logs frequentes no terminal são normais e indicam o polling periódico para atualização dos contadores.

## 🔄 Atualizações Recentes

- **Correção de Permissões**: Adicionado prefixo `sudo` a todos os comandos ip6tables para evitar erros de permissão.
- **Centralização de Configurações**: Todas as configurações do servidor agora são carregadas do arquivo `config.json`.
- **Correção do Botão Reset**: Corrigido o funcionamento do botão de reset para zerar corretamente os contadores da chain atual.
- **Correção de Visualização**: Corrigida a função `monitor` para usar `ip6tables` em vez de `iptables`, garantindo que os contadores IPv6 sejam exibidos corretamente.
- **Melhorias na Documentação**: Atualização da documentação técnica em `INFOS.md`.

## 🔗 Links

- [Repositório GitHub](https://github.com/danieldoalto/ip6tables)
- [Documentação Técnica](INFOS.md)
- O sistema remove automaticamente a numeração antes de aplicar as regras, evitando duplicidade.
- Caso observe qualquer comportamento inesperado (ex: regras duplicadas ou não aplicadas), verifique se está usando a versão mais recente do sistema.
- Todas as operações de edição textual são atômicas: apenas a chain editada é alterada, as demais chains/tabelas permanecem intactas.
- Logs detalhados são gerados no backend para facilitar diagnóstico de erros.

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir uma issue ou enviar um pull request.

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas alterações (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📜 Histórico de Correções Importantes

- [2025-06] **Correção crítica na edição textual de chains**: Resolvido bug onde regras eram duplicadas ao salvar alterações em uma chain. Agora, apenas as regras da chain editada são substituídas, preservando todas as demais.
- [2025-06] **Melhoria na robustez do backend**: Identificação das regras da chain feita de forma case-insensitive e precisa, evitando falsos positivos/negativos.
- [2025-06] **Logs detalhados**: Adicionados logs extensivos para facilitar o diagnóstico e manutenção.

## 📜 Licença

Este projeto é um fork do [puux/iptables](https://github.com/puux/iptables) e é distribuído sob a mesma licença. Consulte o arquivo `LICENSE` para obter mais informações.

## ⚙️ Executando como serviço (opcional)

Para executar o iptables Manager como um serviço em segundo plano, você pode usar o PM2:

```bash
# instale o PM2 globalmente (se ainda não tiver)
npm install pm2 -g

# inicie o servidor com PM2
pm2 start server.js --name ip6tables

# salve a configuração do PM2
pm2 save

# configure para iniciar automaticamente na inicialização do sistema
pm2 startup

# inicie o serviço PM2 na inicialização (siga as instruções exibidas)
# Exemplo: sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

## 🔒 Segurança

### Alterando credenciais de acesso

As credenciais de acesso podem ser alteradas editando o arquivo de configuração:

```bash
sudo nano /etc/ip6tables/config.json
```

Altere os valores de `user` e `pass` conforme necessário e reinicie o serviço:

```bash
pm2 restart ip6tables
```

### Recomendações de segurança

1. **Nunca exponha a interface na internet pública**
2. Utilize um proxy reverso com HTTPS (como Nginx ou Apache)
3. Mantenha o Node.js e as dependências atualizadas
4. Altere as credenciais padrão imediatamente após a instalação
5. Monitore os logs regularmente

## 🎨 Criando Temas Personalizados

Você pode criar seus próprios temas personalizados para o iptables Manager:

1. Acesse o diretório de estilos:
   ```bash
   cd tpl/styles/
   ```

2. Crie um novo arquivo de tema baseado no tema existente:
   ```bash
   cp _variables.scss meu-tema.scss
   ```

3. Edite as variáveis de cores e estilos conforme desejado

4. Compile o tema para CSS:
   ```bash
   sass --sourcemap=none meu-tema.scss ../theme/MeuTema.css
   ```

5. Recarregue a página e selecione seu novo tema em Configurações > Tema

## 📝 Licença

Este projeto é baseado no fork [danieldoalto/iptables](https://github.com/danieldoalto/iptables) adaptado para IPv6, e é distribuído sob a mesma licença. Consulte o arquivo `LICENSE` para obter mais informações.
