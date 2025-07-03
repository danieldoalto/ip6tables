// handlers_ext.js - ip6tables Manager

// Módulo para executar comandos do sistema
const { exec } = require('child_process');
const fs = require('fs');
const querystring = require('querystring');

/**
 * Envia uma resposta de erro padronizada.
 */
function sendError(res, message) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: false, error: message }));
}

/**
 * Manipulador para a rota /backupRules.
 * Executa 'ip6tables-save' e envia o resultado como um arquivo para download.
 */
function backupRules(req, res) {
    console.log("Request handler 'backupRules' was called.");

    exec("sudo ip6tables-save", function(error, stdout, stderr) {
        if (error) {
            console.error("Error executing ip6tables-save: " + stderr);
            return sendError(res, `Error generating backup: ${stderr}`);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `ip6tables-backup-${timestamp}.rules`;

        res.writeHead(200, {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${fileName}"`
        });

        res.write(stdout);
        res.end();
    });
}

/**
 * Manipulador para a rota /restoreRules.
 * Recebe o conteúdo de um arquivo de regras e o aplica usando 'ip6tables-restore'.
 */
function restoreRules(req, res) {
    console.log("Request handler 'restoreRules' was called.");
    
    let postData = "";
    req.on("data", function(postDataChunk) {
        postData += postDataChunk;
    });

    req.on("end", function() {
        const parsedData = querystring.parse(postData);
        const rulesContent = parsedData.content;
        const tempFilePath = '/tmp/ip6tables.restore';

        if (!rulesContent) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: "No content provided." }));
            return;
        }

        fs.writeFile(tempFilePath, rulesContent, (err) => {
            if (err) {
                console.error("Error writing temp restore file:", err);
                return sendError(res, "Server error writing temp file.");
            }

            exec(`sudo ip6tables-restore < ${tempFilePath}`, (error, stdout, stderr) => {
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting temp restore file:", unlinkErr);
                });

                if (error) {
                    console.error(`Error executing ip6tables-restore: ${stderr}`);
                    return sendError(res, stderr || "Unknown error during restore");
                }

                console.log(`ip6tables-restore output: ${stdout}`);
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ success: true }));
            });
        });
    });
}

/**
 * Gera uma pré-visualização de como as regras ficarão após a movimentação.
 * Não aplica nenhuma mudança, apenas retorna o estado antigo e o novo proposto.
 */
function previewMoveRules(req, res) {
    console.log("\n--- Request handler 'previewMoveRules' was called. ---");

    let postData = "";
    req.on("data", (chunk) => { postData += chunk; });

    req.on("end", () => {
        const params = querystring.parse(postData);
        const { table, chain, start, end, targetIndex } = params;

        const startNum = parseInt(start, 10);
        const endNum = parseInt(end, 10);
        const targetNum = parseInt(targetIndex, 10);

        if (!table || !chain || isNaN(startNum) || isNaN(endNum) || isNaN(targetNum)) {
            return sendError(res, "Parâmetros ausentes ou inválidos.");
        }

        const saveCmd = `sudo ip6tables-save -t ${table}`;
        exec(saveCmd, (error, stdout, stderr) => {
            if (error) {
                return sendError(res, `Falha ao executar ip6tables-save: ${stderr}`);
            }

            try {
                const allLines = stdout.split('\n');
                const chainRegex = new RegExp(`^-A ${chain} `, 'i');
                const originalChainRules = allLines.filter(line => chainRegex.test(line));

                if (startNum <= 0 || endNum < startNum || endNum > originalChainRules.length) {
                    return sendError(res, `Intervalo de regras (A=${startNum}, B=${endNum}) inválido para a chain com ${originalChainRules.length} regras.`);
                }
                if (targetNum <= 0 || targetNum > originalChainRules.length + 1) {
                    return sendError(res, `Posição de destino (C=${targetNum}) inválida.`);
                }
                if (targetNum >= startNum && targetNum <= endNum + 1) {
                    return sendError(res, `A posição de destino não pode estar dentro do intervalo de origem.`);
                }

                // IMPORTANT: Create a copy for manipulation
                const newChainRules = [...originalChainRules];
                const blockToMove = newChainRules.splice(startNum - 1, endNum - startNum + 1);
                
                let insertionIndex = targetNum - 1;
                if (insertionIndex >= (startNum - 1)) {
                    insertionIndex -= blockToMove.length;
                }
                
                newChainRules.splice(insertionIndex, 0, ...blockToMove);

                const formatForPreview = (rules) => {
                    if (!rules) return ""; // Safety check
                    return rules.map((line, index) => `${String(index + 1).padStart(3, ' ')}  ${line}`).join('\n');
                };
                
                const oldRulesText = formatForPreview(originalChainRules);
                const newRulesText = formatForPreview(newChainRules);

                // --- DETAILED DEBUG LOGGING ---
                console.log("\n[DEBUG] --- Preview Data ---");
                console.log(`[DEBUG] Chain: ${chain}, Table: ${table}`);
                console.log(`[DEBUG] Original rules count: ${originalChainRules.length}`);
                console.log("[DEBUG] Original rules array:", JSON.stringify(originalChainRules, null, 2));
                console.log(`[DEBUG] New rules count: ${newChainRules.length}`);
                console.log("[DEBUG] New rules array:", JSON.stringify(newChainRules, null, 2));
                console.log("--- End Preview Data ---\n");
                // --- END LOGGING ---

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    oldRules: oldRulesText,
                    newRules: newRulesText
                }));

            } catch (e) {
                console.error("[FATAL] Erro inesperado no previewMoveRules:", e);
                return sendError(res, `Erro interno ao processar as regras: ${e.message}`);
            }
        });
    });
}

