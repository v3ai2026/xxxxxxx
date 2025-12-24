
// @google/genai guidelines followed: Always use process.env.API_KEY directly for API calls.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { generateFullStackProject } from './services/geminiService';
import { deployToVercel, checkDeploymentStatus } from './services/vercelService';
import { COMPONENT_LIBRARY, TEMPLATE_LIBRARY } from './services/library';
import { NeuralModal } from './components/NeuralModal';
import { GeneratedFile, TabType, DeploymentStatus, ModelConfig, GenerationResult, AIAgent } from './types';

const INITIAL_SYSTEM = `你是一个顶级进化级全栈 AI 编排系统（IntelliBuild Studio Core）。你正在操作一个分布式的代理集群。风格：极致简约、企业级、奢华深色、流金。`;

const App: React.FC = () => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    thinkingBudget: 0,
    systemInstruction: INITIAL_SYSTEM
  });

  const [activeTab, setActiveTab] = useState<TabType>(TabType.WORKSPACE);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [deployStatus, setDeployStatus] = useState<DeploymentStatus | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [vercelToken, setVercelToken] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Website Gen State
  const [webPrompt, setWebPrompt] = useState('');
  const [isWebGenLoading, setIsWebGenLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // Agent Manager State
  const [agents, setAgents] = useState<AIAgent[]>([
    { id: '1', name: 'Architect-Prime', role: 'System Orchestrator', model: 'gemini-3-pro-preview', instruction: 'Primary architecture strategy.', status: 'active' },
    { id: '2', name: 'Aesthetic-Vanguard', role: 'UI/UX Specialist', model: 'gemini-3-flash-preview', instruction: 'Enforces Luxury Dark and Gold aesthetics.', status: 'idle' }
  ]);
  const [newAgent, setNewAgent] = useState<Partial<AIAgent>>({ model: 'gemini-3-flash-preview' });

  // Update Preview when HTML changes
  useEffect(() => {
    if (generatedHtml && previewRef.current) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(generatedHtml);
        doc.close();
      }
    }
  }, [generatedHtml]);

  // Deployment Polling
  useEffect(() => {
    let interval: number;
    if (deployStatus && (deployStatus.state !== 'READY' && deployStatus.state !== 'ERROR')) {
      interval = window.setInterval(async () => {
        try {
          const status = await checkDeploymentStatus(deployStatus.id, vercelToken);
          setDeployStatus(status);
        } catch (e) {
          console.error("Status check failed", e);
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [deployStatus, vercelToken]);

  const handleGenerate = async () => {
    if (!input) return;
    setIsGenerating(true);
    try {
      const result = await generateFullStackProject(input, modelConfig, COMPONENT_LIBRARY);
      setGenerationResult(result);
      if (result.files.length > 0) {
        setSelectedFile(result.files[0]);
        setActiveTab(TabType.EDITOR);
      }
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWebGen = async () => {
    if (!webPrompt) return;
    setIsWebGenLoading(true);
    try {
      // Specialized generation for single-file HTML preview
      const result = await generateFullStackProject(
        `Create a single-file professional HTML/CSS/JS solution for: ${webPrompt}. 
         Use Tailwind CSS CDN. Ensure the aesthetic is Luxury Dark with gold accents. 
         Return only one file: index.html.`,
        modelConfig,
        COMPONENT_LIBRARY
      );
      const htmlFile = result.files.find(f => f.path.endsWith('.html')) || result.files[0];
      if (htmlFile) setGeneratedHtml(htmlFile.content);
    } catch (error) {
      console.error('Web Generation failed:', error);
    } finally {
      setIsWebGenLoading(false);
    }
  };

  const handleDownloadHtml = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-site.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeploy = async () => {
    if (!generationResult || !vercelToken) return;
    setIsDeploying(true);
    try {
      const status = await deployToVercel(generationResult.files, vercelToken, generationResult.projectName);
      setDeployStatus(status);
    } catch (error: any) {
      alert(`Deployment failed: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleAddAgent = () => {
    if (!newAgent.name || !newAgent.role) return;
    const agent: AIAgent = {
      id: Math.random().toString(36).substr(2, 9),
      name: newAgent.name,
      role: newAgent.role,
      model: newAgent.model || 'gemini-3-flash-preview',
      instruction: newAgent.instruction || '',
      status: 'idle'
    };
    setAgents([...agents, agent]);
    setNewAgent({ model: 'gemini-3-flash-preview' });
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Neural Sidebar */}
      <nav className="w-20 border-r border-[#1a1a1a] flex flex-col items-center py-10 gap-8 bg-[#080808] z-30">
        <div 
          className="w-12 h-12 rounded-2xl bg-gold-gradient shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center text-black font-black text-xl mb-4 cursor-pointer hover:scale-105 transition-transform"
          onClick={() => setActiveTab(TabType.WORKSPACE)}
        >
          S
        </div>
        {[
          { type: TabType.WORKSPACE, icon: '🏠', label: 'Home' },
          { type: TabType.WEBSITE_GEN, icon: '🎨', label: 'Web Gen' },
          { type: TabType.EDITOR, icon: '📂', label: 'Files' },
          { type: TabType.AGENT_MANAGER, icon: '🤖', label: 'Agents' },
          { type: TabType.DEPLOY, icon: '🚀', label: 'Deploy' },
        ].map((item) => (
          <button 
            key={item.type}
            onClick={() => setActiveTab(item.type)} 
            className={`p-4 rounded-2xl transition-all duration-300 relative group ${activeTab === item.type ? 'bg-white/10 text-[#D4AF37]' : 'text-gray-600 hover:text-white hover:bg-white/5'}`}
            title={item.label}
          >
            <span className="text-xl">{item.icon}</span>
            <div className={`absolute left-full ml-4 px-3 py-1 bg-[#121212] border border-[#222] text-[#D4AF37] text-[10px] font-black uppercase tracking-widest rounded hidden group-hover:block whitespace-nowrap z-50`}>
              {item.label}
            </div>
          </button>
        ))}
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-[#1a1a1a] flex items-center justify-between px-10 bg-[#050505]/90 backdrop-blur-2xl z-20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
              <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.5em]">Protocol: {activeTab}</span>
            </div>
            {generationResult && (
              <>
                <div className="h-4 w-px bg-[#1a1a1a]" />
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">{generationResult.projectName}</span>
              </>
            )}
          </div>
          <button onClick={() => setIsConfigOpen(true)} className="px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black tracking-widest uppercase hover:bg-gold-gradient hover:text-black transition-all">Studio Settings</button>
        </header>

        <div className="flex-1 overflow-hidden relative bg-[#050505]">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          {activeTab === TabType.WORKSPACE && (
            <div className="h-full flex flex-col items-center justify-center p-10 max-w-5xl mx-auto text-center gap-14 animate-modal-fade relative z-10">
              <div className="space-y-6">
                <h1 className="text-9xl font-black tracking-tighter text-gold drop-shadow-2xl">IntelliBuild</h1>
                <p className="text-gray-500 text-[11px] font-black tracking-[1em] uppercase">Enterprise Agent Orchestration</p>
              </div>
              <div className="w-full relative group max-w-3xl">
                <div className="absolute -inset-1.5 bg-gold-gradient opacity-20 blur-2xl group-focus-within:opacity-50 transition-all rounded-[3rem]" />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your next SaaS evolution..."
                  className="relative w-full h-64 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[3rem] p-12 text-2xl outline-none focus:border-[#D4AF37]/50 transition-all resize-none shadow-2xl placeholder:text-gray-800 font-medium"
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="absolute bottom-10 right-10 px-14 py-5 bg-gold-gradient text-black rounded-2xl font-black text-[13px] tracking-widest uppercase shadow-[0_0_30px_rgba(212,175,55,0.4)] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isGenerating ? 'Synthesizing Shards...' : 'Initialize Build'}
                </button>
              </div>
              <div className="flex gap-4 flex-wrap justify-center">
                {TEMPLATE_LIBRARY.map(tpl => (
                  <button key={tpl.id} onClick={() => setInput(tpl.description)} className="px-6 py-2.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/5 transition-all text-gray-400 hover:text-[#D4AF37]">
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === TabType.WEBSITE_GEN && (
            <div className="h-full flex animate-modal-fade">
              <div className="w-96 border-r border-[#1a1a1a] p-10 flex flex-col gap-10 bg-[#080808] overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <h2 className="text-3xl font-black tracking-tight text-gold uppercase">Web Factory</h2>
                  <p className="text-[10px] font-black text-gray-600 tracking-[0.4em] uppercase">Single-Shard Visual Generator</p>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Description</label>
                    <textarea 
                      value={webPrompt}
                      onChange={(e) => setWebPrompt(e.target.value)}
                      placeholder="e.g. A modern bento-style portfolio for a senior dev..."
                      className="w-full h-48 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 text-sm outline-none focus:border-[#D4AF37]/50 transition-all resize-none shadow-inner"
                    />
                  </div>
                  <button 
                    onClick={handleWebGen}
                    disabled={isWebGenLoading}
                    className="w-full py-5 bg-gold-gradient text-black font-black uppercase tracking-widest text-[11px] rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isWebGenLoading ? 'Generating Visuals...' : 'Generate Website'}
                  </button>
                  {generatedHtml && (
                    <button 
                      onClick={handleDownloadHtml}
                      className="w-full py-5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                      Download HTML
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-black p-10 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Live Visual Preview</div>
                </div>
                <div className="flex-1 rounded-[2.5rem] border border-[#1a1a1a] overflow-hidden bg-white shadow-2xl">
                  {generatedHtml ? (
                    <iframe 
                      ref={previewRef}
                      title="Preview"
                      className="w-full h-full border-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] gap-4">
                       <div className="w-16 h-16 border-2 border-dashed border-[#222] rounded-full flex items-center justify-center text-gray-800">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                       </div>
                       <p className="text-[10px] font-black text-gray-600