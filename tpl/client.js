// Arquivo de script do lado do cliente para o Iptables Manager
// Lida com a interação do usuário, comunicação com o servidor e atualização da interface.

// Variáveis globais para manter o estado da aplicação
var channel = ""; // Chain (cadeia) atualmente selecionada
var table = "";   // Tabela atualmente selecionada (filter, nat, mangle)
var webSocket;    // Objeto WebSocket para comunicação em tempo real
var chainPath = []; // Array para manter o histórico de navegação (breadcrumb)

// Função principal executada quando o documento HTML está pronto
$(document).ready(function(){
	// Exibe a lista de regras para a chain 'input' na tabela 'filter' como padrão
	rules.showListWithPath("input", "filter");
	
	// Obtém a lista de chains customizadas do servidor
	$.get("/chainlist", function(data) {
		var arr = JSON.parse(data);
		$("#customchains").html("");
		for(var i = 0; i < arr.length; i++) {
			var item = arr[i];
			var index = item.indexOf(" ");
			var rName = item.substr(0, index);
			var rTable = item.substr(index+2, item.length - index - 3);
			$("#customchains").append(window.tpl.customChain(rName, rTable));
		}
		$("#customchains").append(window.tpl.customChainAddNew);
	});
	
	// Inicia o monitoramento das regras a cada 1 segundo para atualizar os contadores
	setInterval(rules.monitor, 1000);
	// Seleciona a primeira página de ferramentas/configurações por padrão
	tools.selectPage(1);

});

// Lógica para os menus dropdown
$(function () {
	// Itera sobre cada elemento com a classe 'dropdown'
	$('.dropdown').each(function () {
		var id = 0;
		$(this).parent().eq(0).hoverIntent({
			timeout: 100,
			over: function () {
				var obj = this;
				id = setTimeout(function() {
					$('.dropdown:eq(0)', obj).slideDown(100);
				}, 500);
			},
			out: function () {
				clearTimeout(id);
				$('.dropdown:eq(0)', this).fadeOut(200);
			}
		});
	});

	$('.dropdown').each(function(i, it){
		var list = $(it).find('li');
		if(list.length > 12){
			list.parent().addClass('large');
			  list.each(function(index, item){
				  if(index >= list.length / 2){
					  $(item).addClass('second');
				  } 
				  else{
					  $(item).addClass('first');
				  }
			  });
			  $(it).find('.first').wrapAll('<div class="first-row"/>');
			  $(it).find('.second').wrapAll('<div class="second-row"/>');
		}
	});
});

/**
 * Objeto 'parser'
 * Contém métodos para processar e formatar os dados das regras recebidas do servidor.
 */
