import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { PcbAnalysis, BoundingBox, Presence, Condition, DefectType, JumperSuggestion } from '../types';
import InfoPopover from './InfoPopover';
import { ExclamationTriangleIcon, BoltIcon, FireIcon, CheckCircleIcon, WrenchIcon } from './icons';

interface AnalysisViewerProps {
  imageUrl: string;
  analysis: PcbAnalysis;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  boardVoltage: number | null;
  jumperSuggestion: JumperSuggestion | null;
}

const getBoxStyle = (presence: Presence, condition: Condition) => {
  if (condition === 'burnt') return 'border-status-error';
  if (presence === 'missing') return 'border-status-warn';
  return 'border-status-ok';
};

const getDefectBoxStyle = (type: DefectType) => {
  switch(type){
    case 'solder_bridge':
    case 'misalignment':
        return 'border-status-defect';
    case 'overheating':
        return 'border-transparent'; // Handled by thermal layer
    default:
        return 'border-status-defect';
  }
};

const BoundingBoxOverlay: React.FC<{
  id: string;
  bbox: BoundingBox;
  borderColor: string;
  isHovered: boolean;
  isSelected: boolean;
  showVoltageWarning: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}> = ({ id, bbox, borderColor, isHovered, isSelected, showVoltageWarning, onMouseEnter, onMouseLeave, onClick }) => {

  const isActive = isHovered || isSelected;

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${bbox.x * 100}%`,
    top: `${bbox.y * 100}%`,
    width: `${bbox.w * 100}%`,
    height: `${bbox.h * 100}%`,
    borderWidth: isSelected ? '3px' : '2px',
    boxShadow: isActive ? `0 0 12px ${borderColor.replace('border-','')}`: '0 1px 3px rgba(0,0,0,0.5)',
    transition: 'all 150ms ease-in-out',
    transform: isSelected ? 'scale(1.05)' : isHovered ? 'scale(1.02)' : 'scale(1)',
    zIndex: isSelected ? 10 : isHovered ? 5 : 1,
  };

  return (
    <div
      key={id}
      style={style}
      className={`border-solid ${borderColor} rounded-sm cursor-pointer`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {showVoltageWarning && (
        <div className="absolute -top-2 -right-2 bg-yellow-400 p-0.5 rounded-full shadow-lg z-10">
          <BoltIcon className="h-4 w-4 text-gray-900" />
        </div>
      )}
    </div>
  );
};


const Legend: React.FC = () => (
  <div className="absolute bottom-4 left-4 bg-gray-900/70 backdrop-blur-md p-3 rounded-lg text-xs text-gray-300 shadow-xl ring-1 ring-white/10 z-10">
    <h4 className="font-bold text-white mb-2">Legend</h4>
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div className="flex items-center space-x-2"><CheckCircleIcon className="h-4 w-4 text-status-ok" /><span>Component OK</span></div>
      <div className="flex items-center space-x-2"><WrenchIcon className="h-4 w-4 text-status-defect" /><span>Defect</span></div>
      <div className="flex items-center space-x-2"><ExclamationTriangleIcon className="h-4 w-4 text-status-warn" /><span>Component Issue</span></div>
      <div className="flex items-center space-x-2"><BoltIcon className="h-4 w-4 text-yellow-400" /><span>Voltage Mismatch</span></div>
      <div className="flex items-center space-x-2"><FireIcon className="h-4 w-4 text-red-500" /><span>Thermal Hotspot</span></div>
      <div className="flex items-center space-x-2"><div className="w-4 h-0.5 bg-blue-400"/><span>Jumper Suggestion</span></div>
    </div>
  </div>
);


const AnalysisViewer: React.FC<AnalysisViewerProps> = ({ imageUrl, analysis, hoveredId, setHoveredId, selectedId, setSelectedId, boardVoltage, jumperSuggestion }) => {

  const hasVoltageMismatch = (component: any) => 
    boardVoltage && component.maxVoltage && boardVoltage > component.maxVoltage;

  return (
    <div className="w-full h-full bg-gray-800 rounded-lg shadow-xl flex items-center justify-center p-4 relative overflow-hidden">
      <div className="relative" id="analysis-image-container">
        <img
          src={imageUrl}
          alt="PCB for Analysis"
          className="max-w-full max-h-[80vh] object-contain rounded-md"
        />
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {/* Thermal Layer */}
          {analysis.defects.filter(d => d.type === 'overheating').map((defect) => (
             <div
              key={`thermal-${defect.id}`}
              className="absolute bg-red-500/30 rounded-full blur-xl"
              style={{
                left: `${defect.bbox.x * 100}%`,
                top: `${defect.bbox.y * 100}%`,
                width: `${defect.bbox.w * 100}%`,
                height: `${defect.bbox.h * 100}%`,
              }}
            />
          ))}

          {/* Jumper Suggestion Layer */}
          {jumperSuggestion && (
              <svg className="absolute top-0 left-0 w-full h-full overflow-visible z-20">
                  <line 
                    x1={`${jumperSuggestion.from.x * 100}%`}
                    y1={`${jumperSuggestion.from.y * 100}%`}
                    x2={`${jumperSuggestion.to.x * 100}%`}
                    y2={`${jumperSuggestion.to.y * 100}%`}
                    stroke="#38bdf8"
                    strokeWidth="3"
                    strokeDasharray="4"
                  />
                  <circle cx={`${jumperSuggestion.from.x * 100}%`} cy={`${jumperSuggestion.from.y * 100}%`} r="5" fill="#38bdf8" />
                  <circle cx={`${jumperSuggestion.to.x * 100}%`} cy={`${jumperSuggestion.to.y * 100}%`} r="5" fill="#38bdf8" />
              </svg>
          )}

          {/* Bounding Box Layer */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-auto">
            {analysis.components.map((component) => (
              <BoundingBoxOverlay
                key={component.designator}
                id={component.designator}
                bbox={component.bbox}
                borderColor={getBoxStyle(component.presence, component.condition)}
                isHovered={hoveredId === component.designator}
                isSelected={selectedId === component.designator}
                showVoltageWarning={hasVoltageMismatch(component)}
                onMouseEnter={() => setHoveredId(component.designator)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => setSelectedId(selectedId === component.designator ? null : component.designator)}
              />
            ))}
            {analysis.defects.map((defect) => (
              <BoundingBoxOverlay
                  key={defect.id}
                  id={defect.id}
                  bbox={defect.bbox}
                  borderColor={getDefectBoxStyle(defect.type)}
                  isHovered={hoveredId === defect.id}
                  isSelected={selectedId === defect.id}
                  showVoltageWarning={false}
                  onMouseEnter={() => setHoveredId(defect.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => setSelectedId(selectedId === defect.id ? null : defect.id)}
              />
            ))}
            {selectedId && (
              <InfoPopover 
                  analysis={analysis} 
                  selectedId={selectedId}
                  boardVoltage={boardVoltage}
                  onClose={() => setSelectedId(null)} 
              />
            )}
          </div>
        </div>
      </div>
      <Legend />
    </div>
  );
};

export default AnalysisViewer;