/**
 * Move um bloco de regras de uma posição para outra de forma atômica.
 * Utiliza ip6tables-save e ip6tables-restore para garantir a integridade.
 */
function moveRulesBlock(req, res) {
    console.log("\n--- Request handler 'moveRulesBlock' was called. ---");

    let postData = "";
    req.on("data", (chunk) => { postData += chunk; });

    req.on("end", () => {
        const params = querystring.parse(postData);
        console.log("[DEBUG] Parâmetros recebidos para moveRulesBlock:", params);
        const { table, chain, start, end, targetIndex } = params;

        const startNum = parseInt(start, 10);
        const endNum = parseInt(end, 10);
        const targetNum = parseInt(targetIndex, 10);

        console.log(`[DEBUG] Parâmetros parseados: table=${table}, chain=${chain}, start=${startNum}, end=${endNum}, targetIndex=${targetNum}`);

        if (!table || !chain || isNaN(startNum) || isNaN(endNum) || isNaN(targetNum)) {
            console.error(`[ERROR] Parâmetros inválidos: table=${table}, chain=${chain}, start=${startNum}, end=${endNum}, targetIndex=${targetNum}`);
            return sendError(res, "Parâmetros ausentes ou inválidos.");
        }

        // Primeiro, obter as regras atuais para manipulação
        const saveCmd = `sudo ip6tables-save -t ${table}`;
        console.log(`[DEBUG] Executando comando: ${saveCmd}`);
        exec(saveCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`[ERROR] Falha ao executar ip6tables-save: ${stderr}`);
                return sendError(res, `Falha ao executar ip6tables-save: ${stderr}`);
            }

            try {
                console.log("[DEBUG] ip6tables-save executado com sucesso.");
                const lines = stdout.split('\n');
                
                // Identificar regras da chain atual e outras regras
                const chainRegex = new RegExp(`^-A ${chain} `, 'i');
                const chainRules = lines.filter(line => chainRegex.test(line));
                
                // Todas as outras linhas (cabeçalhos, outras chains, etc.)
                const otherLines = lines.filter(line => !chainRegex.test(line) && line.trim() !== '');
                
                console.log(`[DEBUG] Encontradas ${chainRules.length} regras na chain '${chain}'`);
                console.log(`[DEBUG] Encontradas ${otherLines.length} outras linhas de configuração`);

                // Validar parâmetros
                if (startNum <= 0 || endNum < startNum || endNum > chainRules.length) {
                    const errorMsg = `Intervalo de regras (A=${startNum}, B=${endNum}) inválido para chain com ${chainRules.length} regras.`;
                    console.error(`[ERROR] ${errorMsg}`);
                    return sendError(res, errorMsg);
                }
                if (targetNum <= 0 || targetNum > chainRules.length + 1) {
                    const errorMsg = `Posição de destino (C=${targetNum}) inválida. Deve estar entre 1 e ${chainRules.length + 1}.`;
                    console.error(`[ERROR] ${errorMsg}`);
                    return sendError(res, errorMsg);
                }
                if (targetNum >= startNum && targetNum <= endNum + 1) {
                    const errorMsg = `A posição de destino (C=${targetNum}) não pode estar dentro do intervalo de origem [A=${startNum}, B=${endNum}+1].`;
                    console.error(`[ERROR] ${errorMsg}`);
                    return sendError(res, errorMsg);
                }

                // Manipular as regras em memória
                console.log(`[DEBUG] Manipulando regras: movendo bloco de ${startNum} a ${endNum} para posição ${targetNum}`);
                
                // Criar uma cópia das regras para manipulação
                const workingRules = [...chainRules];
                
                // Remover o bloco a ser movido
                const blockToMove = workingRules.splice(startNum - 1, endNum - startNum + 1);
                console.log(`[DEBUG] Bloco de ${blockToMove.length} regras removido`);
                
                // Calcular o índice de inserção correto
                let insertionIndex = targetNum - 1;
                if (insertionIndex >= startNum - 1) {
                    insertionIndex -= blockToMove.length;
                    console.log(`[DEBUG] Índice de inserção ajustado para ${insertionIndex}`);
                }
                
                // Inserir o bloco na nova posição
                workingRules.splice(insertionIndex, 0, ...blockToMove);
                console.log(`[DEBUG] Bloco inserido na posição ${insertionIndex}`);
                
                // Encontrar onde inserir as regras da chain no arquivo completo
                console.log("[DEBUG] Reconstruindo arquivo de regras completo");
                
                // Encontrar a linha COMMIT para saber onde inserir as regras
                const commitIndex = otherLines.findIndex(line => line.trim() === 'COMMIT');
                if (commitIndex === -1) {
                    console.error("[ERROR] Não foi possível encontrar a linha COMMIT nas regras");
                    return sendError(res, "Erro ao processar arquivo de regras: linha COMMIT não encontrada");
                }
                console.log(`[DEBUG] Índice da linha COMMIT: ${commitIndex}`);
                
                // Abordagem nova: remover TODAS as regras da chain atual e inserir apenas as novas
                // Filtrar para manter apenas linhas que NÃO são da chain atual
                const filteredLines = otherLines.filter(line => {
                    return !line.match(new RegExp(`^-A ${chain}\s`, 'i'));
                });
                
                console.log(`[DEBUG] Linhas após remover regras da chain '${chain}': ${filteredLines.length}`);
                
                // Reconstruir o arquivo de regras:
                // 1. Linhas até COMMIT (excluindo regras da chain atual)
                // 2. Novas regras da chain manipuladas
                // 3. Linha COMMIT e o que vier depois
                const finalRules = [
                    ...filteredLines.slice(0, commitIndex),
                    ...workingRules,
                    ...filteredLines.slice(commitIndex)
                ];
                
                console.log(`[DEBUG] Total de regras reconstruídas: ${finalRules.length}`);
                const newRulesContent = finalRules.join('\n');
                
                // Aplicar as novas regras com ip6tables-restore
                const restoreCmd = `sudo ip6tables-restore`;
                console.log(`[DEBUG] Executando comando: ${restoreCmd}`);
                
                const restoreProcess = exec(restoreCmd, (restoreError, restoreStdout, restoreStderr) => {
                    if (restoreError) {
                        console.error(`[ERROR] Erro ao restaurar regras: ${restoreStderr}`);
                        return sendError(res, `Falha ao aplicar as novas regras: ${restoreStderr}`);
                    }
                    console.log("[DEBUG] Regras aplicadas com sucesso.");
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                });

                console.log("[DEBUG] Enviando regras para o processo ip6tables-restore");
                restoreProcess.stdin.write(newRulesContent);
                restoreProcess.stdin.end();
                console.log("[DEBUG] Dados enviados para ip6tables-restore");

            } catch (e) {
                console.error("[FATAL] Erro inesperado no moveRulesBlock:", e);
                return sendError(res, `Erro interno ao processar as regras: ${e.message}`);
            }
        });
    });
}