var parser = {
	
	/**
	 * Processa a lista de regras (em formato JSON) e as exibe na tabela principal.
	 * @param {string} data - String JSON contendo um array de regras.
	 */
	parseChannels: function (data) {
		
		this.editRuleRow = null;
		
		var arr = JSON.parse(data);

		$("#main").html('');

		var index = 0;
		for(var line in arr) {
			var val = arr[line];
			if(val) {
				$("#main").append(parser.makeRuleTpl(index, val));
			}
			index++;
		}

		$("#main").append('<tr class="newrulerow"><td colspan="3">New rule:</td><td colspan="1"><form onsubmit="return rules.insert();"><input type="text" id="rule" class="ruleeditor"/></form></td><td><a href="#" onclick="return tools.addDialogRule();" title="Add rule"><img src="/img/make.png"/></a></td></tr>');
	},
	
	/**
	 * Cria o HTML para uma única linha de regra na tabela.
	 * @param {number} index - O índice da regra.
	 * @param {string} text - O texto da regra.
	 * @returns {string} - O HTML da linha da tabela (<tr>).
	 */
	makeRuleTpl: function (index, text) {
		var ntext = this.makeRuleText(text);
		return tpl.ruleRow(index, ntext);
	},
	
	// Objeto para identificar regras finais que não levam a outras chains
	FIN_RULES: {DROP:1, ACCEPT:1, LOG:1, TCPMSS:1, RETURN:1, DNAT:1, SNAT:1, MASQUERADE:1, CONNMARK:1, TOS:1, TTL:1},
	/**
	 * Formata o texto de uma regra com spans e classes para syntax highlighting.
	 * @param {string} text - O texto original da regra.
	 * @returns {string} - O texto da regra formatado com HTML.
	 */
	makeRuleText: function (text) {
		text = text
			// strings
			.replace(/(--log-prefix) "(.*)"/g, function(str, pref, comment){
				return pref + ' <span class="ipt-comment">"' + comment + "\"</span>";
			})
			// comment
			.replace(/(-m comment --comment) "(.*)" (.*)/g, function(str, param, comment, other){
				return other + ' <span class="ipt-comment">//' + comment + "</span>";
			})
			.replace(/(-m comment --comment) ([\w]+) (.*)/g, function(str, param, comment, other){
				return other + ' <span class="ipt-comment">//' + comment + "</span>";
			})
			// network interfaces
			.replace(/(-[o|i]) ([a-z0-9]+)/g, function(str, dir, int){
				return dir + ' <b title="' + int + '">' + (window._settings.LANS[int] || int) + '</b>';
			})
			// networks
			.replace(/(\-d|\-s|\-\-to\-destination) ([0-9\.\/\:]+)/g, '$1 <span class="ipt-net">$2</span>')
			// ports
			.replace(/(--dport|--sport) ([0-9\.\/\:]+)/g, function(str, param, port){
				return param + ' <span class="ipt-port" title="' + port + '">' + (window._settings.PORTS[port] || port) + '</span>';
			})
			// rule chain
			.replace(/-j (ACCEPT|DROP)($| )/g, '-j <span class="ipt-$1">$1</span>$2')
			.replace(/-j ([A-Z\_0-9]+)/g, function(str, name) {
				var lname = name.toLowerCase();
				if(parser.FIN_RULES[name]) {
					return "-j " + name;
				}
				return '-j <a class="ipt-channel" href="javascript: rules.showListWithPath(\'' + lname + '\', \'' + table + '\', true);">' + name + "</a>";
			});

		return text;
	},
	
	editRuleRow: null,      // Referência para a linha (<tr>) que está sendo editada
	editRuleRowText: "",    // Conteúdo original da célula da regra antes da edição
	editRuleRowIndex: "",   // Índice da regra que está sendo editada
	/**
	 * Manipula eventos de teclado (Enter, Esc) durante a edição de uma regra.
	 * @param {number} key - O código da tecla pressionada.
	 */
	editRuleAction: function (key) {
		if(key === 27) {
			if(this.editRuleRow) {
				this.editRuleRow.html(this.editRuleRowText);
				this.endEditRule();
			}
		}
		else if(key === 13) {
			this.editRuleRow.html(this.makeRuleText(text = this.editRuleRow.children().val()));
			this.endEditRule();
			text = text.replace("-A " + channel.toUpperCase(), "-R " + channel.toUpperCase() + " " + this.editRuleRowIndex); 
			rules.insertText(text);
		}
	},

	/**
	 * Ativa o modo de edição para uma regra específica na tabela.
	 * @param {number} index - O índice da regra a ser editada.
	 */
	editRule: function (index) {
		var rule = $("#rule" + index);
		if(this.editRuleRow === null || rule.attr("id") !== this.editRuleRow.attr("id")) {
			if(this.editRuleRow) {
				this.editRuleRow.html(this.editRuleRowText);
			}
			var value = rule.text();
			this.editRuleRowText = rule.html();
			rule.html('<input type="text" onkeyup="parser.editRuleAction(event.keyCode);" class="ruleeditor"/>').children().val(value);
			rule.children().focus();

			this.editRuleRow = rule;
			this.editRuleRowIndex = index;
		}
	},
    
    /**
     * Finaliza o modo de edição, resetando as variáveis de estado.
     */
    endEditRule: function() {
        this.editRuleRow = null;
    }
	
};

