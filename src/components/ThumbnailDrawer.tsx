import React from 'react';
import { X, RotateCw, Trash2, Copy, FileText, Check } from 'lucide-react';

interface ThumbnailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  totalPages: number;
  currentPage: number;
  onSelectPage: (page: number) => void;
  onRotatePage: (page: number) => void;
  pageRotations: Record<number, number>;
  annotationsCount: Record<number, number>;
}

export const ThumbnailDrawer: React.FC<ThumbnailDrawerProps> = ({
  isOpen,
  onClose,
  totalPages,
  currentPage,
  onSelectPage,
  onRotatePage,
  pageRotations,
  annotationsCount,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="w-56 sm:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-30 shadow-2xl select-none">
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <h3 className="text-xs font-bold text-white">Miniaturas ({totalPages})</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
          const isCurrent = page === currentPage;
          const rotation = pageRotations[page] || 0;
          const editCount = annotationsCount[page] || 0;

          return (
            <div
              key={page}
              onClick={() => onSelectPage(page)}
              className={`p-2 rounded-xl border transition cursor-pointer group flex flex-col items-center ${
                isCurrent
                  ? 'border-indigo-500 bg-indigo-950/40 shadow-md shadow-indigo-500/10'
                  : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
              }`}
            >
              {/* Thumbnail Representation */}
              <div
                className="w-32 h-44 bg-white rounded shadow-sm border border-slate-300 flex flex-col justify-between p-2 relative overflow-hidden transition-transform duration-200"
                style={{ transform: `rotate(${rotation}deg)` }}
              >
                {/* Header mock lines */}
                <div className="space-y-1">
                  <div className="h-1.5 w-16 bg-slate-800 rounded-sm" />
                  <div className="h-1 w-24 bg-slate-400 rounded-sm" />
                </div>

                {/* Body mock */}
                <div className="space-y-1 my-auto">
                  <div className="h-1 w-full bg-slate-300 rounded-sm" />
                  <div className="h-1 w-full bg-slate-300 rounded-sm" />
                  <div className="h-1 w-20 bg-slate-300 rounded-sm" />
                  {page === 5 && (
                    <div className="h-8 w-20 mx-auto bg-slate-800/20 border border-dashed border-slate-400 rounded flex items-center justify-center text-[7px] text-slate-600 font-mono">
                      [Arte]
                    </div>
                  )}
                </div>

                {/* Footer mock */}
                <div className="text-[8px] text-slate-400 text-center font-mono">
                  pág {page}
                </div>

                {/* Edit badge on thumb */}
                {editCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                )}
              </div>

              {/* Label & Quick Actions */}
              <div className="w-full mt-2 flex items-center justify-between text-xs px-1">
                <span
                  className={`font-semibold ${
                    isCurrent ? 'text-indigo-400' : 'text-slate-400'
                  }`}
                >
                  Pág {page}
                </span>

                <div className="flex items-center space-x-1">
                  {editCount > 0 && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      {editCount} {editCount === 1 ? 'edição' : 'edições'}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotatePage(page);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                    title="Girar esta página"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