/**
 * Manipulador para a rota /editChain.
 * Permite carregar e salvar regras de uma chain específica em formato textual.
 */
function editChain(req, res) {
    console.log("Request handler 'editChain' was called.");
    
    // Extrair dados da requisição
    var body = '';
    req.on('data', function(data) {
        body += data;
    });
    
    req.on('end', function() {
        try {
            var post = querystring.parse(body);
            console.log("[editChain] Dados recebidos:", post);
            console.log("[editChain] Chain:", post.chain, "Table:", post.table, "Action:", post.action);
            
            if (!post.chain || !post.table) {
                return sendError(res, "Chain e table são parâmetros obrigatórios.");
            }
            
            let chain = post.chain;
            let table = post.table;
            const action = post.action || 'load'; // Default é 'load'
            
            // Normalizar nomes de chains padrão (case insensitive)
            const standardChains = {
                "input": "INPUT",
                "forward": "FORWARD",
                "output": "OUTPUT",
                "prerouting": "PREROUTING",
                "postrouting": "POSTROUTING"
            };
            
            // Se o nome da chain fornecido for uma versão em minúsculo de uma chain padrão, normalize
            if (standardChains[chain.toLowerCase()]) {
                const originalChain = chain;
                chain = standardChains[chain.toLowerCase()];
                console.log(`[editChain] Chain normalizada de ${originalChain} para ${chain}`);
            }
            
            // Normalizar nomes de tabelas (case insensitive)
            const standardTables = {
                "filter": "filter", 
                "nat": "nat", 
                "mangle": "mangle", 
                "raw": "raw", 
                "security": "security"
            };
            
            // Se o nome da tabela fornecido for uma versão diferente de case de uma tabela padrão, normalize
            if (standardTables[table.toLowerCase()]) {
                const originalTable = table;
                table = standardTables[table.toLowerCase()];
                console.log(`[editChain] Tabela normalizada de ${originalTable} para ${table}`);
            }
            
            console.log(`[editChain] Chain: ${chain} Table: ${table} Action: ${action}`);

            // Ação de carregar regras
            if (action === 'load') {
                console.log(`[editChain] Carregando regras da chain ${chain} na tabela ${table}`);
                
                // Executar ip6tables-save e filtrar apenas a chain desejada
                exec("sudo ip6tables-save", function(error, stdout, stderr) {
                    if (error) {
                        console.error("[editChain] Erro ao executar ip6tables-save:", stderr);
                        return sendError(res, `Erro ao carregar regras: ${stderr}`);
                    }
                    
                    try {
                        // Processar saída para extrair apenas as regras da chain desejada
                        console.log(`[editChain] DEBUG: Processando regras para chain ${chain} na tabela ${table}`);
                        const lines = stdout.split('\n');
                        console.log(`[editChain] DEBUG: Total de linhas no output: ${lines.length}`);
                        
                        let chainFound = false;
                        let currentTable = '';
                        let rules = [];
                        let lineNumber = 1;
                        
                        // Log das primeiras linhas para debug
                        console.log("[editChain] DEBUG: Primeiras 10 linhas do output:");
                        for (let i = 0; i < Math.min(10, lines.length); i++) {
                            console.log(`[editChain] DEBUG: ${i}: ${lines[i]}`);
                        }
                        
                        for (const line of lines) {
                            // Detectar a tabela atual
                            if (line.startsWith('*')) {
                                currentTable = line.substring(1).trim();
                                console.log(`[editChain] DEBUG: Tabela atual alterada para: ${currentTable}`);
                                continue;
                            }
                            
                            // Detectar o início da chain
                            if (line.startsWith(':')) {
                                console.log(`[editChain] DEBUG: Linha de definição de chain: ${line}`);
                                // Verificar se a linha define a chain que estamos procurando na tabela correta
                                // O formato é algo como ":CHAIN POLICY [COUNTERS]" - então procuramos ":chain " ou ":chain"
                                const chainName = line.split(" ")[0].substring(1);
                                if (chainName === chain && currentTable === table) {
                                    chainFound = true;
                                    console.log(`[editChain] DEBUG: Chain ${chain} encontrada na tabela ${table}`);
                                }
                                continue;
                            }
                            
                            // Se estamos na tabela correta, verificar se a regra pertence à chain
                            if (currentTable === table && !line.startsWith(':') && !line.startsWith('*') && !line.startsWith('COMMIT')) {
                                // Verificar se a regra pertence à chain atual
                                if (line.includes(`-A ${chain} `) || line === `-A ${chain}`) {
                                    console.log(`[editChain] DEBUG: Regra encontrada: ${line}`);
                                    // Adicionar número da linha antes da regra
                                    rules.push(`${lineNumber++}: ${line}`);
                                }
                            }
                        }
                        
                        console.log(`[editChain] DEBUG: Chain encontrada? ${chainFound}, Total de regras encontradas: ${rules.length}`);
                        
                        // Se a chain não foi encontrada, retornar erro
                        if (!chainFound) {
                            console.log(`[editChain] ERRO: Chain ${chain} não encontrada na tabela ${table}.`);
                            return sendError(res, `Chain ${chain} não encontrada na tabela ${table}.`);
                        }
                        
                        // Se a chain não tem regras, apenas gerar log, mas não é erro
                        if (rules.length === 0) {
                            console.log(`[editChain] AVISO: A chain ${chain} na tabela ${table} não possui regras.`);
                        }
                        
                        // Enviar as regras para o frontend
                        res.writeHead(200, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({
                            success: true,
                            rules: rules.join('\n')
                        }));
                        console.log(`[editChain] ${rules.length} regras carregadas com sucesso.`);
                    } catch (err) {
                        console.error("[editChain] Erro ao processar regras:", err);
                        return sendError(res, `Erro ao processar regras: ${err.message}`);
                    }
                });
            }
            // Ação de salvar regras
            else if (action === 'save') {
                console.log(`[editChain] Salvando regras para a chain ${chain} na tabela ${table}`);
                
                if (!post.rules) {
                    return sendError(res, "Nenhuma regra fornecida para salvar.");
                }
                
                const editedRules = post.rules;
                
                // Primeiro, obter todo o conjunto de regras atual
                exec("sudo ip6tables-save", function(error, stdout, stderr) {
                    if (error) {
                        console.error("[editChain] Erro ao executar ip6tables-save:", stderr);
                        return sendError(res, `Erro ao obter regras atuais: ${stderr}`);
                    }
                    
                    try {
                        // Processar o arquivo de regras atual
                        const lines = stdout.split('\n');
                        console.log(`[editChain] DEBUG: Total de linhas no output: ${lines.length}`);
                        
                        // Remover números de linha do texto editado pelo usuário
                        console.log(`[editChain] DEBUG: Regras brutas recebidas:\n${editedRules}`);
                        const userRules = editedRules.split('\n')
                            .map(line => {
                                // Remover padrão "12: " do início das linhas
                                const cleanedLine = line.replace(/^\d+:\s*/, '');
                                console.log(`[editChain] DEBUG: Linha original: "${line}" -> Limpa: "${cleanedLine}"`);
                                return cleanedLine;
                            })
                            .filter(line => line.trim() !== '');
                        
                        console.log(`[editChain] DEBUG: Regras editadas do usuário após limpeza: ${userRules.length}`);
                        console.log(`[editChain] DEBUG: Regras processadas para aplicação:\n${userRules.join('\n')}`);
                        
                        
                        // ABORDAGEM BASEADA NO moveRulesBlock:
                        // 1. Identificar regras da chain atual e outras linhas
                        console.log(`[editChain] DEBUG: Verificando regras para chain ${chain} (case insensitive)`);                        
                        
                        // Adicionar logs para verificar o formato exato das regras antes do filtro
                        let chainRules = [];
                        let otherLines = [];
                        
                        // Imprimir algumas regras para debug e verificar formato exato
                        console.log('[editChain] DEBUG: Exemplos de linhas de regras para análise:');
                        for (let i = 0; i < Math.min(10, lines.length); i++) {
                            console.log(`[editChain] DEBUG: Linha ${i}: ${lines[i]}`);
                        }
                        
                        // Verificação mais simples e robusta
                        for (const line of lines) {
                            // Verificamos simplesmente se a linha começa com -A seguido do nome da chain (case insensitive)
                            // Usamos uma abordagem mais simples e robusta
                            if (line.trim() !== '') {
                                const lineUpper = line.toUpperCase();
                                const chainUpper = chain.toUpperCase();
                                if (lineUpper.indexOf(`-A ${chainUpper}`) === 0) {
                                    console.log(`[editChain] DEBUG: Regra identificada para remoção: ${line}`);
                                    chainRules.push(line);
                                } else {
                                    otherLines.push(line);
                                }
                            }
                        }
                        
                        console.log(`[editChain] DEBUG: Total de regras identificadas da chain ${chain}: ${chainRules.length}`);
                        console.log(`[editChain] DEBUG: Linhas mantidas (sem as regras da chain atual): ${otherLines.length}`);
                        
                        // 2. Encontrar onde inserir as novas regras (antes do COMMIT da tabela correspondente)
                        // Percorrer o array para encontrar o índice exato do COMMIT para a tabela correta
                        let currentTable = '';
                        let commitIndex = -1;
                        
                        for (let i = 0; i < otherLines.length; i++) {
                            const line = otherLines[i];
                            
                            if (line.startsWith('*')) {
                                currentTable = line.substring(1).trim();
                                continue;
                            }
                            
                            if (line === 'COMMIT' && currentTable === table) {
                                commitIndex = i;
                                break;
                            }
                        }
                        
                        if (commitIndex === -1) {
                            console.error(`[editChain] ERRO: Não foi possível encontrar o ponto de inserção para a tabela ${table}`);
                            return sendError(res, `Tabela ${table} não encontrada ou formato inesperado.`);
                        }
                        
                        console.log(`[editChain] DEBUG: Ponto de inserção encontrado: antes da linha ${commitIndex} (COMMIT da tabela ${table})`);
                        
                        // 3. Reconstruir o arquivo de regras completo
                        const finalRules = [
                            ...otherLines.slice(0, commitIndex),
                            ...userRules,  // Inserir as regras editadas pelo usuário
                            ...otherLines.slice(commitIndex)
                        ];
                        
                        console.log(`[editChain] DEBUG: Total de regras reconstruídas: ${finalRules.length}`);
                        
                        // 4. Aplicar as novas regras com iptables-restore
                        const rulesContent = finalRules.join('\n');
                        
                        // Aplicar as novas regras usando pipe para iptables-restore
                        const restoreProcess = exec('sudo ip6tables-restore', (restoreError, restoreStdout, restoreStderr) => {
                            if (restoreError) {
                                console.error(`[editChain] ERRO: Falha ao aplicar regras: ${restoreStderr}`);
                                return sendError(res, `Erro ao aplicar regras editadas: ${restoreStderr}`);
                            }
                            
                            console.log("[editChain] Regras aplicadas com sucesso.");
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ 
                                success: true,
                                message: "Regras atualizadas com sucesso."
                            }));
                        });
                        
                        console.log("[editChain] Enviando regras para iptables-restore...");
                        restoreProcess.stdin.write(rulesContent);
                        restoreProcess.stdin.end();
                    } catch (err) {
                        console.error("[editChain] Erro ao processar regras editadas:", err);
                        return sendError(res, `Erro ao processar regras editadas: ${err.message}`);
                    }
                });
            }
            else {
                return sendError(res, `Ação desconhecida: ${action}`);
            }
        } catch (error) {
            console.error("[editChain] Erro ao processar requisição:", error);
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ 
                success: false, 
                error: "Erro ao processar requisição: " + error.message 
            }));
        }
    });
}

// Exporta os novos manipuladores para que o server.js possa usá-los.
exports.backupRules = backupRules;
exports.restoreRules = restoreRules;
exports.moveRulesBlock = moveRulesBlock;
exports.previewMoveRules = previewMoveRules;
exports.editChain = editChain;

// Adiciona os novos manipuladores ao objeto module.exports
module.exports = exports;