/**
 * Objeto 'rules'
 * Contém métodos para gerenciar as regras de iptables (exibir, adicionar, remover, etc.).
 */
var rules = {
	currentChain: null,
	currentTable: null,
	/**
	 * Exibe a lista de regras para uma chain e tabela específicas.
	 * @param {string} name - O nome da chain.
	 * @param {string} chainTable - O nome da tabela.
	 */
	showList: function (name, chainTable) {
		channel = name;
		table = chainTable;

		$(".itemselect").removeClass("itemselect").addClass("item");
		$(".item").each(function(index, obj) {
			if($(obj).text() === name.toUpperCase()) {
				$(obj).removeClass("item").addClass("itemselect");
			}
		});

        parser.endEditRule();
		$.get("channel?c=" + channel + "&t=" + table, parser.parseChannels);
	},

	/**
	 * Exibe a lista de regras e atualiza o caminho de navegação (breadcrumb).
	 * @param {string} name - O nome da chain.
	 * @param {string} chainTable - O nome da tabela.
	 * @param {boolean} addPath - Se true, adiciona a chain ao caminho de navegação.
	 */
		showListWithPath: function (name, chainTable, addPath) {
		this.currentChain = name;
		this.currentTable = chainTable;
		console.log(`[Debug] State updated: table='${this.currentTable}', chain='${this.currentChain}'`);

		rules.showList(name, chainTable);

		var obj = {chain: name.toUpperCase(), table: chainTable};
		if(addPath) {
			chainPath.push(obj);
		}
		else {
			chainPath = [obj];
		}

		rules.updatePath();
	},

	/**
	 * Atualiza o HTML do breadcrumb de navegação.
	 */
	updatePath: function() {
		var code = "";
		for(var o of chainPath) {
			if(code) code += " / ";
			code += '<a class="ipt-channel" href="javascript: rules.showBackPath(\'' + o.chain + '\')">' + o.chain + (code ? "" : "[" + o.table + "]") + "</a>";
		}
		tools.setChainPath(code);
	},

	/**
	 * Navega para uma chain anterior no breadcrumb.
	 * @param {string} name - O nome da chain para a qual voltar.
	 */
	showBackPath: function (name) {
		var index = 0;
		for(var o of chainPath) {
			index++;
			if(o.chain == name) {
				chainPath = chainPath.slice(0, index);
				rules.showList(o.chain, o.table);
				break;
			}
		}
		rules.updatePath();
	},
	
	/**
	 * Remove uma regra.
	 * @param {number} index - O índice da regra a ser removida.
	 */
	remove: function (index) {
		$.get("delete?i=" + index + "&c=" + channel + "&t=" + table, parser.parseChannels);
		return false;
	},
	
	/**
	 * Insere uma nova regra a partir do campo de texto principal.
	 */
	insert: function () {
		this.insertText($("#rule").val());
		
		return false;
    },
    
    /**
	 * Envia o texto de uma regra para o servidor para ser inserida ou atualizada.
	 * @param {string} text - O texto da regra.
	 */
    insertText: function (text) {
			// Se não for especificada uma ação (-A, -I, -R), assume -A (Append)
			if(text.search(/-[A|I|R]/g) === -1) {
			text = "-A " + channel.toLocaleUpperCase() + " " + text ;
		}

		text = "-t " + table + " " + text;
        
        for(var lan in window._settings.LANS) {
            text = text.replace(new RegExp("(-[o|i]) " + window._settings.LANS[lan] + " ", 'g'), function(str, dir, int){
				return dir + " " + lan + " ";
			});
        }
        for(var port in window._settings.PORTS) {
            text = text.replace(new RegExp("(--dport|--sport) " + window._settings.PORTS[port] + " ", 'g'), function(str, dir, _port){
				return dir + " " + port + " ";
			});
        }
		
		text = text.replace(/\/\/(.*)/g, '-m comment --comment "$1"');
        
		$.post("insert?c=" + channel + "&t=" + table, {rule: text}, function(data){
			if(data) {
				if(data.substr(0, 1) === "[") {
					parser.parseChannels(data);
				}
				else {
					showError(data);
				}
			}
		});

		return false;
	},
	
	/**
	 * Monitora os contadores de pacotes e bytes para a chain atual, atualizando a UI.
	 */
	monitor: function() {
		$.get("/mon?c=" + channel + "&t=" + table, function(data){
			var arr = JSON.parse(data);
			var index = 0;
			for(var i = 0; i < arr.length; i++) {
				var items = arr[i].trim().replace(/[ ]+/g, ' ').split(" ");

				if(i === 0) {
					pkts = 4;
					bytes = 6;
				}
				else {
					pkts = 0;
					bytes = 1;
				}
				
				$("#pkts" + index).html(items[pkts]);
				$("#bytes" + index).html(items[bytes]);
				if(i !== 1) {
					index++;
				}
			}
		});
	},
	
	/**
	 * Envia um pedido para criar uma nova chain customizada.
	 * @param {string} name - Nome da nova chain.
	 * @param {string} _table - Tabela à qual a chain pertence.
	 */
	addChainName: function(name, _table) {
		channel = name;
		table = _table;
		$.post("insert?c=" + name + "&t=" + table, {rule: "-t " + table + " -N " + name.toUpperCase()}, function(data){
			if(data) {
				if(data.substr(0, 1) === "[") {
					parser.parseChannels(data);
					//$(".dropdown").append(window.tpl.customChain(name.toUpperCase()));
					$(window.tpl.customChain(name.toUpperCase(), _table)).prependTo(".newchain");
				}
				else {
					showError(data);
				}
			}
		});
	},
	
	/**
	 * Exibe o diálogo para adicionar uma nova chain customizada.
	 */
	addChain: function() {
		$(".addchain").dialog({
			title:"Create new chain",
			modal:true,
			resizable:false,
			width: 400,
			buttons: [
				{
					text: "Create",
					click: function() {
                        rules.addChainName($("#chainname").val(), $("#chaintable").val());
						$(".addchain").dialog("close");
					}
				}
			]
		});
	},

	/**
	 * Remove uma chain customizada.
	 * @param {object} obj - O elemento do link de remoção.
	 */
	removeChain: function(obj) {
		var rName = $(obj).attr("chainname");
		var rTable = $(obj).attr("chaintable");
		
		$.post("insert?t=" + rTable + "&c=" + rName, {rule: "-t " + rTable + " -X " + rName.toUpperCase()}, function(data){
			if(data) {
				if(data.substr(0, 1) === "[") {
					parser.parseChannels(data);
					$(obj).parent().parent().remove();
				}
				else {
					showError(data);
				}
			}
		});
	},
	
	/**
	 * Envia um pedido para zerar os contadores da chain atual.
	 */
	resetCounters: function() {
	// Primeiro, execute o comando para zerar os contadores
	$.post("insert?t=" + table + "&c=" + channel, {rule: "-t " + table + " -Z " + channel.toUpperCase()}, function(data){
		console.log("Resposta do reset:", data);
		
		// Independente da resposta, força uma atualização completa da lista
		console.log("Forçando atualização após reset");
		setTimeout(function() {
			$.get("channel?c=" + channel + "&t=" + table, function(newData) {
				console.log("Dados atualizados após reset:", newData);
				parser.parseChannels(newData);
			});
		}, 500); // Pequeno delay para garantir que o reset seja processado primeiro
		
		// Processa a resposta original também
		if(data) {
			if(data.substr(0, 1) === "[") {
				parser.parseChannels(data);
			}
			else {
				showError(data);
			}
		}
	});
	}
};

