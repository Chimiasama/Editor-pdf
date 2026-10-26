import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Eraser,
  Wand2,
  MessageSquare,
  X,
  ArrowRight,
  RefreshCw,
  Copy,
  ExternalLink,
  ShieldAlert,
  Sliders,
  Type
} from 'lucide-react';
import { TocItem, AiTextCorrection, AiVisualRemoval } from '../types/pdf';

interface AiSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pdfTitle: string;
  currentPage: number;
  totalPages: number;
  tableOfContents: TocItem[];
  onSetTableOfContents: (items: TocItem[]) => void;
  onNavigateToPage: (page: number) => void;
  onApplyTextCorrection: (correction: AiTextCorrection) => void;
  onQuickRemoveSpider: () => void;
  onQuickReplaceWithWolfCrest: () => void;
  onInsertCustomText: (text: string) => void;
  extractedPagesText: { pageNumber: number; text: string }[];
}

export const AiSidebar: React.FC<AiSidebarProps> = ({
  isOpen,
  onClose,
  pdfTitle,
  currentPage,
  totalPages,
  tableOfContents,
  onSetTableOfContents,
  onNavigateToPage,
  onApplyTextCorrection,
  onQuickRemoveSpider,
  onQuickReplaceWithWolfCrest,
  onInsertCustomText,
  extractedPagesText,
}) => {
  const [activeTab, setActiveTab] = useState<'toc' | 'audit' | 'rewrite' | 'ask'>('toc');

  // Loading states
  const [isAnalyzingToc, setIsAnalyzingToc] = useState(false);
  const [isAuditingPage, setIsAuditingPage] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAsking, setIsAsking] = useState(false);

  // Audit results state
  const [auditResult, setAuditResult] = useState<{
    pageAnalysis?: string;
    textCorrections?: AiTextCorrection[];
    diagramSuggestions?: string[];
    visualRemovalsOrReplacements?: AiVisualRemoval[];
  } | null>(null);

  // Rewrite state
  const [rewriteInput, setRewriteInput] = useState('');
  const [rewriteMode, setRewriteMode] = useState('manter_mesmo_tamanho');
  const [rewriteOutput, setRewriteOutput] = useState<{
    text: string;
    explanation: string;
  } | null>(null);

  // Ask Q&A state
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);

  if (!isOpen) return null;

  // 1. Analyze TOC using Gemini
  const handleAnalyzeToc = async () => {
    setIsAnalyzingToc(true);
    try {
      const combinedText = extractedPagesText
        .map((p) => `--- PÁGINA ${p.pageNumber} ---\n${p.text}`)
        .join('\n\n');

      const res = await fetch('/api/ai/analyze-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfTitle,
          pagesText: combinedText,
          totalPages,
        }),
      });

      const json = await res.json();
      if (json.success && json.data?.chapters) {
        const items: TocItem[] = json.data.chapters.map((ch: any, idx: number) => ({
          id: `toc-${Date.now()}-${idx}`,
          title: ch.title,
          pageNumber: Math.min(Math.max(ch.pageNumber || 1, 1), totalPages),
          category: ch.category,
          description: ch.description,
          isGeneratedByAI: true,
        }));
        onSetTableOfContents(items);
      } else {
        alert(json.error || 'Não foi possível detectar o índice com a IA.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro ao conectar com a IA: ' + err.message);
    } finally {
      setIsAnalyzingToc(false);
    }
  };

  // 2. Audit Current Page using Gemini
  const handleAuditCurrentPage = async () => {
    setIsAuditingPage(true);
    try {
      const currentPageText =
        extractedPagesText.find((p) => p.pageNumber === currentPage)?.text || '';

      const res = await fetch('/api/ai/audit-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageNumber: currentPage,
          pageText: currentPageText,
          imageCount: currentPage === 5 ? 1 : 0, // Spider is on page 5
          bookContext: 'Livro de RPG e Regras',
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setAuditResult(json.data);
      } else {
        alert(json.error || 'Falha ao auditar página.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro na auditoria com a IA: ' + err.message);
    } finally {
      setIsAuditingPage(false);
    }
  };

  // 3. Rewrite Text with Layout Preservation
  const handleRewrite = async () => {
    if (!rewriteInput.trim()) return;
    setIsRewriting(true);
    try {
      const res = await fetch('/api/ai/polish-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: rewriteInput,
          instruction:
            rewriteMode === 'manter_mesmo_tamanho'
              ? 'Corrigir ortografia mantendo a mesma quantidade exata de caracteres para o layout não quebrar'
              : rewriteMode === 'narrativo'
              ? 'Tornar o texto mais imersivo e descritivo para RPG'
              : 'Simplificar e tornar direto',
          mode: rewriteMode,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setRewriteOutput({
          text: json.data.rewrittenText,
          explanation: json.data.explanation,
        });
      } else {
        alert(json.error || 'Falha ao reescrever texto.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Erro na reescrita com IA: ' + err.message);
    } finally {
      setIsRewriting(false);
    }
  };

  // 4. Ask Q&A
  const handleAskQuestion = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;

    const userQ = question;
    setQuestion('');
    setChatHistory((prev) => [...prev, { role: 'user', text: userQ }]);
    setIsAsking(true);

    try {
      const combinedText = extractedPagesText
        .map((p) => `PÁGINA ${p.pageNumber}: ${p.text}`)
        .join('\n\n');

      const res = await fetch('/api/ai/ask-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQ,
          currentContext: combinedText,
          currentPage,
        }),
      });

      const json = await res.json();
      if (json.success && json.answer) {
        setChatHistory((prev) => [...prev, { role: 'assistant', text: json.answer }]);
      } else {
        setChatHistory((prev) => [
          ...prev,
          { role: 'assistant', text: 'Não foi possível responder a pergunta no momento.' },
        ]);
      }
    } catch (err: any) {
      setChatHistory((prev) => [
        ...prev,
        { role: 'assistant', text: 'Erro ao conectar com a IA: ' + err.message },
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-30 shadow-2xl transition-all duration-200">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">IA Gemini Studio</h3>
            <p className="text-[11px] text-slate-400">Diagramação & Navegação Inteligente</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 p-1.5 bg-slate-950/60 border-b border-slate-800 text-[11px] font-semibold">
        <button
          onClick={() => setActiveTab('toc')}
          className={`py-1.5 rounded-lg transition ${
            activeTab === 'toc'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Índice
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-1.5 rounded-lg transition ${
            activeTab === 'audit'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Auditoria
        </button>
        <button
          onClick={() => setActiveTab('rewrite')}
          className={`py-1.5 rounded-lg transition ${
            activeTab === 'rewrite'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Reescrita
        </button>
        <button
          onClick={() => setActiveTab('ask')}
          className={`py-1.5 rounded-lg transition ${
            activeTab === 'ask'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Perguntar
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: SMART TOC & INTERACTIVE NAVIGATION */}
        {activeTab === 'toc' && (
          <div className="space-y-4">
            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3">
              <h4 className="font-semibold text-indigo-300 text-xs mb-1 flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Índice & Links de Conexão</span>
              </h4>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                A IA Gemini lê o sumário do livro e cria conexões interativas. Ao clicar em qualquer
                capítulo, você é levado instantaneamente até ele!
              </p>

              <button
                onClick={handleAnalyzeToc}
                disabled={isAnalyzingToc}
                className="mt-3 w-full inline-flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold shadow-md transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{isAnalyzingToc ? 'Analisando Páginas...' : 'Escanear Índice com IA'}</span>
              </button>
            </div>

            {/* List of Detected TOC items */}
            {tableOfContents.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum índice gerado ainda.</p>
                <p className="text-[10px] mt-1 text-slate-600">
                  Clique no botão acima para escanear os capítulos automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold px-1">
                  <span>Capítulos Conectados ({tableOfContents.length})</span>
                  <span className="text-indigo-400">Toque para Navegar</span>
                </div>

                {tableOfContents.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => onNavigateToPage(item.pageNumber)}
                    className="p-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/80 cursor-pointer transition group flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-[10px] border border-indigo-500/30">
                          {idx + 1}
                        </span>
                        <h5 className="font-semibold text-white group-hover:text-indigo-300 transition truncate">
                          {item.title}
                        </h5>
                      </div>
                      {item.description && (
                        <p className="text-slate-400 text-[10px] line-clamp-2">{item.description}</p>
                      )}
                    </div>

                    <span className="flex-shrink-0 inline-flex items-center space-x-1 px-2 py-1 rounded bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-bold text-[10px]">
                      <span>Pág {item.pageNumber}</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PAGE AUDIT, SPELLCHECK & REMOVAL SUGGESTIONS */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl border border-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 font-medium">Auditar Página Atual</span>
                <div className="font-bold text-white text-sm">Página {currentPage} de {totalPages}</div>
              </div>
              <button
                onClick={handleAuditCurrentPage}
                disabled={isAuditingPage}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAuditingPage ? 'animate-spin' : ''}`} />
                <span>{isAuditingPage ? 'Auditando...' : 'Auditar Página'}</span>
              </button>
            </div>

            {/* Special Quick-Action if on Page 5 with the Spider */}
            {currentPage === 5 && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 space-y-2.5">
                <div className="flex items-start space-x-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-rose-200">Elemento Detectado: Aranha</h5>
                    <p className="text-[11px] text-rose-300/90 leading-relaxed">
                      Conforme sua preferência, a imagem da aranha na página 5 pode ser ocultada ou
                      substituída sem alterar o fluxo do texto:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={onQuickRemoveSpider}
                    className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition shadow-sm"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>Remover Aranha</span>
                  </button>

                  <button
                    onClick={onQuickReplaceWithWolfCrest}
                    className="flex items-center justify-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Colocar Brasão</span>
                  </button>
                </div>
              </div>
            )}

            {/* Audit Results */}
            {auditResult && (
              <div className="space-y-3">
                {auditResult.pageAnalysis && (
                  <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                    <h5 className="font-semibold text-slate-200 mb-1">Diagnóstico da Página</h5>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {auditResult.pageAnalysis}
                    </p>
                  </div>
                )}

                {/* Text Corrections */}
                {auditResult.textCorrections && auditResult.textCorrections.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="font-semibold text-slate-300 flex items-center space-x-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Correções de Texto Encontradas ({auditResult.textCorrections.length})</span>
                    </h5>

                    {auditResult.textCorrections.map((corr, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="line-through text-rose-400 font-mono text-[11px]">
                            {corr.original}
                          </span>
                          <span className="text-slate-500 text-[10px]">→</span>
                          <span className="text-emerald-400 font-mono font-bold text-[11px]">
                            {corr.correction}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400">{corr.reason}</p>

                        <button
                          onClick={() => onApplyTextCorrection(corr)}
                          className="w-full inline-flex items-center justify-center space-x-1 px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-medium text-[10px] transition"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Aplicar Correção no PDF</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Diagram Suggestions */}
                {auditResult.diagramSuggestions && auditResult.diagramSuggestions.length > 0 && (
                  <div className="space-y-1.5">
                    <h5 className="font-semibold text-slate-300 flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Sugestões de Diagramação & Enquadramento</span>
                    </h5>
                    <ul className="space-y-1 text-slate-300 text-[11px]">
                      {auditResult.diagramSuggestions.map((sug, i) => (
                        <li key={i} className="flex items-start space-x-1.5">
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span>{sug}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REWRITE & FIT TO EXACT LAYOUT */}
        {activeTab === 'rewrite' && (
          <div className="space-y-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Texto para Ajustar / Reescrever:
              </label>
              <textarea
                rows={4}
                value={rewriteInput}
                onChange={(e) => setRewriteInput(e.target.value)}
                placeholder="Cole ou digite o parágrafo que você quer ajustar sem quebrar o espaço da página..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] mb-1">Objetivo de Diagramação:</label>
              <select
                value={rewriteMode}
                onChange={(e) => setRewriteMode(e.target.value)}
                className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs"
              >
                <option value="manter_mesmo_tamanho">Preservar exato tamanho de caracteres (Sem overflow)</option>
                <option value="narrativo">Tornar descrição mais imersiva / Estilo RPG</option>
                <option value="sintetizar">Encurtar para caber em espaço menor</option>
              </select>
            </div>

            <button
              onClick={handleRewrite}
              disabled={isRewriting || !rewriteInput.trim()}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-300" />
              <span>{isRewriting ? 'Processando...' : 'Reescrever com Enquadramento'}</span>
            </button>

            {rewriteOutput && (
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-slate-400 text-[10px]">
                  <span>Versão Otimizada</span>
                  <span className="text-emerald-400 font-medium">Layout Seguro</span>
                </div>
                <p className="text-slate-200 text-xs font-serif leading-relaxed whitespace-pre-wrap bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  {rewriteOutput.text}
                </p>
                <p className="text-[10px] text-slate-400">{rewriteOutput.explanation}</p>

                <button
                  onClick={() => onInsertCustomText(rewriteOutput.text)}
                  className="w-full inline-flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold transition"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>Inserir Bloco na Página Atual</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ASK AI / RULES & LORE QA */}
        {activeTab === 'ask' && (
          <div className="flex flex-col h-full space-y-3">
            <p className="text-[11px] text-slate-400">
              Faça perguntas sobre regras de RPG, atributos, equipamentos ou o conteúdo do documento:
            </p>

            <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-1">
              {chatHistory.length === 0 ? (
                <div className="text-center py-6 text-slate-600 text-[11px]">
                  Exemplos: "Qual a regra do d20?", "Quanto custa a espada?", "Quais os pontos de vida da aranha?"
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl leading-relaxed text-[11px] ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white ml-6 rounded-tr-none'
                        : 'bg-slate-800 text-slate-200 mr-6 rounded-tl-none border border-slate-700'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAskQuestion} className="flex items-center space-x-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                placeholder="Perguntar ao Gemini..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="flex-1 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isAsking || !question.trim()}
                className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
};
