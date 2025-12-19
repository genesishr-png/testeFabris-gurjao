/**
 * AI Agent Module for Sistema Financeiro
 * Handles Chat UI, Gemini API communication, and Context Gathering
 */

class AIAgent {
    constructor() {
        this.apiKey = localStorage.getItem('ai_api_key') || '';

        // Load and sanitize model
        let savedModel = localStorage.getItem('ai_model');
        // Strip 'models/' prefix if present
        if (savedModel && savedModel.startsWith('models/')) {
            savedModel = savedModel.replace('models/', '');
        }

        // Force update legacy/deprecated models to Flash
        if (savedModel === 'gemini-pro' || !savedModel) {
            console.log('Atualizando modelo legado para gemini-1.5-flash');
            savedModel = 'gemini-1.5-flash';
            localStorage.setItem('ai_model', savedModel);
        }

        this.model = savedModel;
        this.isOpen = false;
        this.messages = [];
        this.systemPrompt = `
            Você é um assistente financeiro de alta performance para um escritório de advocacia.
            Seu nome é "GENESIS".
            Você tem acesso aos dados financeiros do sistema em formato JSON.
            
            SUAS HABILIDADES:
            1. Analisar inadimplência e sugerir ações de cobrança.
            2. Calcular previsões de fluxo de caixa.
            3. Gerar mensagens de cobrança educadas e persuasivas para WhatsApp.
            4. Responder de forma concisa e profissional.

            REGRAS:
            - Responda sempre em Português do Brasil.
            - Use markdown para formatar listas e valores (negrito).
            - Se o usuário pedir para cobrar alguém, gere um LINK do WhatsApp (https://wa.me/55...) usando o telefone do cliente se disponível. Remova caracteres não numéricos do telefone no link.
            - O texto da mensagem deve ser educado e profissional.
        `;
    }

    init() {
        this.renderFloatingButton();
        this.renderChatWindow();
        this.renderSettingsModal();
        console.log('AI Agent Initialized 🤖');

        // Auto-detect best model on startup if key exists
        if (this.apiKey) {
            this.validateAndFixModel(this.apiKey);
        }
    }

