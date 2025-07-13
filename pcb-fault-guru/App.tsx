import React, { version } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { PcbAnalysis, ChatMessage, JumperSuggestion, Component } from './types';
import { analyzePcbImage, createChat, sendMessage } from './services/geminiService';
import { generatePdfReport } from './services/pdfService';
import ImageUploader from './components/ImageUploader';
import AnalysisViewer from './components/AnalysisViewer';
import ResultsPanel from './components/ResultsPanel';
import { LogoIcon, SpinnerIcon, DocumentTextIcon } from './components/icons';
import type { Chat, GenerateContentResponse } from '@google/genai';


const App: React.FC = () => {
  const [analysis, setAnalysis] = useState<PcbAnalysis | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // New state for advanced features
  const [boardVoltage, setBoardVoltage] = useState<number | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [jumperSuggestion, setJumperSuggestion] = useState<JumperSuggestion | null>(null);
  const [isReporting, setIsReporting] = useState<boolean>(false);


  useEffect(() => {
    if (analysis && !chat && process.env.API_KEY) {
      setChat(createChat(process.env.API_KEY));
    }
  }, [analysis, chat]);

  const handleImageUpload = useCallback(async (file: File) => {
    handleReset();
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setIsLoading(true);

    try {
      const result = await analyzePcbImage(file);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze PCB image. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = () => {
    setAnalysis(null);
    setImageFile(null);
    if(imageUrl) {
      URL.revokeObjectURL(imageUrl);
    }
    setImageUrl(null);
    setIsLoading(false);
    setError(null);
    setHoveredId(null);
    setSelectedId(null);
    setBoardVoltage(null);
    setChat(null);
    setChatHistory([]);
    setJumperSuggestion(null);
  };
  
  const downloadBOM = () => {
    if (!analysis?.components) return;

    const headers = ["Designator", "MPN", "Presence", "Condition", "Confidence", "Temperature (C)", "Max Voltage (V)", "Datasheet"];
    const csvRows = [headers.join(',')];

    analysis.components.forEach(c => {
        const row = [
          c.designator, 
          c.mpn, 
          c.presence, 
          c.condition, 
          c.confidence,
          c.temperature ?? 'N/A',
          c.maxVoltage ?? 'N/A',
          c.datasheetUrl ?? 'N/A'
        ];
        csvRows.push(row.map(v => `"${v}"`).join(','));
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'bom_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const JUMPER_JSON_REGEX = /```json\s*(\{[\s\S]*?\})\s*```/;

  const handleSendMessage = async (message: string) => {
    if (!chat || isChatLoading) return;

    setIsChatLoading(true);
    const selectedComponent = analysis?.components.find(c => c.designator === selectedId) || undefined;
    const userMessage: ChatMessage = { role: "user", text: message };
    setChatHistory(prev => [...prev, userMessage]);

    try {
      const response: GenerateContentResponse = await sendMessage(chat, message, {
        component: selectedComponent,
        boardVoltage: boardVoltage || undefined,
      });

      const responseText = response.text;
      let jumper: JumperSuggestion | null = null;
      const match = responseText.match(JUMPER_JSON_REGEX);

      if (match && match[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed.jumper?.from && parsed.jumper?.to) {
            jumper = parsed.jumper;
            setJumperSuggestion(jumper);
          }
        } catch (e) {
          console.error("Failed to parse jumper suggestion from model response.", e);
        }
      }

      const modelMessage: ChatMessage = {
        role: "model",
        text: responseText.replace(JUMPER_JSON_REGEX, '').trim(),
        jumperSuggestion: jumper || undefined,
      };
      setChatHistory(prev => [...prev, modelMessage]);

    } catch (err) {
      const errorMessage: ChatMessage = {
        role: "model",
        text: "Sorry, I encountered an error. Please try again."
      };
      setChatHistory(prev => [...prev, errorMessage]);
      console.error("Chat error:", err);
    } finally {
      setIsChatLoading(false);
    }
  };
  
  const handleGenerateReport = async () => {
    if (!analysis || !imageUrl) return;
    setIsReporting(true);
    setError(null); // Clear previous errors
    try {
      await generatePdfReport(analysis, chatHistory, boardVoltage);
    } catch (err) {
      console.error("Failed to generate PDF report:", err);
      if (err instanceof Error && err.message === 'SCREENSHOT_FAILED') {
        setError("Screenshot failed - check the image's CORS policy.");
      } else {
        setError("Could not generate PDF report.");
      }
    } finally {
      setIsReporting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-900 font-sans text-gray-200 flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <LogoIcon className="h-8 w-8 text-brand-primary" />
              <h1 className="text-xl font-semibold text-white">PCB Fault Guru</h1>
            </div>
            <div className="flex items-center space-x-4">
              {analysis && (
                 <div className="flex items-center space-x-2">
                    <label htmlFor="board-voltage" className="text-sm font-medium text-gray-300">Board Voltage:</label>
                    <input
                      id="board-voltage"
                      type="number"
                      value={boardVoltage ?? ''}
                      onChange={(e) => setBoardVoltage(e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-20 bg-gray-700 text-white px-2 py-1 rounded-md text-sm border-gray-600 focus:ring-brand-primary focus:border-brand-primary"
                      placeholder="e.g., 5"
                    />
                     <span className="text-sm text-gray-400">V</span>
                  </div>
              )}
               {analysis && (
                <>
                  <button
                    onClick={handleGenerateReport}
                    disabled={isReporting}
                    className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 disabled:bg-gray-500 disabled:cursor-wait focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-teal-500 rounded-md transition-colors"
                  >
                    <DocumentTextIcon className="h-5 w-5" />
                    <span>{isReporting ? 'Generating...' : 'Generate Report'}</span>
                  </button>
                  <button
                    onClick={downloadBOM}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-brand-primary rounded-md transition-colors"
                  >
                    Download BOM
                  </button>
                </>
              )}
              {(imageUrl || isLoading) && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 rounded-md transition-colors"
                >
                  Start Over
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
        {!imageUrl && <ImageUploader onImageUpload={handleImageUpload} />}
        
        {isLoading && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh]">
                <SpinnerIcon className="h-12 w-12 text-brand-primary" />
                <p className="mt-4 text-lg text-gray-400">The Guru is inspecting the PCB...</p>
                <p className="text-sm text-gray-500">This may take a moment.</p>
            </div>
        )}

        {error && (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
                <p className="text-lg text-red-400">{error}</p>
                 <button
                  onClick={handleReset}
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 rounded-md transition-colors"
                >
                  Try Again
                </button>
            </div>
        )}
        
        {analysis && imageUrl && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
            <div className="lg:col-span-2">
              <AnalysisViewer 
                imageUrl={imageUrl} 
                analysis={analysis} 
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                boardVoltage={boardVoltage}
                jumperSuggestion={jumperSuggestion}
              />
            </div>
            <div className="lg:col-span-1">
              <ResultsPanel 
                analysis={analysis}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                boardVoltage={boardVoltage}
                chatHistory={chatHistory}
                isChatLoading={isChatLoading}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;