import React, { useState } from 'react';
import { X, Crop, Check, RotateCcw } from 'lucide-react';

interface CropModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: number;
  initialCrop?: { top: number; bottom: number; left: number; right: number };
  onApplyCrop: (crop: { top: number; bottom: number; left: number; right: number }) => void;
}

export const CropModal: React.FC<CropModalProps> = ({
  isOpen,
  onClose,
  currentPage,
  initialCrop = { top: 0, bottom: 0, left: 0, right: 0 },
  onApplyCrop,
}) => {
  const [top, setTop] = useState(initialCrop.top);
  const [bottom, setBottom] = useState(initialCrop.bottom);
  const [left, setLeft] = useState(initialCrop.left);
  const [right, setRight] = useState(initialCrop.right);

  if (!isOpen) return null;

  const handleReset = () => {
    setTop(0);
    setBottom(0);
    setLeft(0);
    setRight(0);
  };

  const handleApply = () => {
    onApplyCrop({ top, bottom, left, right });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Crop className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">
              Enquadramento & Margens (Página {currentPage})
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 mb-6">
          Ajuste as margens de enquadramento da página para eliminar bordas indesejadas, cabeçalhos
          ou rodapés sem perder o alinhamento do conteúdo principal.
        </p>

        {/* Visual Preview Box */}
        <div className="relative w-48 h-64 mx-auto bg-white rounded-lg shadow-inner border border-slate-300 flex items-center justify-center mb-6 overflow-hidden">
          {/* Active cropped area */}
          <div
            className="absolute border-2 border-dashed border-indigo-600 bg-indigo-500/10 flex items-center justify-center text-[10px] text-indigo-700 font-semibold"
            style={{
              top: `${top}%`,
              bottom: `${bottom}%`,
              left: `${left}%`,
              right: `${right}%`,
            }}
          >
            Área Útil do PDF
          </div>

          {/* Masked margins */}
          <div className="absolute top-0 inset-x-0 bg-slate-900/30" style={{ height: `${top}%` }} />
          <div className="absolute bottom-0 inset-x-0 bg-slate-900/30" style={{ height: `${bottom}%` }} />
          <div className="absolute inset-y-0 left-0 bg-slate-900/30" style={{ width: `${left}%` }} />
          <div className="absolute inset-y-0 right-0 bg-slate-900/30" style={{ width: `${right}%` }} />
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-2 gap-4 text-xs mb-6">
          <div>
            <label className="text-slate-300 font-medium flex justify-between mb-1">
              <span>Margem Superior (Topo)</span>
              <span className="text-indigo-400 font-bold">{top}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={top}
              onChange={(e) => setTop(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium flex justify-between mb-1">
              <span>Margem Inferior (Rodapé)</span>
              <span className="text-indigo-400 font-bold">{bottom}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={bottom}
              onChange={(e) => setBottom(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium flex justify-between mb-1">
              <span>Margem Esquerda</span>
              <span className="text-indigo-400 font-bold">{left}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={left}
              onChange={(e) => setLeft(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div>
            <label className="text-slate-300 font-medium flex justify-between mb-1">
              <span>Margem Direita</span>
              <span className="text-indigo-400 font-bold">{right}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={right}
              onChange={(e) => setRight(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Resetar Margens</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              onClick={handleApply}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition text-xs font-semibold shadow-md shadow-indigo-600/25"
            >
              <Check className="w-4 h-4" />
              <span>Aplicar Enquadramento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
