import React from 'react';
import { PcbAnalysis, Component, Defect, DefectType } from '../types';
import { openDatasheet } from '../services/datasheetService';
import { 
    XMarkIcon, 
    CheckCircleIcon, 
    ExclamationTriangleIcon, 
    FireIcon, 
    QuestionMarkCircleIcon, 
    WrenchIcon, 
    LinkIcon,
    BoltIcon,
    ThermometerIcon,
    DocumentTextIcon,
    SpinnerIcon
} from './icons';


interface InfoPopoverProps {
    analysis: PcbAnalysis;
    selectedId: string;
    boardVoltage: number | null;
    onClose: () => void;
}

const statusIcons = {
    ok: <CheckCircleIcon className="h-5 w-5 text-status-ok" />,
    missing: <QuestionMarkCircleIcon className="h-5 w-5 text-status-warn" />,
    burnt: <FireIcon className="h-5 w-5 text-status-error" />,
    corroded: <ExclamationTriangleIcon className="h-5 w-5 text-status-error" />
};

const getStatusText = (component: Component): string => {
    if (component.condition === 'burnt') return 'Burnt';
    if (component.condition === 'corroded') return 'Corroded';
    if (component.presence === 'missing') return 'Missing';
    return 'OK';
}

const translateDefectType = (type: DefectType): string => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const ComponentInfo: React.FC<{component: Component; boardVoltage: number | null}> = ({ component, boardVoltage }) => {
    const [isFetchingSheet, setIsFetchingSheet] = React.useState(false);
    const status = getStatusText(component);
    const hasIssue = status !== 'OK';
    const hasVoltageMismatch = boardVoltage && component.maxVoltage && boardVoltage > component.maxVoltage;

    const handleDatasheetClick = async () => {
        if (!component.mpn) return;
        setIsFetchingSheet(true);
        await openDatasheet(component.mpn);
        setIsFetchingSheet(false);
    };

    return (
        <div>
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                    {statusIcons[component.presence === 'missing' ? 'missing' : component.condition]}
                    <div>
                        <h4 className="font-bold text-white">{component.designator}</h4>
                        <p className="text-xs text-gray-400">{component.mpn}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className={`font-medium text-sm ${hasIssue ? 'text-orange-300' : 'text-green-300'}`}>{status}</p>
                    <p className="text-xs text-gray-500">{(component.confidence * 100).toFixed(0)}% Conf.</p>
                </div>
            </div>
            
            <div className="mt-3 space-y-2 text-xs">
                {component.temperature && (
                    <div className="flex items-center space-x-2 text-gray-300">
                        <ThermometerIcon className="h-4 w-4 text-red-400" />
                        <span>Temperature: {component.temperature.toFixed(1)}°C</span>
                    </div>
                )}
                {component.maxVoltage && (
                     <div className="flex items-center space-x-2 text-gray-300">
                        <BoltIcon className={`h-4 w-4 ${hasVoltageMismatch ? 'text-yellow-400' : 'text-gray-500'}`} />
                        <span>Max Voltage: {component.maxVoltage}V</span>
                    </div>
                )}
                 {hasVoltageMismatch && (
                    <p className="pl-6 text-yellow-400 font-semibold">Board voltage ({boardVoltage}V) exceeds max!</p>
                )}
            </div>

            {component.mpn && (
                 <button 
                    onClick={handleDatasheetClick}
                    disabled={isFetchingSheet}
                    className="mt-3 flex items-center justify-center space-x-2 w-full bg-gray-700/50 hover:bg-gray-700 p-2 rounded-md text-sm text-gray-200 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                    {isFetchingSheet ? <SpinnerIcon className="h-4 w-4" /> : <DocumentTextIcon className="h-4 w-4" />}
                    <span>{isFetchingSheet ? 'Fetching...' : 'View Datasheet'}</span>
                </button>
            )}
        </div>
    );
};

const DefectInfo: React.FC<{defect: Defect}> = ({ defect }) => (
    <div>
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <WrenchIcon className="h-5 w-5 text-status-defect" />
                <div>
                    <h4 className="font-bold text-white capitalize">{translateDefectType(defect.type)}</h4>
                    <p className="text-xs text-gray-400">ID: {defect.id}</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-xs text-gray-500">{(defect.confidence * 100).toFixed(0)}% Conf.</p>
            </div>
        </div>
        {defect.description && <p className="mt-2 text-sm text-gray-300">{defect.description}</p>}
    </div>
);


const InfoPopover: React.FC<InfoPopoverProps> = ({ analysis, selectedId, boardVoltage, onClose }) => {
    const component = analysis.components.find(c => c.designator === selectedId);
    const defect = analysis.defects.find(d => d.id === selectedId);
    const item = component || defect;

    if (!item) return null;

    const bbox = item.bbox;
    let isFlipped = false;
    
    const style: React.CSSProperties = {
        position: 'absolute',
        left: `${(bbox.x + bbox.w / 2) * 100}%`,
        top: `${bbox.y * 100}%`,
        transform: 'translate(-50%, calc(-100% - 10px))',
        pointerEvents: 'auto',
    };
    
    // This is a simplified clamping and would be more robust with the popover's actual width/height
    if (typeof window !== 'undefined' && typeof style.left === 'string' && typeof style.top === 'string') {
        const leftPercent = parseFloat(style.left);
        const topPercent = parseFloat(style.top);
        
        // A rough estimation of popover width relative to viewport
        const popoverWidthVW = 30; 
        const leftVW = (leftPercent / 100) * (item.bbox.w * 100); 

        if (leftVW < popoverWidthVW / 2) {
             style.left = `${(popoverWidthVW / 2)}%`;
        }
        if (leftVW > (100 - popoverWidthVW / 2)) {
             style.left = `${100 - (popoverWidthVW / 2)}%`;
        }

        if (topPercent < 25) { // If near top, flip below
             style.top = `${(bbox.y + bbox.h) * 100}%`;
             style.transform = `translate(-50%, 10px)`;
             isFlipped = true;
        }
    }


    return (
        <>
            {/* Backdrop to close on outside click */}
            <div className="fixed inset-0 z-20" style={{pointerEvents: 'auto'}} onClick={onClose} />
            <div 
                style={style} 
                className="relative z-30 w-72 min-h-[60px] bg-gray-900/70 backdrop-blur-md rounded-lg shadow-2xl ring-1 ring-white/10 p-3 animate-fade-in-up"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside popover
            >
                <button onClick={onClose} className="absolute top-1 right-1 p-1 text-gray-500 hover:text-white transition-colors rounded-full z-10">
                    <XMarkIcon className="h-5 w-5" />
                </button>
                
                {component && <ComponentInfo component={component} boardVoltage={boardVoltage} />}
                {defect && <DefectInfo defect={defect} />}
                
                <div 
                    className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900/70 ring-1 ring-white/10"
                    style={isFlipped ? { top: '-6px', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' } : { bottom: '-6px', clipPath: 'polygon(50% 100%, 0 0, 100% 0)' }}
                />
            </div>
        </>
    );
};

export default InfoPopover;