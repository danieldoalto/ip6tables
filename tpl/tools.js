// Arquivo de utilidades e carregamento de configurações.

// Objeto global para armazenar as configurações carregadas do servidor.
_settings = {};

// Ao carregar o documento, busca as configurações do servidor.
$(document).ready(function(){
	// Faz uma requisição GET para /settings para obter as configurações do usuário.
	$.get("/settings", function(data){
		_settings = JSON.parse(data);
        $(".param").each(function(index, obj){
            $(obj).val(_settings[obj.id]);
        });
		
		if(_settings.LANS) {
			for(var lan in _settings.LANS) {
				$("#lans").append(window.tpl.settingsLan(lan, _settings.LANS[lan]));
			}
		}
		else {
			_settings.LANS = {};
		}
		if(_settings.PORTS) {
			for(var port in _settings.PORTS) {
				$("#ports").append(window.tpl.settingsPort(port, _settings.PORTS[port]));
			}
		}
		else {
			_settings.PORTS = {};
		}
		
		if(_settings.pass) {
			$("#logout").show();
		}

		$("#theme").attr("href", "theme/" + _settings.theme + ".css");
		for(var i in _settings.themes) {
			var theme = _settings.themes[i];
			$("#themeSelector").append("<option " + (theme == _settings.theme ? "selected" : "") + ">" + theme + "</option>");
		}
		$("#themeSelector").on("change", function(){
			$("#theme").attr("href",  "theme/" + this.value + ".css");
			_settings.theme = this.value;
		});
	});
});

/**
 * Exibe uma mensagem de erro para o usuário.
 * A mensagem desaparece ao ser clicada.
 * @param {string} text - O texto do erro a ser exibido.
 */
function showError(text) {
	$(".error").html(text).fadeIn().click(function(){
		$(this).fadeOut();
	});
}

/**
 * Exibe uma mensagem informativa para o usuário.
 * A mensagem desaparece ao ser clicada.
 * @param {string} text - O texto da informação a ser exibida.
 */
function showInfo(text) {
	$(".info").html(text).fadeIn().click(function(){
		$(this).fadeOut();
	});
}