import React, { useState } from 'react';
import {
  FileText,
  Star,
  Plus,
  Clock,
  Sparkles,
  Trash2,
  Download,
  Search,
  BookOpen,
  ArrowRight,
  Upload,
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { PdfDocumentRecord } from '../types/pdf';

interface DocumentLibraryProps {
  documents: PdfDocumentRecord[];
  onSelectDocument: (docId: string) => void;
  onToggleFavorite: (docId: string, e: React.MouseEvent) => void;
  onDeleteDocument: (docId: string, e: React.MouseEvent) => void;
  onCreateSampleRpg: () => void;
  onFileUpload: (file: File) => void;
  isLoadingSample: boolean;
}

export const DocumentLibrary: React.FC<DocumentLibraryProps> = ({
  documents,
  onSelectDocument,
  onToggleFavorite,
  onDeleteDocument,
  onCreateSampleRpg,
  onFileUpload,
  isLoadingSample,
}) => {
  const [filter, setFilter] = useState<'all' | 'favorites' | 'recent'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'favorites') return doc.isFavorite;
    if (filter === 'recent') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return doc.lastOpenedAt > oneWeekAgo;
    }
    return true;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        onFileUpload(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-bold text-lg text-white tracking-tight">PDF Studio Master</h1>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                  IA Gemini 3.8
                </span>
              </div>
              <p className="text-xs text-slate-400">Leitor & Editor Completo com Diagramação Preservada</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <label className="cursor-pointer inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition">
              <Upload className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Abrir PDF do Celular/PC</span>
              <span className="sm:hidden">Abrir</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileInputChange}
              />
            </label>

            <button
              onClick={onCreateSampleRpg}
              disabled={isLoadingSample}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
              <span>{isLoadingSample ? 'Gerando...' : 'Carregar Livro de RPG Exemplo'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner with Feature Highlights */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="relative rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-violet-950/60 border border-indigo-500/20 p-5 sm:p-7 overflow-hidden">
          <div className="relative z-10 max-w-3xl">
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Pronto para Livros de RPG, Manuais & Apostilas</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Edição sem quebrar texto nem perder diagramação
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              Remova imagens indesejadas (como aranhas ou marcas d'água), substitua por novas ilustrações,
              reescreva textos preservando o enquadramento, e use a <strong>IA Gemini</strong> para ler o índice e
              gerar links diretos de navegação entre capítulos!
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center space-x-2 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Remoção Limpa de Imagens</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <span>Índice Inteligente por IA</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
                <span>Zoom Pinça & Mobile</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Exportação Vetorial Real</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full">
        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos os PDFs ({documents.length})
            </button>
            <button
              onClick={() => setFilter('favorites')}
              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'favorites'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Favoritos ({documents.filter((d) => d.isFavorite).length})</span>
            </button>
            <button
              onClick={() => setFilter('recent')}
              className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === 'recent'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Recentes</span>
            </button>
          </div>

          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar documento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Drag and Drop Zone if empty or hovered */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mb-6 border-2 border-dashed rounded-2xl p-6 text-center transition ${
            isDragging
              ? 'border-indigo-400 bg-indigo-950/30'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
              <Upload className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Arraste um PDF aqui ou selecione do seu aparelho
              </p>
              <p className="text-xs text-slate-400">
                Suporta livros de RPG, apostilas, manuais com qualquer número de páginas
              </p>
            </div>
          </div>
        </div>

        {/* Document Grid */}
        {filteredDocs.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-2xl bg-slate-900/40 border border-slate-800">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-300">Nenhum documento encontrado</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Clique em "Carregar Livro de RPG Exemplo" para testar a remoção de imagem (aranha) e o índice por IA
              ou faça o upload de um PDF do seu dispositivo.
            </p>
            <button
              onClick={onCreateSampleRpg}
              disabled={isLoadingSample}
              className="mt-4 inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Gerar Livro de RPG Exemplo</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => {
              const editsCount = Object.values(doc.pageMetadata || {}).reduce(
                (sum, meta) => sum + (meta.annotations?.length || 0),
                0
              );

              return (
                <div
                  key={doc.id}
                  onClick={() => onSelectDocument(doc.id)}
                  className="group relative rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 p-4 transition duration-200 hover:shadow-xl hover:shadow-indigo-500/10 cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Top row: badge & favorite */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-semibold flex items-center space-x-1 border border-slate-700">
                          <FileText className="w-3 h-3 text-indigo-400" />
                          <span>{doc.pageCount} páginas</span>
                        </span>
                        {editsCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-medium">
                            {editsCount} edições
                          </span>
                        )}
                        {doc.tableOfContents && doc.tableOfContents.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[11px] font-medium">
                            Índice IA
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => onToggleFavorite(doc.id, e)}
                        className={`p-1.5 rounded-lg transition ${
                          doc.isFavorite
                            ? 'text-amber-400 bg-amber-400/10 hover:bg-amber-400/20'
                            : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                        }`}
                        title={doc.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      >
                        <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="font-semibold text-white group-hover:text-indigo-300 transition text-base line-clamp-2 mb-2">
                      {doc.title}
                    </h3>

                    {/* Metadata tags */}
                    <div className="flex items-center space-x-3 text-xs text-slate-400 mb-4">
                      <span>{doc.fileSizeFormatted}</span>
                      <span>•</span>
                      <span>
                        {new Date(doc.lastOpenedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs font-medium text-indigo-400 group-hover:underline flex items-center space-x-1">
                      <span>Abrir no Editor</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                    </span>

                    <button
                      onClick={(e) => onDeleteDocument(doc.id, e)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Excluir documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
