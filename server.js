// Módulos necessários - ip6tables Manager
var http = require('http');
var url = require('url');
var fs = require('fs');
var path = require('path');
var proc = require('child_process');
var ws = require('nodejs-websocket');

// Carregar arquivo de configuração
var config;
try {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    console.log('Configuração carregada com sucesso');
} catch (e) {
    console.error('Erro ao carregar configuração:', e);
    config = { httpPort: 1338, websocketPort: 8002 }; // Valores padrão caso o arquivo não possa ser lido
    console.log('Usando valores padrão para as portas');
}

// Módulos de manipuladores de rota
var handle = require('./handlers');
var handle_ext = require('./handlers_ext');

// --- Configuração de Rotas ---
var handles = {};

// Adiciona rotas do handlers.js
handles["/"] = handle.index;
handles["/channel"] = handle.showChannel;
handles["/delete"] = handle.deleteRule;
handles["/insert"] = handle.insertRule;
handles["/mon"] = handle.monitor;
handles["/save"] = handle.save;
handles["/load"] = handle.load;
handles["/settings"] = handle.settings;
handles["/chainlist"] = handle.chainList;
handles["/login"] = handle.authMe;
handles["/logout"] = handle.logout;
handles["/users"] = handle.userList;

// Adiciona rotas do handlers_ext.js
for (var key in handle_ext) {
    if (typeof handle_ext[key] === 'function') {
        handles["/" + key] = handle_ext[key];
    }
}

// Registrar explicitamente o endpoint editChain
handles["/editChain"] = handle_ext.editChain;

// Log de diagnóstico para verificar as rotas carregadas
console.log("Rotas carregadas:");
console.log(Object.keys(handles));

// --- Servidor HTTP ---
http.createServer(function (req, res) {
    var pathname = url.parse(req.url).pathname;
    req.setEncoding("utf8");

    // Permitir acesso a arquivos estáticos de tema e recursos necessários para a página de login
    if (pathname.startsWith('/theme/') || 
        pathname.startsWith('/img/') || 
        pathname === '/jquery.min.js' || 
        pathname === '/jquery-ui.css' || 
        pathname === '/jquery-ui.min.js' ||
        pathname === '/favicon.ico') {
        serveStaticFile(res, pathname);
        return;
    }
    
    // Verificar autenticação para todas as rotas exceto /login
    if (!handle.isAuth(req) && pathname !== '/login') {
        // Servir diretamente a página de login
        serveStaticFile(res, '/auth.html');
        return;
    }
    
    // Processar rotas normalmente quando autenticado
    if (handles[pathname]) {
        handles[pathname](req, res);
    } else {
        serveStaticFile(res, pathname);
    }

}).listen(config.httpPort);
console.log(`Servidor HTTP do ip6tables Manager rodando em http://*:${config.httpPort}/`);

function serveStaticFile(res, pathname) {
    var file = "./tpl" + (pathname === '/' ? '/index.html' : pathname);

    const mimeTypes = {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
        '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg',
        '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav',
        '.mp4': 'video/mp4', '.woff': 'application/font-woff', '.ttf': 'application/font-ttf',
        '.eot': 'application/vnd.ms-fontobject', '.otf': 'application/font-otf', '.wasm': 'application/wasm'
    };

    fs.readFile(file, function(error, content) {
        if (error) {
            if (error.code == 'ENOENT') {
                console.log("Arquivo estático não encontrado: " + pathname);
                res.writeHead(404, { "Content-Type": "text/plain" });
                res.write("404 Not found");
                res.end();
            } else {
                res.writeHead(500);
                res.end('Erro no servidor: ' + error.code);
            }
        } else {
            var extname = path.extname(file);
            var contentType = mimeTypes[extname] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
}

// --- Servidor WebSocket ---
var log = null;
var dump = null;

function closeLogs() {
    if (log) { log.kill('SIGHUP'); log = null; }
}

function closeDump() {
    if (dump) { dump.kill('SIGHUP'); dump = null; }
}

ws.createServer(function (conn) {
    conn.on("text", function (data) {
        var params = JSON.parse(data);
        switch (params.name) {
            case "syslog":
                log = proc.spawn("tail", ["-f", "/var/log/syslog"]);
                log.stdout.on('data', function (lines) {
                    if (log) conn.sendText(JSON.stringify({ name: params.name, data: lines.toString().split("\n") }));
                });
                break;
            case "dump":
                var args = ["-i", params.eth, "-n", "-l"];
                if (params.port) args.push("port", params.port);
                if (params.src) args.push("src", params.src);
                if (params.dst) {
                    if (params.src) args.push("or");
                    args.push("dst", params.dst);
                }
                conn.sendText(JSON.stringify({ name: params.name, data: ["Exec tcpdump with args: " + args.toString()] }));
                dump = proc.spawn("tcpdump", args);
                dump.stdout.on('data', function (lines) {
                    if (dump) conn.sendText(JSON.stringify({ name: params.name, data: lines.toString().split("\n") }));
                });
                break;
            case "closelog":
                closeLogs();
                break;
            case "closedump":
                closeDump();
                break;
        }
    });
    conn.on("close", function () {
        closeLogs();
        closeDump();
    });
}).listen(config.websocketPort);
console.log(`Servidor WebSocket do ip6tables Manager rodando na porta ${config.websocketPort}`);
