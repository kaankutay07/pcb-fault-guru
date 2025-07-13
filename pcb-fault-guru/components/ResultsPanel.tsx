import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PcbAnalysis, Component, Defect, Alternative, DefectType, ChatMessage } from '../types';
import { openDatasheet } from '../services/datasheetService';
import { CheckCircleIcon, ExclamationTriangleIcon, FireIcon, QuestionMarkCircleIcon, WrenchIcon, LinkIcon, ChevronDownIcon, ClipboardDocumentCheckIcon, ArrowRightIcon, MagnifyingGlassIcon, BoltIcon, DocumentTextIcon, ChatBubbleLeftRightIcon, PaperAirplaneIcon, SparklesIcon, SpinnerIcon } from './icons';

interface ResultsPanelProps {
  analysis: PcbAnalysis;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  boardVoltage: number | null;
  chatHistory: ChatMessage[];
  isChatLoading: boolean;
  onSendMessage: (message: string) => void;
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

const CollapsibleSection: React.FC<{ title: string; count: number; badgeColor: string; children: React.ReactNode; icon: React.ReactNode; defaultOpen?: boolean }> = ({ title, count, badgeColor, icon, children, defaultOpen = true }) => (
    <details className="group" open={defaultOpen}>
        <summary className="flex items-center justify-between p-2 list-none cursor-pointer hover:bg-gray-700/50 rounded-md">
            <div className="flex items-center space-x-2">
                {icon}
                <h3 className="text-md font-semibold">{title}</h3>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badgeColor}`}>{count}</span>
            </div>
            <ChevronDownIcon className="h-5 w-5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="pt-2 pl-2 space-y-2">
            {children}
        </div>
    </details>
);

const ComponentItem: React.FC<{
    component: Component;
    alternatives?: Alternative;
    boardVoltage: number | null;
    isHovered: boolean;
    isSelected: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
}> = ({ component, alternatives, boardVoltage, isHovered, isSelected, onMouseEnter, onMouseLeave, onClick }) => {
    
    const [isFetchingSheet, setIsFetchingSheet] = useState(false);
    const status = getStatusText(component);
    const hasIssue = status !== 'OK';
    const hasVoltageMismatch = boardVoltage && component.maxVoltage && boardVoltage > component.maxVoltage;

    const baseClasses = "rounded-md transition-all duration-150 ease-in-out cursor-pointer";
    const selectedClasses = isSelected ? 'bg-brand-primary/30 ring-2 ring-brand-primary' : '';
    const hoveredClasses = isHovered ? 'bg-brand-primary/20 ring-1 ring-brand-primary' : 'bg-gray-800/50';

    const handleDatasheetClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!component.mpn) return;
        setIsFetchingSheet(true);
        try {
            await openDatasheet(component.mpn);
        } catch (error) {
            console.error("Failed to open datasheet:", error);
        } finally {
            setIsFetchingSheet(false);
        }
    };

    return (
        <li 
            className={`${baseClasses} ${isSelected ? selectedClasses : hoveredClasses}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onClick={onClick}
        >
            <div className="p-3">
              <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                      {statusIcons[component.presence === 'missing' ? 'missing' : component.condition]}
                      <div>
                          <p className="font-bold text-white">{component.designator}</p>
                          <p className="text-xs text-gray-400">{component.mpn}</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className={`font-medium text-sm ${hasIssue || hasVoltageMismatch ? 'text-orange-300' : 'text-green-300'}`}>{status}</p>
                      <p className="text-xs text-gray-500">Conf: {(component.confidence * 100).toFixed(0)}%</p>
                  </div>
              </div>
              {(hasVoltageMismatch || component.mpn) && (
                <div className="mt-2 pl-8 space-y-1">
                  {hasVoltageMismatch && (
                    <div className="flex items-center space-x-1 text-xs text-yellow-300">
                      <BoltIcon className="h-3 w-3"/>
                      <span>Voltage Mismatch ({boardVoltage}V &gt; {component.maxVoltage}V)</span>
                    </div>
                  )}
                  {component.mpn && (
                     <button onClick={handleDatasheetClick} disabled={isFetchingSheet} className="flex items-center space-x-1 text-xs text-gray-400 hover:text-brand-primary transition-colors disabled:opacity-50 disabled:cursor-wait">
                        {isFetchingSheet ? <SpinnerIcon className="h-3 w-3" /> : <DocumentTextIcon className="h-3 w-3" />}
                        <span>{isFetchingSheet ? 'Fetching...' : 'View Datasheet'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
        </li>
    );
};

const DefectItem: React.FC<{
    defect: Defect;
    isHovered: boolean;
    isSelected: boolean;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onClick: () => void;
}> = ({ defect, isHovered, isSelected, onMouseEnter, onMouseLeave, onClick }) => {
    const baseClasses = "p-3 rounded-md transition-all duration-150 ease-in-out cursor-pointer";
    const selectedClasses = isSelected ? 'bg-purple-500/30 ring-2 ring-purple-500' : '';
    const hoveredClasses = isHovered ? 'bg-purple-500/20 ring-1 ring-purple-500' : 'bg-gray-800/50';

    return (
        <li className={`${baseClasses} ${isSelected ? selectedClasses : hoveredClasses}`} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onClick={onClick}>
            <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <WrenchIcon className="h-5 w-5 text-status-defect" />
                  <div>
                    <p className="font-bold text-white capitalize">{translateDefectType(defect.type)}</p>
                    {defect.description && <p className="text-xs text-gray-400">{defect.description}</p>}
                  </div>
                </div>
                <div className="text-right"><p className="text-xs text-gray-500">Conf: {(defect.confidence * 100).toFixed(0)}%</p></div>
            </div>
        </li>
    );
};

const StatCard: React.FC<{label: string; value: number | string; colorClass: string}> = ({ label, value, colorClass }) => (
    <div className="bg-gray-800/60 p-3 rounded-lg text-center">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
);

const ExplorerView: React.FC<Omit<ResultsPanelProps, 'chatHistory' | 'isChatLoading' | 'onSendMessage'>> = ({ analysis, hoveredId, setHoveredId, selectedId, setSelectedId, boardVoltage }) => {
    const { advice, defects, components } = analysis;
    const [searchTerm, setSearchTerm] = useState('');
    const [componentFilter, setComponentFilter] = useState<'all' | 'issues' | 'ok'>('all');
    
    const { componentsWithIssues, okComponents } = useMemo(() => {
      const lowercasedSearch = searchTerm.toLowerCase();
      const filtered = searchTerm ? components.filter(c => 
          c.designator.toLowerCase().includes(lowercasedSearch) || 
          c.mpn.toLowerCase().includes(lowercasedSearch)
      ) : components;
      
      return {
          componentsWithIssues: filtered.filter(c => c.presence !== 'ok' || c.condition !== 'ok' || (boardVoltage && c.maxVoltage && boardVoltage > c.maxVoltage)),
          okComponents: filtered.filter(c => c.presence === 'ok' && c.condition === 'ok' && !(boardVoltage && c.maxVoltage && boardVoltage > c.maxVoltage)),
      };
    }, [components, searchTerm, boardVoltage]);

    const displayedComponentsWithIssues = componentFilter === 'all' || componentFilter === 'issues' ? componentsWithIssues : [];
    const displayedOkComponents = componentFilter === 'all' || componentFilter === 'ok' ? okComponents : [];
  
    const handleItemClick = (id: string) => {
      setSelectedId(selectedId === id ? null : id);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-700/50 space-y-3">
              <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 pointer-events-none" />
                  <input type="text" placeholder="Search components..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-900/50 border border-gray-700 rounded-md py-2 pl-10 pr-4 focus:ring-brand-primary focus:border-brand-primary transition" />
              </div>
              <div className="flex items-center justify-center space-x-2">
                  { (['all', 'issues', 'ok'] as const).map(filter => (
                      <button key={filter} onClick={() => setComponentFilter(filter)} className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${componentFilter === filter ? 'bg-brand-primary text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                          {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                  )) }
              </div>
            </div>
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {defects.length > 0 && (
                  <CollapsibleSection title="Detected Defects" count={defects.length} badgeColor="bg-purple-500/50 text-purple-200" icon={<WrenchIcon className="h-5 w-5 text-purple-300"/>} defaultOpen={true}>
                    <ul className="space-y-2">{defects.map((defect) => (<DefectItem key={defect.id} defect={defect} isHovered={hoveredId === defect.id} isSelected={selectedId === defect.id} onMouseEnter={() => setHoveredId(defect.id)} onMouseLeave={() => setHoveredId(null)} onClick={() => handleItemClick(defect.id)} />))}</ul>
                  </CollapsibleSection>
                )}
                {displayedComponentsWithIssues.length > 0 && (
                  <CollapsibleSection title="Component Issues" count={displayedComponentsWithIssues.length} badgeColor="bg-orange-500/50 text-orange-200" icon={<ExclamationTriangleIcon className="h-5 w-5 text-orange-300"/>} defaultOpen={true}>
                    <ul className="space-y-2">{displayedComponentsWithIssues.map((component) => (<ComponentItem key={component.designator} component={component} alternatives={advice?.alternatives?.find(alt => alt.original_mpn === component.mpn)} boardVoltage={boardVoltage} isHovered={hoveredId === component.designator} isSelected={selectedId === component.designator} onMouseEnter={() => setHoveredId(component.designator)} onMouseLeave={() => setHoveredId(null)} onClick={() => handleItemClick(component.designator)}/>))}</ul>
                  </CollapsibleSection>
                )}
                {displayedOkComponents.length > 0 && (
                    <CollapsibleSection title="OK Components" count={displayedOkComponents.length} badgeColor="bg-green-500/50 text-green-200" icon={<CheckCircleIcon className="h-5 w-5 text-green-300"/>} defaultOpen={false}>
                        <ul className="space-y-2">{displayedOkComponents.map((component) => (<ComponentItem key={component.designator} component={component} boardVoltage={boardVoltage} isHovered={hoveredId === component.designator} isSelected={selectedId === component.designator} onMouseEnter={() => setHoveredId(component.designator)} onMouseLeave={() => setHoveredId(null)} onClick={() => handleItemClick(component.designator)}/>))}</ul>
                    </CollapsibleSection>
                )}
            </div>
        </div>
    );
}

const SummaryView: React.FC<{ analysis: PcbAnalysis; setSelectedId: (id: string) => void }> = ({ analysis, setSelectedId }) => {
    const { advice, components } = analysis;

    const findComponentByMpn = (mpn: string) => components.find(c => c.mpn === mpn);

    return (
        <div className="flex-grow overflow-y-auto p-4 space-y-6">
            {advice.repair_cost && (
                <div className="bg-gray-700/50 p-4 rounded-lg text-center">
                    <p className="text-sm font-medium text-gray-400">Estimated Repair Cost</p>
                    <p className="text-3xl font-bold text-brand-accent">${advice.repair_cost.toFixed(2)}</p>
                </div>
            )}

            {advice.quick_actions && advice.quick_actions.length > 0 && (
                <div>
                    <h3 className="flex items-center space-x-2 text-md font-semibold text-white mb-2">
                        <ClipboardDocumentCheckIcon className="h-5 w-5 text-teal-400" />
                        <span>Quick Actions</span>
                    </h3>
                    <ul className="space-y-2">
                        {advice.quick_actions.map((action, index) => (
                            <li key={index} className="flex items-start space-x-3 bg-gray-800/60 p-3 rounded-md">
                                <CheckCircleIcon className="h-5 w-5 text-status-ok mt-0.5 flex-shrink-0" />
                                <span className="text-sm text-gray-300">{action}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {advice.alternatives && advice.alternatives.length > 0 && (
                <div>
                    <h3 className="flex items-center space-x-2 text-md font-semibold text-white mb-2">
                        <WrenchIcon className="h-5 w-5 text-orange-400" />
                        <span>Replacement Suggestions</span>
                    </h3>
                    <div className="space-y-3">
                        {advice.alternatives.map((alt, index) => {
                            const originalComponent = findComponentByMpn(alt.original_mpn);
                            return (
                                <div key={index} className="bg-gray-800/60 p-3 rounded-md">
                                    <p className="text-sm font-medium text-gray-300">
                                        For: <span 
                                            className={`font-bold text-white ${originalComponent ? 'cursor-pointer hover:underline' : ''}`}
                                            onClick={() => originalComponent && setSelectedId(originalComponent.designator)}
                                        >
                                            {originalComponent?.designator || alt.original_mpn}
                                        </span>
                                    </p>
                                    <div className="mt-2 space-y-1">
                                        {alt.replacements.map((rep, rIndex) => (
                                            <div key={rIndex} className="text-xs pl-4 border-l-2 border-gray-700">
                                                <p className="font-semibold text-brand-primary">{rep.mpn}</p>
                                                <p className="text-gray-400">{rep.reason}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

             {advice.next_steps && advice.next_steps.length > 0 && (
                <div>
                    <h3 className="flex items-center space-x-2 text-md font-semibold text-white mb-2">
                        <ArrowRightIcon className="h-5 w-5 text-blue-400" />
                        <span>Next Steps</span>
                    </h3>
                    <ol className="space-y-2 list-inside">
                        {advice.next_steps.map((step, index) => (
                             <li key={index} className="flex items-start space-x-3 bg-gray-800/60 p-3 rounded-md">
                                <span className="flex-shrink-0 h-5 w-5 bg-gray-700 text-brand-primary text-xs font-bold rounded-full flex items-center justify-center">{index + 1}</span>
                                <span className="text-sm text-gray-300">{step}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    )
}

const ChatView: React.FC<Pick<ResultsPanelProps, 'chatHistory' | 'isChatLoading' | 'onSendMessage' | 'selectedId' | 'analysis'>> = ({ chatHistory, isChatLoading, onSendMessage, selectedId, analysis }) => {
    const [message, setMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const selectedComponent = useMemo(() => analysis.components.find(c => c.designator === selectedId), [selectedId, analysis]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory]);

    const handleSend = () => {
        if (message.trim()) {
            onSendMessage(message.trim());
            setMessage('');
        }
    };
    
    return (
        <div className="h-full flex flex-col">
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <SparklesIcon className="h-6 w-6 text-purple-400 flex-shrink-0" />}
                        <div className={`max-w-xs lg:max-w-sm rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-brand-primary text-white' : 'bg-gray-700 text-gray-200'}`}>
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                            {msg.jumperSuggestion && (
                                <div className="mt-2 pt-2 border-t border-gray-500/50 text-xs text-blue-300">
                                    <p>Jumper suggestion drawn on image.</p>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isChatLoading && (
                     <div className="flex items-end gap-2">
                        <SparklesIcon className="h-6 w-6 text-purple-400 flex-shrink-0" />
                        <div className="max-w-xs lg:max-w-sm rounded-lg px-4 py-2 bg-gray-700 text-gray-200">
                           <div className="flex items-center space-x-1">
                             <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                             <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                             <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                           </div>
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>
            <div className="p-4 border-t border-gray-700/50">
                 {selectedComponent && (
                    <p className="text-xs text-center text-gray-400 mb-2">
                        Chatting in context of: <span className="font-bold text-gray-200">{selectedComponent.designator}</span>
                    </p>
                )}
                <div className="flex items-center space-x-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !isChatLoading && handleSend()}
                        placeholder="Ask for repair advice..."
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-md py-2 px-3 focus:ring-brand-primary focus:border-brand-primary transition"
                        disabled={isChatLoading}
                    />
                    <button onClick={handleSend} disabled={isChatLoading || !message.trim()} className="p-2 bg-brand-primary rounded-md text-white hover:bg-brand-primary/90 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const ResultsPanel: React.FC<ResultsPanelProps> = (props) => {
  const { summary, components, defects } = props.analysis;
  const [activeTab, setActiveTab] = useState<'summary' | 'explorer' | 'chat'>('summary');
  
  const componentsWithIssues = useMemo(() => components.filter(c => 
      c.presence !== 'ok' || 
      c.condition !== 'ok' || 
      (props.boardVoltage && c.maxVoltage && props.boardVoltage > c.maxVoltage)
  ), [components, props.boardVoltage]);
  
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-xl h-full max-h-[85vh] flex flex-col">
      <div className="p-4 border-b border-gray-700/50">
        <h2 className="text-lg font-bold text-white">Analysis & Repair</h2>
        <p className="text-sm text-gray-400 mt-1">{summary}</p>
         <div className="grid grid-cols-3 gap-2 mt-4">
            <StatCard label="Components" value={components.length} colorClass="text-blue-300" />
            <StatCard label="Issues" value={componentsWithIssues.length} colorClass="text-orange-300" />
            <StatCard label="Defects" value={defects.length} colorClass="text-purple-300" />
        </div>
      </div>

      <div className="border-b border-gray-700/50">
        <nav className="flex space-x-2 p-2">
           <button onClick={() => setActiveTab('summary')} className={`flex-grow flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'summary' ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
             <SparklesIcon className="h-5 w-5" /><span>Summary</span>
          </button>
          <button onClick={() => setActiveTab('explorer')} className={`flex-grow flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'explorer' ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
             <MagnifyingGlassIcon className="h-5 w-5" /><span>Explorer</span>
          </button>
           <button onClick={() => setActiveTab('chat')} className={`flex-grow flex items-center justify-center space-x-2 px-3 py-2 text-sm font-medium rounded-md ${activeTab === 'chat' ? 'bg-brand-primary text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
             <ChatBubbleLeftRightIcon className="h-5 w-5" /><span>Repair Chat</span>
          </button>
        </nav>
      </div>
      
      {activeTab === 'summary' && <SummaryView analysis={props.analysis} setSelectedId={props.setSelectedId} />}
      {activeTab === 'explorer' && <ExplorerView {...props} />}
      {activeTab === 'chat' && <ChatView {...props} />}
      
    </div>
  );
};

export default ResultsPanel;