/**
 * Objeto 'tpl'
 * Contém funções que geram snippets de HTML (templates) para serem inseridos dinamicamente na página.
 */
var tpl = {
    // --- Templates para o Diálogo de Configurações ---

    /**
     * Gera o HTML para uma linha de apelido de LAN na tabela de configurações.
     * @param {string} interface - O nome da interface (ex: 'eth0').
     * @param {string} name - O apelido para a interface (ex: 'WAN').
     * @returns {string} - O HTML da linha da tabela (<tr>).
     */
    settingsLan: function (interface, name) {
        return '<tr class="lan">\n\
                    <td><input type="text" value="' + interface + '"/></td>\n\
                    <td><input type="text" value="' + name + '"/></td>\n\
                    <td class="rowcenter"><a href="#" onclick="tools.removeLan(this);"><img src="/img/delete.png"/></a></td>\n\
                </tr>';
    },
	
    /**
     * Gera o HTML para uma linha de apelido de Porta na tabela de configurações.
     * @param {string} port - O número da porta (ex: '80').
     * @param {string} name - O apelido para a porta (ex: 'HTTP').
     * @returns {string} - O HTML da linha da tabela (<tr>).
     */
    settingsPort: function (port, name) {
        return '<tr class="port">\n\
                    <td><input type="text" value="' + port + '"/></td>\n\
                    <td><input type="text" value="' + name + '"/></td>\n\
                    <td class="rowcenter"><a href="#" onclick="tools.removeLan(this);"><img src="/img/delete.png"/></a></td>\n\
                </tr>';
    },
    
    // --- Templates para o Menu de Chains Customizadas ---

    /**
     * Gera o HTML para um item de menu de uma chain customizada.
     * @param {string} name - O nome da chain.
     * @param {string} table - A tabela à qual a chain pertence.
     * @returns {string} - O HTML do item de lista (<li>).
     */
	customChain: function (name, table) {
		return '<li><a onclick="rules.showListWithPath(\'' + name + '\', \'' + table + '\');">' + name + " (" + table + ') <img chainname="' + name + '" chaintable="' + table + '"onclick="rules.removeChain(this);" style="float: right;" src="/img/delete.png"/></a></li>';
	},
	
    /**
     * Template para o botão "Add new ..." no menu de chains customizadas.
     */
    customChainAddNew: '<li class="newchain"><a onclick="rules.addChain();">Add new ...</a></li>',
    
    // --- Template para a Tabela de Regras ---

    /**
     * Gera o HTML para uma linha na tabela principal de regras.
     * @param {number} index - O índice da regra.
     * @param {string} text - O texto da regra já formatado com HTML.
     * @returns {string} - O HTML da linha da tabela (<tr>).
     */
    ruleRow: function (index, text) {
        return "<tr>" +
            '<td class="rowcenter" id="lindx">' + index + "</td>" +
            '<td class="rowright" id="pkts' + index + '"></td>' +
            '<td class="rowright" id="bytes' + index + '"></td>' +
            '<td class="row" id="rule' + index + '"><span class="edittext">' + text + '<img class="edit" src="/img/edit.png" onclick="parser.editRule(' + index + ')"/></spawn></td>' +
            (index ? '<td class="rowcenter"><a href="#" onclick="return rules.remove(' + index + ');" title="Delete"><img src="/img/delete.png"/></a>' + "</td>" : '<td class="row"></td>') +
            "</tr>";
    },
};