/**
 * Objeto 'tools'
 * Contém funções de utilidade, como salvar/carregar regras, configurações e WebSockets.
 */
var tools = {
    pageIndex: 1, // Índice da página de configurações atualmente visível
    
	/**
	 * Salva a configuração atual das regras de iptables.
	 */
	save: function() {
		$.get("/save", function(data) {
			if(data) {
				showError(data);
			}
			else {
				showInfo("Save complite!");
			}
		});
	},
    
	/**
	 * Carrega a última configuração salva das regras de iptables.
	 */
	load: function() {
		$.get("/load", function(data) {
			if(data) {
				showError(data);
			}
			else {
				showInfo("Load complite!");
				rules.showList(channel, table);
			}
		});
	},
    
	oldIndex: -1, // Índice da página de configurações anterior
    /**
	 * Alterna a visibilidade das páginas no diálogo de configurações.
	 * @param {number} index - O índice da página a ser exibida.
	 */
    selectPage: function(index) {
        $("#settings-page" + tools.pageIndex).hide();
        tools.pageIndex = index;
        $("#settings-page" + index).show();
		if(tools.oldIndex !== -1) {
			$("#page" + tools.oldIndex).removeClass("itemselected").addClass("item");
		}
		$("#page" + index).removeClass("item").addClass("itemselected");
		tools.oldIndex = index;
    },
    
    /**
	 * Adiciona um novo campo para um apelido de LAN no diálogo de configurações.
	 */
    addLan: function() {
        $("#lans").append(window.tpl.settingsLan("", ""));
    },
    
    /**
	 * Remove um campo de apelido de LAN.
	 * @param {object} obj - O botão de remoção.
	 */
    removeLan: function(obj) {
        $(obj).parent().parent().remove();
    },
	
    /**
	 * Adiciona um novo campo para um apelido de Porta no diálogo de configurações.
	 */
    addPort: function() {
        $("#ports").append(window.tpl.settingsPort("", ""));
    },
    
	/**
	 * Exibe o diálogo de configurações.
	 */
	settingsDlg: function() {
		$(".settings").dialog({
			title:"Iptables settings",
			modal:true,
			resizable:false,
			width: 600,
			buttons: [
				{
					text: "Save",
					click: function() {
                        $(".param").each(function(index, obj){
                            window._settings[obj.id] = $(obj).val();
                        });
                        window._settings.LANS = {};
                        $(".lan").each(function(index, obj){
                            window._settings.LANS[$(obj).children()[0].firstChild.value] = $(obj).children()[1].firstChild.value;
                        });
						window._settings.PORTS = {};
                        $(".port").each(function(index, obj){
                            window._settings.PORTS[$(obj).children()[0].firstChild.value] = $(obj).children()[1].firstChild.value;
                        });
                        $.post("/settings?c=save", {data: JSON.stringify(window._settings)}, function(data) {
                            if(data) {
                                showError(data);
                            }
                        });
						$(".settings").dialog("close");
						
						rules.showList(channel, table);
					}
				}
			]
		});
	},
	
	/**
	 * Objeto 'ruleBuilder'
	 * Define a estrutura e os parâmetros para o construtor de regras dinâmico.
	 */
	ruleBuilder: {
		new_proto: { def: "none", pref: " -p ", name: "Proto", list: ["none", "TCP", "UDP", "ICMP", "GRE"] },
		new_in: { def: "", pref: " -i ", name: "Input", hint: "eth0" },
		new_out: { def: "", pref: " -o ", name: "Output", hint: "wlan0" },
		new_dest: { def: "", pref: " -d ", name: "Dest", hint: "8.8.0.0/16", pdef: true, sub: { new_dst_port_from: { def: "", pref: " --dport ", name: "from", size: 40, sub: { new_dst_port_to: { def: "", pref: ":", name: "to", size: 40 } } } } },
		new_src: { def: "", pref: " -s ", name: "Source", hint: "10.10.0.0/16", pdef: true, sub: { new_src_port_from: { def: "", pref: " --sport ", name: "from", size: 40, sub: { new_src_port_to: { def: "", pref: ":", name: "to", size: 40 } } } } },
		new_state: { def: "none", pref: " -m state --state ", name: "State", list: ["none", "NEW", "ESTABLISHED", "RELATED", "INVALID"] },
		new_limit: { def: "", pref: " -m limit --limit ", name: "Limit" },
		new_action: { def: "", pref: " -j ", name: "Action", list: ["ACCEPT", "DROP", "DNAT", "SNAT", "MARK", "LOG", "MASQUERADE", "MIRROR", "REDIRECT", "RETURN", "TOS", "TTL"],
			asvalue: {
				DNAT: {	new_to_destination: { def: "", pref: " --to-destination ", name: "destination"} },
				SNAT: {	new_to_source: { def: "", pref: " --to-source ", name: "source"} },
				MARK: {	new_set_mark: { def: "", pref: " --set-mark ", name: "mark"} },
				REDIRECT: {	new_to_ports: { def: "", pref: " --to-ports ", name: "to ports"} },
				TOS: {	new_tos: { def: "", pref: "  --set-tos ", name: "tos"} },
				TTL: {	new_ttl: { def: "", pref: "  --ttl-set ", name: "ttl"} },
				LOG: {
					new_log_prefix: { def: "", pref: " --log-prefix \"", suff: "\"", name: "prefix", size: 60},
					new_log_level: { def: "", pref: " --log-level ", name: "level", size: 40}
				}
			}
		}
	},

	/**
	 * Cria um campo de texto HTML para o construtor de regras.
	 * @param {string} name - O ID do campo.
	 * @param {object} rule - O objeto de definição do campo do ruleBuilder.
	 * @returns {string} - O HTML do campo de texto.
	 */
	makeTextField: function(name, rule) {
		var value = '<input type="text" id="' + name + '"';
		if(rule.size) {
			value += ' style="width: ' + rule.size + 'px;"';
		}
		if(rule.hint) {
			value += ' placeholder="' + rule.hint + '"';
		}
		value += "/>";
		if(rule.sub) {
			for(var sub in rule.sub) {
				value += " " + rule.sub[sub].name + " " + tools.makeTextField(sub, rule.sub[sub]);
			}
		}
		return value;
	},
	
	/**
	 * Constrói e exibe o diálogo "Make rule" (Construtor de Regras).
	 */
	addDialogRule: function() {

		var text = "";
		for(var rule in tools.ruleBuilder) {
			var obj = tools.ruleBuilder[rule];
			var value = "";
			if(obj.list) {
				value = '<select id="' + rule + '" onchange="tools.setAction(this);">';
				for(var item in obj.list) {
					value += '<option>' + obj.list[item] + '</option>';
				}
				value += '</select>';
				if(obj.asvalue) {
					value += ' <span id="' + rule + '_sub"></span>';
				}
			}
			else {
				value = tools.makeTextField(rule, obj);
			}
			text += '<tr><td>' + obj.name + '</td><td>' + value + '</td></ts>';
		}
		$("#ruleTable").html(text);
		
		$("#makeRule").dialog({
			title:"Make rule",
			modal:true,
			resizable:false,
			width: 500,
			buttons: [
				{
					text: "Add",
					click: function() {
						var maker = function(rules) {
							var rule = "";
							for(var field in rules) {
								var obj = rules[field];
								var value = $("#" + field).val();
								if(value !== obj.def) {
									rule += obj.pref + value;
									if(obj.suff) {
										rule += obj.suff;
									}
									if(obj.asvalue) {
										rule += maker(obj.asvalue[value]);
									}
								}
								if(obj.sub && (obj.pdef || value !== obj.def)) {
									rule += maker(obj.sub);
								}
							}
							return rule;
						};

						var rule = maker(tools.ruleBuilder);
						$("#rule").val(rule);
						
						$("#makeRule").dialog("close");
					}
				},
				{
					text: "Reset",
					click: function() {
						var reset = function(rules) {
							for(var field in rules) {
								var obj = rules[field];
								$("#" + field).val(obj.def);
								if(obj.sub) {
									reset(obj.sub);
								}
								if(obj.asvalue) {
									$("#" + field).change();
									for(var field2 in obj.asvalue) {
										reset(obj.asvalue[field2]);
									}
								}
							}
						};
						reset(tools.ruleBuilder);
					}
				}
			]
		});
	},
	
	/**
	 * Atualiza dinamicamente os sub-campos no construtor de regras com base na ação selecionada (ex: DNAT, LOG).
	 * @param {object} obj - O elemento <select> da ação.
	 */
	setAction: function(obj) {
		var id = obj.id;
		if($("#" + id + "_sub").size() !== 0) {
			var text = "";
			for(var field in tools.ruleBuilder[id].asvalue[$("#" + id).val()]) {
				var obj = tools.ruleBuilder[id].asvalue[$("#" + id).val()][field];
				text += " " + obj.name + " " + tools.makeTextField(field, obj);
			}
			$("#" + id + "_sub").html(text);
		}
	},

	/**
	 * Inicia a conexão WebSocket com o servidor.
	 * @param {string} hello - A mensagem inicial a ser enviada ao servidor após a conexão.
	 */
	initWS: function(hello) {
		if(!webSocket) {
			var addr = window.location.toString().substr(7);
			addr = addr.substr(0, addr.indexOf(":"));
			addr = "ws://" + addr + ":8001";

			webSocket = new WebSocket(addr);
			webSocket.onopen = function(event) {
				webSocket.send(hello);
			};

			webSocket.onmessage = function(event) {
				var channel = JSON.parse(event.data);
				if(channel.name == "syslog") {
					for(var i = 0; i < channel.data.length; i++) {
						if(channel.data[i]) {
							$("#logs").append('<div>' + channel.data[i] + '</div>');
						}
					}
					$("#logs").parent().scrollTop(64536);
				}
				else if(channel.name == "dump") {
					for(var i = 0; i < channel.data.length; i++) {
						if(channel.data[i]) {
							var text = channel.data[i].replace(/IP ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/g, function(str, ip){
								return '<span class="ipt-net">' + ip + "</span>";
							}).replace(/> ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/g, function(str, ip){
								return '> <span class="ipt-net">' + ip + "</span>";
							});
							$("#dump").append('<div>' + text + '</div>');
						}
					}
					$("#dump").scrollTop(64536);
				}
			};

			webSocket.onclose = function(event) {
				webSocket = null;
			};
		}
		else {
			webSocket.send(hello);
		}
	},

	/**
	 * Envia uma mensagem para o servidor através do WebSocket (geralmente para fechar um stream).
	 * @param {string} name - A mensagem a ser enviada.
	 */
	closeWS: function(name){
		if(webSocket) {
			webSocket.send(name);
		}
	},
	
	/**
	 * Exibe o diálogo de logs do sistema e inicia o stream de logs via WebSocket.
	 */
	showLogs: function() {
		$("#syslog").dialog({
			title:"System logs",
			modal:false,
			resizable:true,
			width: 800,
			height: 400
		}).on('dialogclose', function(event) {
			tools.closeWS(JSON.stringify({name: "closelog"}));
		});
		tools.initWS(JSON.stringify({name: "syslog"}));
	},

	/**
	 * Exibe o diálogo do tcpdump.
	 */
	showTCPDump: function() {
		$("#tcpdump").dialog({
			title:"TCP dump",
			modal:false,
			resizable:true,
			width: 800,
			height: 400
		}).on('dialogclose', function(event) {
			tools.closeWS(JSON.stringify({name: "closedump"}));
			$("#dump").html("");
		});
	},

	/**
	 * Inicia ou reinicia o stream do tcpdump com os parâmetros fornecidos pelo usuário.
	 */
	dumpParams: function() {
		$("#dump").html("");
		tools.closeWS(JSON.stringify({name: "closedump"}));
		tools.initWS(JSON.stringify({name: "dump", eth: $("#eth").val(), src: $("#src").val(), dst: $("#dst").val(), port: $("#port").val()}));
	},

	/**
	 * Define o conteúdo do breadcrumb de navegação.
	 * @param {string} path - O HTML do breadcrumb.
	 */
	setChainPath: function(path) {
		$("#chainpath").html(path);
	}
};