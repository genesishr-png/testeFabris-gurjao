/**
 * AI Agent Module for Sistema Financeiro
 * Handles Chat UI, Gemini API communication, and Context Gathering
 */

class AIAgent {
    constructor() {
        this.apiKey = localStorage.getItem('ai_api_key') || '';
        this.model = 'gemini-1.5-flash'; // Cost-effective and fast
        this.isOpen = false;
        this.messages = [];
        this.systemPrompt = `
            Você é um assistente financeiro de alta performance para um escritório de advocacia.
            Seu nome é "Cortex".
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
    }

    // --- UI RENDERING ---

    renderFloatingButton() {
        const btn = document.createElement('button');
        btn.id = 'ai-fab';
        btn.innerHTML = '<i class="fas fa-robot text-2xl"></i>';
        btn.className = `
            fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 
            text-white rounded-full shadow-2xl flex items-center justify-center 
            hover:scale-110 transition-transform cursor-pointer z-[9999]
            border-2 border-white/20
        `;
        btn.onclick = () => this.toggleChat();
        document.body.appendChild(btn);
    }

    renderChatWindow() {
        const chat = document.createElement('div');
        chat.id = 'ai-chat-window';
        chat.className = `
            fixed bottom-24 right-6 w-96 h-[600px] bg-slate-900 
            border border-slate-700 rounded-2xl shadow-2xl flex flex-col 
            transition-all duration-300 transform translate-y-10 opacity-0 pointer-events-none z-[9998]
        `;

        chat.innerHTML = `
            <!-- Header -->
            <div class="h-16 bg-slate-800 rounded-t-2xl flex items-center justify-between px-4 border-b border-slate-700">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                        <i class="fas fa-brain text-white"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-white text-sm">Cortex IA</h3>
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

            <!-- Messages Area -->
            <div id="ai-messages" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900/50">
                <div class="flex gap-3">
                    <div class="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center">
                        <i class="fas fa-robot text-sm"></i>
                    </div>
                    <div class="bg-slate-800 text-slate-200 p-3 rounded-2xl rounded-tl-none text-sm max-w-[85%]">
                        Olá! Sou o Cortex. Posso analisar seus contratos, identificar inadimplentes ou ajudar a redigir mensagens. Como posso ajudar hoje?
                    </div>
                </div>
            </div>

            <!-- Input Area -->
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
            <div class="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl p-6">
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
                </div>
                <div class="flex justify-end gap-3 mt-6">
                    <button onclick="document.getElementById('ai-settings-modal').classList.add('hidden')" class="px-4 py-2 text-slate-300 hover:text-white transition-colors">Cancelar</button>
                    <button onclick="window.aiAgent.saveSettings()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">Salvar</button>
                </div>
            </div>
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
    }

    saveSettings() {
        const key = document.getElementById('ai-api-key-input').value.trim();
        if (!key) {
            alert('Por favor, insira uma chave válida.');
            return;
        }
        this.apiKey = key;
        localStorage.setItem('ai_api_key', key);
        document.getElementById('ai-settings-modal').classList.add('hidden');
        this.addMessage('system', 'Chave de API salva com sucesso! Agora estou pronto para trabalhar.');
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
            const response = await this.callGeminiAPI(text, context1);

            this.removeLoading(loadingId);
            this.addMessage('ai', response);
        } catch (error) {
            this.removeLoading(loadingId);
            this.addMessage('system', `Erro: ${error.message}`);
        }
    }

    addMessage(type, text) {
        const container = document.getElementById('ai-messages');
        const div = document.createElement('div');
        div.className = `flex gap-3 ${type === 'user' ? 'flex-row-reverse' : ''}`;

        const avatar = type === 'user'
            ? '<div class="w-8 h-8 rounded-full bg-slate-600 flex-shrink-0 flex items-center justify-center"><i class="fas fa-user text-sm"></i></div>'
            : type === 'system'
                ? '<div class="w-8 h-8 rounded-full bg-red-500/20 flex-shrink-0 flex items-center justify-center"><i class="fas fa-exclamation text-red-500 text-sm"></i></div>'
                : '<div class="w-8 h-8 rounded-full bg-indigo-500 flex-shrink-0 flex items-center justify-center"><i class="fas fa-robot text-sm"></i></div>';

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
        // Access the main App instance (window.App) to get data
        if (!window.App || !window.App.database) return "Dados indisponíveis.";

        const contracts = window.App.database.contracts || [];
        const activeContracts = contracts.filter(c => !c.isDeleted);

        // Calculate totals
        let totalReceivable = 0;
        let totalOverdue = 0;
        let overdueClients = [];

        activeContracts.forEach(c => {
            (c.parcels || []).forEach(p => {
                if (p.status === 'Pendente') {
                    const dueDate = new Date(p.dueDate);
                    const today = new Date();
                    if (dueDate < today) {
                        overdueClients.push({
                            cliente: c.clientName,
                            valor: p.value.toFixed(2),
                            vencimento: new Date(p.dueDate).toLocaleDateString('pt-BR'),
                            telefone: c.clientContact || 'Sem contato'
                        });
                    } else {
                        totalReceivable += p.value;
                    }
                }
            });
        });

        return JSON.stringify({
            total_contratos_ativos: activeContracts.length,
            total_a_receber: totalReceivable.toFixed(2),
            total_vencido: totalOverdue.toFixed(2),
            top_inadimplentes_detalhado: overdueClients.slice(0, 10),
            data_hoje: new Date().toLocaleDateString('pt-BR')
        });
    }

    async callGeminiAPI(prompt, context) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const fullPrompt = `${this.systemPrompt}\n\nCONTEXTO ATUAL DO SISTEMA:\n${context}\n\nPERGUNTA DO USUÁRIO: ${prompt}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Erro na API do Gemini');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }
}

// Global definition
window.aiAgent = new AIAgent();
