
// @google/genai guidelines followed: Always use process.env.API_KEY directly for API calls.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { GoogleGenAI } from "@google/genai";
import { generateFullStackProject } from './services/geminiService';
import { deployToVercel, checkDeploymentStatus } from './services/vercelService';
import { COMPONENT_LIBRARY } from './services/library';
import { NeuralModal } from './components/NeuralModal';
import { GeneratedFile, TabType, DeploymentStatus, ModelConfig, GenerationResult, AIAgent } from './types';

const INITIAL_SYSTEM = `你是一个顶级进化级全栈 AI 编排系统（IntelliBuild Studio Core）。你正在操作一个分布式的代理集群。风格：极致简约、企业级、奢华深色、流金。
你负责生成高质量的代码、图像和网站。`;

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

  // --- Website Generation States ---
  const [webPrompt, setWebPrompt] = useState('');
  const [isWebGenLoading, setIsWebGenLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  // --- Image Generation States ---
  const [imagePrompt, setImagePrompt] = useState('');
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // --- Agent Manager State ---
  const [agents, setAgents] = useState<AIAgent[]>([
    { id: '1', name: 'Architect-Prime', role: 'System Orchestrator', model: 'gemini-3-pro-preview', instruction: 'Primary architecture strategy.', status: 'active' },
    { id: '2', name: 'UI-Refiner', role: 'Aesthetic Specialist', model: 'gemini-3-flash-preview', instruction: 'Ensures Luxury Dark and Gold aesthetics.', status: 'idle' }
  ]);
  const [newAgent, setNewAgent] = useState<Partial<AIAgent>>({ model: 'gemini-3-flash-preview' });

  // Update Preview for Website Gen when generatedHtml changes or tab switches
  useEffect(() => {
    if (generatedHtml && previewRef.current && activeTab === TabType.WEBSITE_GEN) {
      const doc = previewRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(generatedHtml);
        doc.close();
      }
    }
  }, [generatedHtml, activeTab]);

  // Deployment Polling logic
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a single professional, modern, responsive HTML file for a website with the following description: "${webPrompt}". 
        The design MUST use Tailwind CSS (CDN link) and have a "Luxury Dark" aesthetic: deep black background (#050505), gold accents (#D4AF37), and white/silver text. 
        Include advanced layouts like Bento grids, glassmorphism, and smooth hover effects. 
        Return ONLY the HTML content, no markdown blocks.`,
        config: {
          systemInstruction: "You are an expert frontend developer specializing in luxury dark web designs."
        }
      });
      
      const text = response.text || '';
      // Clean possible markdown wrappers if model ignores instruction
      const cleaned = text.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
      setGeneratedHtml(cleaned);
    } catch (error) {
      console.error('Web Gen failed:', error);
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
    a.download = `intelli-site-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImageGen = async () => {
    if (!imagePrompt) return;
    setIsImageGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: `A high-end luxury dark product shot with cinematic gold lighting: ${imagePrompt}` }] }],
        config: { imageConfig: { aspectRatio: "16:9" } }
      });
      
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setGeneratedImageUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error('Image Gen failed:', error);
      alert('Visual artifact synthesis protocol failed. Check system logs.');
    } finally {
      setIsImageGenerating(false);
    }
  };

  const handleDeploy = async () => {
    if (!generationResult || !vercelToken) return;
    setIsDeploying(true);
    try {
      const status = await deployToVercel(generationResult.files, vercelToken, generationResult.projectName);
      setDeployStatus(status);
    } catch (error: any) {
      alert(`Deployment Pipeline Interrupted: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#050505] text-white font-sans overflow-hidden">
      {/* Side Navigation */}
      <nav className="w-24 border-r border-[#1a1a1a] flex flex-col items-center py-12 gap-10 bg-[#080808] z-30 shadow-2xl">
        <div 
          className="w-14 h-14 rounded-2xl bg-gold-gradient shadow-[0_0_25px_rgba(212,175,55,0.4)] flex items-center justify-center text-black font-black text-2xl mb-4 cursor-pointer hover:scale-110 transition-transform active:scale-95"
          onClick={() => setActiveTab(TabType.WORKSPACE)}
        >
          S
        </div>
        {[
          { type: TabType.WORKSPACE, icon: '🏠', label: 'Studio' },
          { type: TabType.WEBSITE_GEN, icon: '🎨', label: 'Web Gen' },
          { type: TabType.IMAGE_GEN, icon: '🖼️', label: 'Artifacts' },
          { type: TabType.EDITOR, icon: '📂', label: 'Editor' },
          { type: TabType.AGENT_MANAGER, icon: '🤖', label: 'Agents' },
          { type: TabType.DEPLOY, icon: '🚀', label: 'Deploy' },
        ].map((item) => (
          <button 
            key={item.type}
            onClick={() => setActiveTab(item.type)} 
            className={`flex flex-col items-center gap-1.5 transition-all duration-300 relative group ${activeTab === item.type ? 'text-[#D4AF37]' : 'text-gray-600 hover:text-white'}`}
          >
            <div className={`p-4 rounded-2xl transition-all ${activeTab === item.type ? 'bg-white/10 shadow-inner' : 'hover:bg-white/5'}`}>
              <span className="text-2xl">{item.icon}</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-[#1a1a1a] flex items-center justify-between px-12 bg-[#050505]/95 backdrop-blur-3xl z-20">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse shadow-[0_0_8px_#D4AF37]" />
              <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.5em]">System Core: {activeTab}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
              {generationResult ? `Project: ${generationResult.projectName}` : 'Standby Mode'}
            </span>
          </div>
          <button 
            onClick={() => setIsConfigOpen(true)} 
            className="px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black tracking-[0.3em] uppercase hover:bg-gold-gradient hover:text-black transition-all shadow-xl"
          >
            Parameters
          </button>
        </header>

        <div className="flex-1 overflow-hidden relative">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#D4AF37 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          {activeTab === TabType.WORKSPACE && (
            <div className="h-full flex flex-col items-center justify-center p-10 max-w-5xl mx-auto text-center gap-16 animate-modal-fade relative z-10">
              <div className="space-y-6">
                <h1 className="text-[10rem] leading-none font-black tracking-tighter text-gold drop-shadow-[0_0_30px_rgba(212,175,55,0.2)]">IntelliBuild</h1>
                <p className="text-gray-500 text-[12px] font-black tracking-[1.2em] uppercase">The Architect of Digital Evolution</p>
              </div>
              <div className="w-full relative group max-w-4xl">
                <div className="absolute -inset-2 bg-gold-gradient opacity-10 blur-3xl group-focus-within:opacity-30 transition-all rounded-[4rem]" />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Describe your Next.js Full-Stack evolution..."
                  className="relative w-full h-72 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[3.5rem] p-14 text-2xl outline-none focus:border-[#D4AF37]/50 transition-all resize-none shadow-2xl placeholder:text-gray-800 font-medium custom-scrollbar"
                />
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="absolute bottom-12 right-12 px-16 py-6 bg-gold-gradient text-black rounded-2xl font-black text-[14px] tracking-[0.2em] uppercase shadow-[0_0_40px_rgba(212,175,55,0.5)] active:scale-95 transition-all disabled:opacity-50"
                >
                  {isGenerating ? 'Synthesizing...' : 'Initialize Build'}
                </button>
              </div>
            </div>
          )}

          {activeTab === TabType.WEBSITE_GEN && (
            <div className="h-full flex animate-modal-fade">
              <div className="w-[30rem] border-r border-[#1a1a1a] p-12 flex flex-col gap-12 bg-[#080808] overflow-y-auto custom-scrollbar shadow-2xl">
                <div className="space-y-4">
                  <h2 className="text-4xl font-black tracking-tight text-gold uppercase">Web Factory</h2>
                  <p className="text-[10px] font-black text-gray-600 tracking-[0.5em] uppercase leading-relaxed">Visual Site Synthesis Protocol</p>
                </div>
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Prompt Specification</label>
                    <textarea 
                      value={webPrompt}
                      onChange={(e) => setWebPrompt(e.target.value)}
                      placeholder="Describe your website (e.g. Modern landing page for a luxury coffee brand)..."
                      className="w-full h-56 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2rem] p-8 text-sm outline-none focus:border-[#D4AF37]/50 transition-all resize-none shadow-inner"
                    />
                  </div>
                  <button 
                    onClick={handleWebGen}
                    disabled={isWebGenLoading}
                    className="w-full py-6 bg-gold-gradient text-black font-black uppercase tracking-[0.3em] text-[12px] rounded-2xl shadow-2xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isWebGenLoading ? 'Generating Shard...' : 'Start Generating'}
                  </button>
                  {generatedHtml && (
                    <button 
                      onClick={handleDownloadHtml}
                      className="w-full py-5 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-3"
                    >
                      <span>📥</span> Download Site Artifact
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 bg-black p-12 flex flex-col">
                <div className="flex-1 rounded-[3rem] border border-[#1a1a1a] overflow-hidden bg-white shadow-[0_0_100px_rgba(0,0,0,0.8)] relative group">
                  {generatedHtml ? (
                    <iframe 
                      ref={previewRef}
                      title="Site Preview"
                      className="w-full h-full border-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] gap-6">
                      <div className="w-20 h-20 border-2 border-dashed border-[#D4AF37]/30 rounded-full animate-spin flex items-center justify-center">
                        <div className="w-4 h-4 bg-[#D4AF37] rounded-full" />
                      </div>
                      <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.5em]">Waiting for Web Artifact Generation...</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === TabType.IMAGE_GEN && (
            <div className="h-full flex flex-col items-center justify-center p-24 animate-modal-fade max-w-5xl mx-auto gap-16">
               <div className="text-center space-y-6">
                 <h2 className="text-7xl font-black tracking-tighter uppercase text-gold drop-shadow-xl">Visual Artifacts</h2>
                 <p className="text-[11px] font-black text-gray-600 tracking-[0.8em] uppercase">Imagen Protocol v4.0</p>
               </div>
               <div className="w-full flex gap-6 p-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-[2.5rem] shadow-2xl focus-within:border-[#D4AF37]/30 transition-all">
                 <input 
                   type="text" 
                   value={imagePrompt}
                   onChange={e => setImagePrompt(e.target.value)}
                   placeholder="Describe the aesthetic artifact..."
                   className="flex-1 bg-transparent px-10 py-6 text-xl outline-none placeholder:text-gray-800"
                 />
                 <button 
                   onClick={handleImageGen}
                   disabled={isImageGenerating}
                   className="px-14 py-6 bg-gold-gradient text-black font-black uppercase tracking-widest text-[13px] rounded-3xl shadow-2xl active:scale-95 transition-all"
                 >
                   {isImageGenerating ? 'Synthesizing...' : 'Generate'}
                 </button>
               </div>
               {generatedImageUrl ? (
                 <div className="w-full rounded-[4rem] border border-[#1a1a1a] overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.1)] aspect-video bg-black flex items-center justify-center relative group">
                    <img src={generatedImageUrl} alt="Generated Artifact" className="max-w-full max-h-full object-contain transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute bottom-10 left-10 p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#D4AF37]">
                      High Fidelity Synthesis
                    </div>
                 </div>
               ) : (
                 <div className="w-full aspect-video border border-dashed border-[#1a1a1a] rounded-[4rem] flex items-center justify-center bg-white/[0.01]">
                    <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Artifact Display Port Standby</span>
                 </div>
               )}
            </div>
          )}

          {activeTab === TabType.EDITOR && generationResult && (
            <div className="h-full flex animate-modal-fade">
              <div className="w-96 border-r border-[#1a1a1a] bg-[#080808] overflow-y-auto custom-scrollbar shadow-2xl">
                <div className="p-10 text-[10px] font-black text-gray-600 uppercase tracking-[0.4em] border-b border-[#1a1a1a]">Project Shards</div>
                <div className="py-6">
                  {generationResult.files.map(file => (
                    <button 
                      key={file.path} 
                      onClick={() => setSelectedFile(file)} 
                      className={`w-full text-left px-12 py-6 text-[11px] font-bold border-l-4 transition-all flex items-center justify-between ${selectedFile?.path === file.path ? 'bg-[#D4AF37]/5 border-[#D4AF37] text-[#D4AF37]' : 'border-transparent text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                      <span className="truncate">{file.path.split('/').pop()}</span>
                      <span className="text-[8px] opacity-40">{file.type}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 bg-[#050505]">
                <Editor 
                  height="100%" 
                  theme="vs-dark" 
                  path={selectedFile?.path} 
                  defaultLanguage="typescript" 
                  value={selectedFile?.content} 
                  options={{ 
                    minimap: { enabled: false }, 
                    fontSize: 16, 
                    padding: { top: 40, bottom: 40 },
                    lineHeight: 28,
                    fontFamily: 'JetBrains Mono'
                  }} 
                />
              </div>
            </div>
          )}

          {activeTab === TabType.AGENT_MANAGER && (
            <div className="h-full p-20 overflow-y-auto custom-scrollbar animate-modal-fade">
              <div className="max-w-6xl mx-auto space-y-16">
                <div className="space-y-4">
                  <h2 className="text-6xl font-black tracking-tighter text-gold uppercase">Agent Collective</h2>
                  <p className="text-[11px] font-black text-gray-600 tracking-[0.5em] uppercase">Intelligence Node Management</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {agents.map(agent => (
                    <div key={agent.id} className="p-12 bg-[#0c0c0c] border border-[#1a1a1a] rounded-[3.5rem] space-y-8 hover:border-[#D4AF37]/30 transition-all relative overflow-hidden group shadow-2xl">
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-gold-gradient opacity-[0.03] rounded-full blur-3xl group-hover:opacity-[0.08] transition-opacity" />
                      <div className="flex justify-between items-start relative z-10">
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.3em]">{agent.role}</span>
                          <h3 className="text-4xl font-black text-white">{agent.name}</h3>
                        </div>
                        <div className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest ${agent.status === 'active' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 shadow-[0_0_15px_rgba(212,175,55,0.2)]' : 'bg-white/5 text-gray-600 border border-white/5'}`}>
                          {agent.status}
                        </div>
                      </div>
                      <p className="text-gray-400 text-base leading-relaxed">{agent.instruction}</p>
                      <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-gray-700 font-black uppercase tracking-widest">{agent.model}</span>
                        <div className="flex gap-6">
                          <button className="text-[10px] font-black text-gray-500 hover:text-white transition-colors uppercase">Tune</button>
                          <button className="text-[10px] font-black text-gray-500 hover:text-red-500 transition-colors uppercase">Kill</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="p-12 bg-[#050505] border-2 border-dashed border-[#1a1a1a] rounded-[3.5rem] flex flex-col gap-8 hover:border-[#D4AF37]/40 transition-all shadow-xl group">
                    <h4 className="text-[12px] font-black text-gray-500 uppercase tracking-[0.5em] text-center group-hover:text-gray-300">Provision Intelligence</h4>
                    <div className="space-y-5">
                      <input 
                        type="text" 
                        placeholder="Agent Alias" 
                        className="w-full bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl px-8 py-5 text-sm outline-none focus:border-[#D4AF37]/50"
                        value={newAgent.name || ''}
                        onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                      />
                      <input 
                        type="text" 
                        placeholder="Functional Role" 
                        className="w-full bg-[#0c0c0c] border border-[#1a1a1a] rounded-2xl px-8 py-5 text-sm outline-none focus:border-[#D4AF37]/50"
                        value={newAgent.role || ''}
                        onChange={e => setNewAgent({...newAgent, role: e.target.value})}
                      />
                    </div>
                    <button 
                      onClick={() => alert('Agent Provisioning Initiated')}
                      className="w-full py-6 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gold-gradient hover:text-black transition-all shadow-lg"
                    >
                      Initialize Shard
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === TabType.DEPLOY && (
            <div className="h-full flex flex-col items-center justify-center p-20 max-w-4xl mx-auto gap-16 animate-modal-fade text-center relative z-10">
              <div className="w-40 h-40 bg-gold-gradient rounded-[3rem] flex items-center justify-center shadow-[0_0_60px_rgba(212,175,55,0.3)] animate-pulse">
                <span className="text-7xl">⚡</span>
              </div>
              <div className="space-y-4">
                <h2 className="text-7xl font-black tracking-tighter uppercase text-gold drop-shadow-2xl">Production Pipeline</h2>
                <p className="text-[12px] font-black text-gray-600 tracking-[1em] uppercase">Vercel Edge Integration</p>
              </div>
              
              {!deployStatus ? (
                <div className="w-full space-y-12 bg-[#0c0c0c] border border-[#1a1a1a] p-20 rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] gold-glow">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block text-left px-6">Deployment Authorization</label>
                    <input 
                      type="password" 
                      placeholder="Vercel API Token (sk_...)" 
                      value={vercelToken} 
                      onChange={(e) => setVercelToken(e.target.value)} 
                      className="w-full bg-black border border-[#1a1a1a] rounded-[1.5rem] px-12 py-7 text-sm outline-none focus:border-[#D4AF37]/50 font-mono transition-all text-center tracking-widest" 
                    />
                  </div>
                  <button 
                    onClick={handleDeploy} 
                    disabled={isDeploying || !vercelToken || !generationResult}
                    className="w-full py-8 bg-gold-gradient text-black font-black uppercase tracking-[0.5em] text-[14px] rounded-3xl shadow-2xl hover:scale-[1.03] transition-all disabled:opacity-50"
                  >
                    {isDeploying ? 'Deploying Shards...' : 'Initialize Production Deploy'}
                  </button>
                </div>
              ) : (
                <div className="w-full p-20 bg-[#0c0c0c] border border-[#D4AF37]/30 rounded-[4rem] shadow-2xl animate-modal-fade space-y-12">
                   <div className="space-y-4">
                      <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em]">Network State</p>
                      <p className="text-5xl font-black text-[#D4AF37] uppercase animate-pulse">{deployStatus.state}</p>
                   </div>
                   <div className="space-y-6">
                      <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em]">Production Access Point</p>
                      <a 
                        href={`https://${deployStatus.url}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="block p-10 bg-black border border-[#1a1a1a] rounded-[2rem] text-[#D4AF37] font-mono text-2xl hover:border-[#D4AF37]/50 transition-all truncate shadow-inner"
                      >
                        {deployStatus.url}
                      </a>
                   </div>
                   <button 
                    onClick={() => setDeployStatus(null)}
                    className="text-[11px] font-black text-gray-600 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Return to Orchestration Cycle
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Global Settings Modal */}
      <NeuralModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        title="Studio Protocol Config" 
        transition="fadeSlideIn" 
        size="lg"
      >
        <div className="space-y-16">
          <div className="grid grid-cols-2 gap-16">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Creativity Gain</label>
                <span className="text-[11px] font-black text-[#D4AF37]">{modelConfig.temperature}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.1" 
                value={modelConfig.temperature} 
                onChange={(e) => setModelConfig({...modelConfig, temperature: parseFloat(e.target.value)})} 
                className="w-full accent-[#D4AF37] h-1.5 rounded-full appearance-none bg-white/5 cursor-pointer" 
              />
            </div>
            <div className="space-y-6">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Reasoning Depth</label>
              <select 
                value={modelConfig.thinkingBudget} 
                onChange={(e) => setModelConfig({...modelConfig, thinkingBudget: parseInt(e.target.value)})} 
                className="w-full bg-black border border-[#1a1a1a] rounded-2xl px-8 py-5 text-[12px] font-black text-[#D4AF37] outline-none cursor-pointer hover:border-[#D4AF37]/30 transition-all"
              >
                <option value="0">Standard Inference</option>
                <option value="16384">Balanced Reasoning</option>
                <option value="32768">Deep Neural Synthesis</option>
              </select>
            </div>
          </div>
          <div className="space-y-6">
             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">System Protocol Instruction</label>
             <textarea 
               value={modelConfig.systemInstruction}
               onChange={(e) => setModelConfig({...modelConfig, systemInstruction: e.target.value})}
               className="w-full h-56 bg-black border border-[#1a1a1a] rounded-3xl p-8 text-[13px] font-medium text-gray-400 outline-none focus:border-[#D4AF37]/50 transition-all resize-none custom-scrollbar"
             />
          </div>
        </div>
      </NeuralModal>
    </div>
  );
};

export default App;