    async validateAndFixModel(apiKey) {
        if (!apiKey) return;

        const select = document.getElementById('ai-model-select');
        const statusSpan = document.getElementById('ai-settings-status');

        if (statusSpan) {
            statusSpan.textContent = 'Testando conexão...';
            statusSpan.className = 'mt-4 p-3 rounded-lg text-sm bg-blue-900/20 text-blue-200 border border-blue-500/30 block';
        }

        if (select && (select.options.length === 0 || select.options[0].value === '')) {
            select.innerHTML = '';
            const opt = document.createElement('option');
            opt.value = this.model;
            opt.text = "Carregando modelos...";
            select.add(opt);
        }

        try {
            // 1. LIST MODELS
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Erro ao listar modelos:", errorData);

                let msg = "Erro de Conexão";
                if (response.status === 400) msg = "Chave Inválida (400)";
                if (response.status === 403) msg = "Sem Permissão (403)";

                throw new Error(`${msg}: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();

            if (select) {
                select.innerHTML = '';
                const models = (data.models || [])
                    .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''));

                if (models.length === 0) {
                    ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro'].forEach(m => models.push(m));
                }

                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.text = m;
                    opt.selected = m === this.model;
                    select.add(opt);
                });

                select.onchange = (e) => {
                    this.model = e.target.value;
                    localStorage.setItem('ai_model', this.model);
                    console.log('Modelo alterado manualmente para:', this.model);
                };
            }

            // 2. DIAGNOSTIC TEST (Small generation)
            if (statusSpan) statusSpan.textContent = 'Verificando permissões de escrita...';

            const testModel = (select && select.value) ? select.value : 'gemini-1.5-flash';
            const testResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Hello" }] }] })
            });

            if (!testResp.ok) {
                if (testResp.status === 403 || testResp.status === 400) {
                    throw new Error(`PERMISSÃO NEGADA (${testResp.status}): Sua chave pode listar mas não gerar. Ative a API Generative Language.`);
                }
                if (testResp.status === 429) {
                    throw new Error(`COTA EXCEDIDA (429): Limite gratuito atingido.`);
                }
            }

            if (statusSpan) {
                statusSpan.textContent = 'Conexão validada! ✅';
                statusSpan.className = 'mt-4 p-3 rounded-lg text-sm bg-green-900/20 text-green-200 border border-green-500/30 block font-bold';
            }

            this.model = testModel;
            localStorage.setItem('ai_model', this.model);

        } catch (error) {
            console.error('Falha na validação:', error);
            if (statusSpan) {
                statusSpan.innerHTML = `<span class="font-bold text-red-400">Erro: ${error.message}</span>`;
                statusSpan.className = 'mt-4 p-3 rounded-lg text-sm bg-red-900/20 text-red-200 border border-red-500/30 block';
            }

            // Fallback UI
            if (select && select.options.length <= 1) {
                select.innerHTML = '';
                ['gemini-1.5-flash', 'gemini-1.5-pro'].forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.text = m;
                    select.add(opt);
                });
            }
        }
    }

    // --- UI RENDERING ---

    renderFloatingButton() {
        const btn = document.createElement('button');
        btn.id = 'ai-fab';
        btn.innerHTML = '<img src="assets/robot-icon.png" class="w-full h-full object-cover rounded-full">';
        // Usar estilos inline para garantir posição e z-index
        btn.style.cssText = 'position: fixed; bottom: 24px; right: 24px; width: 64px; height: 64px; border-radius: 9999px; z-index: 9999; cursor: pointer; border: 2px solid rgba(255,255,255,0.2);';
        btn.className = `bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-2xl flex items-center justify-center hover:scale-110 transition-transform`;
        btn.onclick = () => this.toggleChat();
        document.body.appendChild(btn);
    }

    renderChatWindow() {
        const chat = document.createElement('div');
        chat.id = 'ai-chat-window';
        // Estilos inline garantidos
        chat.style.cssText = 'position: fixed; bottom: 96px; right: 24px; width: 384px; height: 600px; z-index: 9998; border-radius: 16px; display: flex; flex-direction: column; transition: all 0.3s ease;';
        chat.className = `bg-slate-900 border border-slate-700 shadow-2xl transform translate-y-10 opacity-0 pointer-events-none`;

        chat.innerHTML = `
    <!--Header -->
            <div class="h-16 bg-slate-800 rounded-t-2xl flex items-center justify-between px-4 border-b border-slate-700">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center overflow-hidden">
                        <img src="assets/robot-icon.png" class="w-full h-full object-cover">
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-sm">GENESIS</h3>
                        <p class="text-xs text-green-400 flex items-center gap-1">
                            <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online
                        </p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.aiAgent.openSettings()" class="text-slate-400 hover:text-white p-2">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button onclick="window.aiAgent.toggleChat()" class="text-slate-400 hover:text-white p-2">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>

            <!--Messages Area-- >
            <div id="ai-messages" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/50">
                <div class="flex gap-3">
                    <div class="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center overflow-hidden">
                        <img src="assets/robot-icon.png" class="w-full h-full object-cover">
                    </div>
                    <div class="bg-slate-800 text-slate-200 p-3 rounded-2xl rounded-tl-none text-sm max-w-[85%]">
                        Olá! Sou o GENESIS. Posso analisar seus contratos, identificar inadimplentes ou ajudar a redigir mensagens. Como posso ajudar hoje?
                    </div>
                </div>
            </div>

            <!--Input Area-- >
    <div class="p-4 bg-slate-800 rounded-b-2xl border-t border-slate-700">
        <div class="relative">
            <textarea id="ai-input"
                class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-12 resize-none custom-scrollbar"
                placeholder="Pergunte sobre seus dados..."
                rows="1"
                onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); window.aiAgent.sendMessage(); }"
            ></textarea>
            <button onclick="window.aiAgent.sendMessage()" class="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                <i class="fas fa-paper-plane text-xs"></i>
            </button>
        </div>
        <p class="text-[10px] text-slate-500 text-center mt-2">IA pode cometer erros. Verifique os dados.</p>
    </div>
`;
        document.body.appendChild(chat);
    }

    renderSettingsModal() {
        const modal = document.createElement('div');
        modal.id = 'ai-settings-modal';
        modal.className = 'fixed inset-0 bg-black/80 z-[10000] hidden flex items-center justify-center p-4 backdrop-blur-sm';
        modal.innerHTML = `
    < div class="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-6" >
                <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <i class="fas fa-key text-yellow-400"></i> Configuração da IA
                </h2>
                <p class="text-slate-400 text-sm mb-4">
                    Para usar o Cortex, você precisa de uma chave de API do Google Gemini.
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" class="text-indigo-400 underline hover:text-indigo-300">Obter chave grátis aqui.</a>
                </p>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">API KEY (Gemini)</label>
                        <input type="password" id="ai-api-key-input" 
                            class="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Ex: AIzaSy..."
                            value="${this.apiKey}"
                        >
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-300 mb-1">Modelo da IA</label>
                        <select id="ai-model-select" class="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                            <option value="" disabled selected>Carregando modelos...</option>
                        </select>
                        <p class="text-[10px] text-slate-500 mt-1">Selecione um modelo disponível para sua chave.</p>
                    </div>
                </div>
                
                <div id="ai-settings-status" class="mt-4 hidden p-3 rounded-lg text-sm"></div>

                <div class="flex justify-end gap-3 mt-6">
                    <button onclick="document.getElementById('ai-settings-modal').classList.add('hidden')" class="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancelar</button>
                    <button id="btn-save-ai" onclick="window.aiAgent.saveSettings()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2">
                        <i class="fas fa-check"></i> Verificar e Salvar
                    </button>
                </div>
            </div >
    `;
        document.body.appendChild(modal);
    }

    // --- ACTIONS ---

    toggleChat() {
        const chat = document.getElementById('ai-chat-window');
        const fab = document.getElementById('ai-fab');

        this.isOpen = !this.isOpen;

        if (this.isOpen) {
            chat.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
            // Auto focus input
            setTimeout(() => document.getElementById('ai-input').focus(), 100);
        } else {
            chat.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none');
        }
    }

    openSettings() {
        document.getElementById('ai-settings-modal').classList.remove('hidden');
        this.validateAndFixModel(); // Refresh models when opening settings
    }

    async saveSettings() {
        const keyInput = document.getElementById('ai-api-key-input');
        const key = keyInput.value.trim();
        const btn = document.getElementById('btn-save-ai');
        const statusDiv = document.getElementById('ai-settings-status');
        const modelSelect = document.getElementById('ai-model-select');

        if (!key) {
            alert('Por favor, insira uma chave válida.');
            return;
        }

        // UI Loading State
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
        statusDiv.className = 'mt-4 p-3 rounded-lg text-sm bg-blue-900/20 text-blue-200 border border-blue-500/30 block';
        statusDiv.innerHTML = 'Testando conexão com o Google Gemini...';

        try {
            // Update key locally for validation
            this.apiKey = key;

            // Re-validate to get fresh models with new key
            await this.validateAndFixModel();

            // Check if we have models now
            if (!modelSelect || modelSelect.options.length === 0 || modelSelect.options[0].disabled) {
                // If validation failed to populate, error out
                throw new Error('Chave inválida ou sem acesso a modelos Gemini.');
            }

            const selectedModel = modelSelect.value;
            this.model = selectedModel;
            localStorage.setItem('ai_api_key', key);
            localStorage.setItem('ai_model', selectedModel);

            statusDiv.className = 'mt-4 p-3 rounded-lg text-sm bg-green-900/20 text-green-200 border border-green-500/30 block';
            statusDiv.innerHTML = `< i class="fas fa-check-circle" ></i > Sucesso! Modelo < b > ${selectedModel}</b > configurado.`;

            setTimeout(() => {
                document.getElementById('ai-settings-modal').classList.add('hidden');
                this.addMessage('system', `Conectado com sucesso! Usando o modelo: ** ${selectedModel}**.`);
            }, 1500);

        } catch (error) {
            statusDiv.className = 'mt-4 p-3 rounded-lg text-sm bg-red-900/20 text-red-200 border border-red-500/30 block';
            statusDiv.innerHTML = `< i class="fas fa-times-circle" ></i > ${error.message} `;
            console.error(error);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Verificar e Salvar';
        }
    }

    async sendMessage() {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text) return;

        if (!this.apiKey) {
            this.openSettings();
            return;
        }

        // Add user message
        this.addMessage('user', text);
        input.value = '';

        // Show loading
        const loadingId = this.addLoading();

        try {
            const context1 = this.getFinancialContext();

            // Fallback strategy: try multiple models in order
            const modelsToTry = [
                this.model, // User selected or default
                'gemini-1.5-flash',
                'gemini-1.5-pro',
                'gemini-1.0-pro',
                'gemini-pro'
            ];

            // Remove duplicates
            const uniqueModels = [...new Set(modelsToTry)];

            let responseText = null;
            let lastError = null;

            for (const model of uniqueModels) {
                try {
                    console.log(`Tentando modelo: ${model}...`);
                    responseText = await this.callGeminiAPI(text, context1, model);

                    // If successful and different from current, save it primarily for next time
                    if (model !== this.model) {
                        this.model = model;
                        localStorage.setItem('ai_model', model);
                        console.log(`Modelo atualizado automaticamente para: ${model} `);
                    }
                    break; // Success!
                } catch (e) {
                    console.warn(`Falha no modelo ${model}: `, e);
                    lastError = e;
                    // Continue to next model
                }
            }

            if (!responseText) {
                throw lastError || new Error("Nenhum modelo disponível respondeu.");
            }

            this.removeLoading(loadingId);
            this.addMessage('ai', responseText);
        } catch (error) {
            this.removeLoading(loadingId);

            console.error("Erro fatal no envio:", error);

            let finalMsg = `Erro: ${error.message} `;

            if (error.message.includes('expired') || error.message.includes('key') || error.message.includes('API key')) {
                finalMsg = `
    < b >⚠️ Sua chave de API expirou ou é inválida.</b > <br><br>
        Você precisa gerar uma nova chave no Google.<br><br>
            <a href="https://aistudio.google.com/app/apikey" target="_blank" class="bg-indigo-600 text-white px-3 py-1 rounded text-xs hover:bg-indigo-500 inline-block mt-2">
                <i class="fas fa-external-link-alt"></i> Gerar Nova Chave
            </a>
            `;
            } else if (error.message.includes('not found') || error.message.includes('404')) {
                finalMsg = `
                    <b>⚠️ Erro de Modelo</b><br>
                    Não consegui acessar nenhum modelo Gemini com sua chave. Verifique se a chave tem permissões ou tente criar uma nova.
                `;
            }

            this.addMessage('system', finalMsg);
        }
    }

    async _tryModelsSequence(text, context) {
        // Sequência de "Força Bruta" para encontrar um modelo que funcione
        const models = [
            this.model,              // 1. O que o usuário escolheu
            'gemini-1.5-flash',      // 2. O mais rápido/barato
            'gemini-1.5-pro',        // 3. O mais inteligente
            'gemini-1.0-pro',        // 4. O estável antigo
            'gemini-pro'             // 5. O legado
        ];

        // Remove duplicados e vazios
        const uniqueModels = [...new Set(models.filter(m => m))];
        let lastError = null;

        for (const model of uniqueModels) {
            try {
                console.log(`[AI Retry] Tentando modelo: ${model}...`);
                const result = await this.callGeminiAPI(text, context, model);

                // Se funcionou e não era o padrão, atualiza o padrão para o futuro (Auto-Healing)
                if (model !== this.model) {
                    console.log(`[AI Auto-Fix] Modelo padrão atualizado para ${model} pois o anterior falhou.`);
                    this.model = model;
                    localStorage.setItem('ai_model', model);
                }

                return result; // SUCESSO! Retorna a resposta.
            } catch (e) {
                console.warn(`[AI Retry] Falha no modelo ${model}:`, e.message);
                lastError = e;
                // Continua para o próximo loop...
            }
        }

        // Se chegou aqui, todos falharam
        throw lastError || new Error("Todos os modelos falharam.");
    }

    addMessage(type, text) {
        const container = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.className = `flex gap-3 ${type === 'user' ? 'flex-row-reverse' : ''}`;

        const avatar = type === 'user'
            ? '<div class="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center"><i class="fas fa-user text-sm"></i></div>'
            : type === 'system'
                ? '<div class="w-8 h-8 rounded-full bg-red-500/20 flex-shrink-0 flex items-center justify-center"><i class="fas fa-exclamation text-red-500 text-sm"></i></div>'
                : '<div class="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center overflow-hidden"><img src="assets/robot-icon.png" class="w-full h-full object-cover"></div>';

        const bubbleClass = type === 'user'
            ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none'
            : type === 'system'
                ? 'bg-red-900/20 text-red-200 border border-red-500/30 rounded-2xl'
                : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-none';

        // Parse Markdown loosely
        const formattedText = text
            .replace(/\*\*(.*?)\*\*/g, '<b class="text-white">$1</b>') // Bold
            .replace(/\n/g, '<br>');

        div.innerHTML = `
                ${avatar}
                <div class="${bubbleClass} p-3 text-sm max-w-[85%] break-words leading-relaxed shadow-sm">
                    ${formattedText}
                </div>
                `;

        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    addLoading() {
        const container = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.id = 'ai-loading-' + Date.now();
        div.className = 'flex gap-3';
        div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center">
                    <i class="fas fa-robot text-sm"></i>
                </div>
                <div class="bg-slate-800 p-4 rounded-2xl rounded-tl-none flex gap-2 items-center">
                    <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                    <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                    <div class="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                </div>
                `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return div.id;
    }

