// Este script carrega dinamicamente os assets (CSS e JS) com base nas configurações em config.js

(function() {
    // Lista de todos os assets necessários para a aplicação
    const assets = {
        css: [
            'jquery-ui.css',
            'theme/Silver.css',
            'backup-modal.css'
        ],
        js: [
            'jquery.min.js',
            'jquery-ui.min.js',
            'template.js',
            'tools.js',
            'client.js',
            'app.js'
        ]
    };

    // Determina o caminho base a ser usado
    const basePath = appConfig.use_absolute_paths ? appConfig.asset_path : '';

    // Carrega os arquivos CSS
    assets.css.forEach(function(file) {
        // O ID 'theme' é especial e precisa ser mantido para a funcionalidade de troca de tema
        const idAttribute = file.includes('theme') ? 'id="theme"' : '';
        document.write('<link rel="stylesheet" ' + idAttribute + ' href="' + basePath + file + '" type="text/css"/>');
    });

    // Carrega os arquivos JS
    assets.js.forEach(function(file) {
        document.write('<script type="text/javascript" src="' + basePath + file + '"></script>');
    });

})();