    removeLoading(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // --- LOGIC ---

    getFinancialContext() {
        if (!window.App || !window.App.database || !window.App.database.contracts) {
            return "Dados indisponíveis (Erro de acesso ao App).";
        }

        const contracts = window.App.database.contracts || [];
        const activeContracts = contracts.filter(c => !c.isDeleted);

        let totalReceivable = 0;
        let totalOverdue = 0;
        let overdueClients = [];
        let allClientsSummary = []; // Para "enxergar tudo"

        activeContracts.forEach(c => {
            // Contexto Geral (Para saber que o cliente existe mesmo sem dívida)
            const contractSummary = {
                cliente: c.clientName,
                servicos: (c.serviceTypes || []).map(s => s.name).join(', '),
                status_geral: this.getContractStatus ? this.getContractStatus(c).statusText : 'Ativo'
            };
            allClientsSummary.push(contractSummary);

            if (!c.parcels) return;

            c.parcels.forEach(p => {
                if (p.status === 'Pendente') {
                    const dueDate = new Date(p.dueDate);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (dueDate < today) {
                        let val = p.value;
                        if (window.App.correctionCalculator) {
                            val = window.App.correctionCalculator.calcularValorCorrigido(p.value, p.dueDate);
                        }
                        totalOverdue += val;

                        overdueClients.push({
                            cliente: c.clientName,
                            valor_original: p.value,
                            valor_corrigido: val, // Mantém numérico para ordenar
                            vencimento: dueDate.toLocaleDateString('pt-BR'),
                            telefone: c.clientContact || 'Sem contato',
                            advogado: c.advogadoResponsavel
                        });
                    } else {
                        totalReceivable += p.value;
                    }
                }
            });
        });

        // 1. ORDENAÇÃO POR VALOR (Maior dívida primeiro) - Resolve o bug do Carlos Gadelha
        overdueClients.sort((a, b) => b.valor_corrigido - a.valor_corrigido);

        // 2. FORMATAÇÃO FINAL (Para texto)
        const topOverdueFormatted = overdueClients.slice(0, 50).map(d => ({
            ...d,
            valor_original: d.valor_original.toFixed(2),
            valor_corrigido: d.valor_corrigido.toFixed(2)
        }));

        console.log(`[AI Debug] Top Devedores Enviados: ${topOverdueFormatted.length}`);

        return JSON.stringify({
            resumo_financeiro: {
                total_contratos_ativos: activeContracts.length,
                total_a_receber_futuro: totalReceivable.toFixed(2),
                total_divida_vencida_corrigida: totalOverdue.toFixed(2),
                data_referencia: new Date().toLocaleDateString('pt-BR')
            },
            // Envia os TOP 50 devedores (ordenados por valor)
            lista_inadimplentes_prioritaria: topOverdueFormatted,
            // Envia uma lista simplificada de TODOS os clientes (para contexto geral)
            lista_todos_clientes: allClientsSummary.slice(0, 100)
        });
    }

    async callGeminiAPI(prompt, context, modelOverride = null) {
        const modelToUse = modelOverride || this.model;
        // Sanitization: Ensure no double 'models/' prefix
        const cleanModel = modelToUse.replace('models/', '');
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${this.apiKey}`;

        const fullPrompt = `${this.systemPrompt}\n\nCONTEXTO ATUAL DO SISTEMA:\n${context}\n\nPERGUNTA DO USUÁRIO: ${prompt}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: fullPrompt }] }]
                })
            });

            if (!response.ok) {
                const err = await response.json();
                const errorMessage = err.error?.message || 'Erro desconhecido';
                console.error(`[AI Agent] Erro na API (${cleanModel}):`, errorMessage);

                // SELF-HEALING: If model not found, switch to Flash and retry
                if (errorMessage.includes('not found') || errorMessage.includes('is not supported')) {
                    console.warn(`[AI Agent] Modelo ${cleanModel} falhou. Tentando auto-correção para gemini-1.5-flash...`);

                    if (cleanModel !== 'gemini-1.5-flash') {
                        this.model = 'gemini-1.5-flash';
                        localStorage.setItem('ai_model', 'gemini-1.5-flash');

                        // Recursive retry with the safe model
                        return this.callGeminiAPI(prompt, context, 'gemini-1.5-flash');
                    }
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            throw error;
        }
    }
}

// Global definition (Immediate)
window.aiAgent = new AIAgent();

// Robust Initialization
(function () {
    function startAI() {
        if (!window.aiAgent) window.aiAgent = new AIAgent();
        if (!document.getElementById('ai-fab')) {
            window.aiAgent.init();
            console.log('🤖 AI Agent Started via Direct Init');
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        startAI();
    } else {
        document.addEventListener('DOMContentLoaded', startAI);
    }

    // Backup: Ensure it runs even if events were missed
    setTimeout(startAI, 1000);
})();
