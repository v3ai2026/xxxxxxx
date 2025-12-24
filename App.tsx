
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { GoogleGenAI } from "@google/genai";
import { generateFullStackProject, convertToColabNotebook } from './services/geminiService';
import { deployToVercel, checkDeploymentStatus } from './services/vercelService';
import { GitHubService } from './services/githubService';
import { GCSService } from './services/gcsService';
import { GoogleDriveService } from './services/googleDriveService';
import { VercelBlobService } from './services/vercelBlobService';
import { COMPONENT_LIBRARY, TEMPLATE_LIBRARY } from './services/library';
import { PLUGIN_REGISTRY } from './services/extensionService';
import { NeuralModal } from './components/NeuralModal';
import { performNeuralCrawl } from './services/scraperService';
import { GeneratedFile, TabType, DeploymentStatus, ModelConfig, GenerationResult, AIAgent, Extension } from './types';

const INITIAL_SYSTEM = `你是一个顶级进化级全栈 AI 编排 system（IntelliBuild Studio Core）。你正在操作一个分布式的代理集群。风格：极致简约、企业级、奢华深色、Nuxt 翠绿风格。`;

const MARKETPLACE_AGENTS: AIAgent[] = [
  { id: 'm1', name: 'Cyber-Security-Sec', role: 'Security Auditor', model: 'gemini-3-pro-preview', instruction: 'Specializes in identifying SQL injection, XSS, and broken access control in Next.js applications.', status: 'idle' },
  { id: 'm2', name: 'Performance-Turbo', role: 'Optimization Specialist', model: 'gemini-3-flash-preview', instruction: 'Optimizes bundle size, LCP, and CLS scores. Focuses on Vercel Edge Runtime efficiency.', status: 'idle' },
  { id: 'm3', name: 'Copy-Genius', role: 'UX Content Strategist', model: 'gemini-3-flash-preview', instruction: 'Generates high-conversion SaaS copy, micro-interactions text, and multi-lingual localized strings.', status: 'idle' },
  { id: 'm4', name: 'Data-Scientist-Bot', role: 'Inference Architect', model: 'gemini-3-pro-preview', instruction: 'Orchestrates complex data processing pipelines and vector database integrations.', status: 'idle' }
];

const App: React.FC = () => {
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    temperature: 0.7, topP: 0.95, topK: 40, thinkingBudget: 0,
    systemInstruction: INITIAL_SYSTEM
  });

  const [activeTab, setActiveTab] = useState<TabType>(TabType.WORKSPACE);
  const [agentTab, setAgentTab] = useState<'TEAM' | 'REGISTRY'>('TEAM');
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [deployStatus, setDeployStatus] = useState<DeploymentStatus | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [vercelToken, setVercelToken] = useState('');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Agent Management States
  const [agents, setAgents] = useState<AIAgent[]>([
    { id: '1', name: 'Nuxt-Architect', role: 'System Orchestrator', model: 'gemini-3-pro-preview', instruction: 'Primary architecture strategy focused on performance and modern green aesthetics.', status: 'active' },
    { id: '2', name: 'Vibrant-UI', role: 'Aesthetic Specialist', model: 'gemini-3-flash-preview', instruction: 'Ensures Nuxt Green and Deep Navy aesthetics across all components.', status: 'idle' }
  ]);
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Partial<AIAgent> | null>(null);

  // Auth & Infrastructure States
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string>('');
  const [ghToken, setGhToken] = useState('');
  const [blobToken, setBlobToken] = useState('');
  const [blobList, setBlobList] = useState<any[]>([]);

  // Orchestration States
  const [webPrompt, setWebPrompt] = useState('');
  const [isWebGenLoading, setIsWebGenLoading] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);
  const [browserQuery, setBrowserQuery] = useState('');
  const [browserResult, setBrowserResult] = useState<any>(null);

  // Initialize Google SDKs
  useEffect(() => {
    if ((window as any).google) {
      (window as any).google.accounts.oauth2.initTokenClient({
        client_id: '439600021319-33on7g6a29g3r6poh8t1v4p0a3b04c0r.apps.googleusercontent.com',
        scope: 'openid profile email https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/devstorage.full_control',
        callback: (response: any) => {
          if (response.access_token) {
            setAccessToken(response.access_token);
            fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` }
            }).then(r => r.json()).then(setGoogleUser);
          }
        },
      });
    }
  }, []);

  const handleBlobSync = async () => {
    if (!blobToken) return;
    try {
      const service = new VercelBlobService(blobToken);
      const data = await service.list();
      setBlobList(data.blobs || []);
    } catch (e) { console.error(e); }
  };

  const handleBlobUpload = async () => {
    if (!blobToken || !generationResult) return;
    try {
      const service = new VercelBlobService(blobToken);
      const { url } = await service.put(`projects/${generationResult.projectName.toLowerCase()}/state.json`, JSON.stringify(generationResult), 'public');
      handleBlobSync();
      alert(`Persistence synchronized successfully to: ${url}`);
    } catch (e) { console.error(e); }
  };

  const handleExportColab = () => {
    if (!generationResult) return;
    const notebook = convertToColabNotebook(generationResult.files, generationResult.projectName);
    const blob = new Blob([notebook], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generationResult.projectName.toLowerCase().replace(/\s+/g, '-')}.ipynb`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerate = async () => {
    if (!input) return;
    setIsGenerating(true);
    try {
      const result = await generateFullStackProject(input, modelConfig, COMPONENT_LIBRARY, []);
      setGenerationResult(result);
      if (result.files.length > 0) {
        setSelectedFile(result.files[0]);
        setActiveTab(TabType.EDITOR);
      }
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const handleWebGen = async () => {
    if (!webPrompt) return;
    setIsWebGenLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Create a professional single-file HTML/Tailwind CSS website for: ${webPrompt}. Use modern typography and Nuxt-inspired dark theme.`,
      });
      setGeneratedHtml(response.text || '');
    } catch (e) { console.error(e); } finally { setIsWebGenLoading(false); }
  };

  const handleSaveAgent = () => {
    if (!editingAgent?.name || !editingAgent?.role) return;
    if (editingAgent.id && agents.some(a => a.id === editingAgent.id)) {
      setAgents(prev => prev.map(a => a.id === editingAgent.id ? (editingAgent as AIAgent) : a));
    } else {
      const newAgent: AIAgent = {
        ...(editingAgent as AIAgent),
        id: Math.random().toString(36).substr(2, 9),
        status: 'idle'
      };
      setAgents(prev => [...prev, newAgent]);
    }
    setIsAgentModalOpen(false);
    setEditingAgent(null);
  };

  const handleDownloadRegistryAgent = (marketAgent: AIAgent) => {
    if (agents.some(a => a.name === marketAgent.name)) {
      alert("This agent is already part of your team.");
      return;
    }
    setAgents(prev => [...prev, { ...marketAgent, id: Math.random().toString(36).substr(2, 9) }]);
    setAgentTab('TEAM');
  };

  const handleShareAgent = (agent: AIAgent) => {
    alert(`Successfully broadcasted "${agent.name}" to the global Neural Registry. Synchronizing shards...`);
  };

  const handleDeleteAgent = (id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div className="flex h-screen bg-[#020420] text-white font-sans overflow-hidden">
      {/* Side Navigation */}
      <nav className="w-24 border-r border-[#1a1e43] flex flex-col items-center py-10 gap-2 bg-[#020420] z-30 shadow-2xl overflow-y-auto no-scrollbar shrink-0">
        <div 
          className="w-14 h-14 rounded-2xl bg-nuxt-gradient shadow-[0_0_30px_rgba(0,220,130,0.4)] flex items-center justify-center text-black font-black text-2xl mb-8 cursor-pointer hover:scale-110 transition-transform active:scale-95 shrink-0"
          onClick={() => setActiveTab(TabType.WORKSPACE)}
        >I</div>

        <div className="flex flex-col items-center gap-4 py-4 border-b border-white/5 w-full">
          <NavButton icon="🏠" label="Home" type={TabType.WORKSPACE} active={activeTab} onClick={setActiveTab} />
          <NavButton icon="🎨" label="Design" type={TabType.WEBSITE_GEN} active={activeTab} onClick={setActiveTab} />
        </div>

        <div className="flex flex-col items-center gap-4 py-4 border-b border-white/5 w-full">
          <NavButton icon="📂" label="Editor" type={TabType.EDITOR} active={activeTab} onClick={setActiveTab} />
          <NavButton icon="🤖" label="Agents" type={TabType.AGENT_MANAGER} active={activeTab} onClick={setActiveTab} />
          <NavButton icon="🔌" label="Plugin" type={TabType.PLUGINS} active={activeTab} onClick={setActiveTab} />
        </div>

        <div className="flex flex-col items-center gap-4 py-4 border-b border-white/5 w-full">
          <NavButton icon="🌐" label="Ground" type={TabType.BROWSER} active={activeTab} onClick={setActiveTab} />
          <NavButton icon="🧠" label="Vault" type={TabType.KNOWLEDGE} active={activeTab} onClick={setActiveTab} />
        </div>

        <div className="flex flex-col items-center gap-4 py-4 border-b border-white/5 w-full">
          <NavButton icon="🐙" label="SCM" type={TabType.GITHUB} active={activeTab} onClick={setActiveTab} />
          <NavButton icon="☁️" label="Storage" type={TabType.GCS} active={activeTab} onClick={setActiveTab} />
          <NavButton icon="📦" label="Drive" type={TabType.DRIVE} active={activeTab} onClick={setActiveTab} />
          <NavButton icon="🗄️" label="Database" type={TabType.BLOB} active={activeTab} onClick={setActiveTab} />
        </div>

        <div className="flex flex-col items-center gap-4 pt-4 w-full">
          <NavButton icon="🚀" label="Deploy" type={TabType.DEPLOY} active={activeTab} onClick={setActiveTab} />
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 border-b border-[#1a1e43] flex items-center justify-between px-10 bg-[#020420]/95 backdrop-blur-3xl z-20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 rounded-full bg-[#00DC82] shadow-[0_0_12px_#00DC82] animate-pulse" />
            <h2 className="text-[11px] font-black text-[#00DC82] uppercase tracking-[0.6em]">{activeTab} Interface</h2>
          </div>
          <div className="flex items-center gap-6">
            {googleUser && (
              <div className="flex items-center gap-3 p-2 rounded-2xl bg-white/5 border border-white/10 pr-6">
                <img src={googleUser.picture} className="w-6 h-6 rounded-full border border-[#00DC82]/30" alt="Avatar" />
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{googleUser.name}</span>
              </div>
            )}
            <button onClick={() => setIsConfigOpen(true)} className="px-8 py-3 bg-nuxt-gradient text-black text-[10px] font-black tracking-[0.2em] uppercase rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl">Protocol Params</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar relative bg-[#020420]">
          {activeTab === TabType.WORKSPACE && (
            <div className="h-full flex flex-col items-center justify-center p-16 gap-16 animate-modal-fade text-center">
              <div className="space-y-4">
                <h1 className="text-[8.5rem] font-black tracking-tighter text-nuxt drop-shadow-2xl select-none">IntelliBuild</h1>
                <p className="text-[12px] font-black text-slate-500 uppercase tracking-[1.5em] opacity-60">Neural Agent Orchestration</p>
              </div>
              <div className="w-full max-w-4xl relative group">
                <textarea 
                  value={input} 
                  onChange={e => setInput(e.target.value)} 
                  placeholder="Initiate evolution sequence. Describe your multi-agent protocol..." 
                  className="w-full h-80 bg-[#03062c] border border-[#1a1e43] rounded-[4rem] p-16 text-2xl outline-none focus:border-[#00DC82]/50 shadow-[0_0_60px_rgba(0,0,0,0.5)] resize-none transition-all placeholder:text-slate-800 font-medium" 
                />
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating} 
                  className="absolute bottom-12 right-12 px-16 py-6 bg-nuxt-gradient text-black rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(0,220,130,0.4)] hover:scale-105 active:scale-95 transition-all"
                >
                  {isGenerating ? 'Synthesizing...' : 'Initialize Build'}
                </button>
              </div>
            </div>
          )}

          {activeTab === TabType.AGENT_MANAGER && (
            <div className="h-full flex flex-col animate-modal-fade">
              <div className="p-16 px-20 flex justify-between items-end border-b border-[#1a1e43] bg-black/20">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-7xl font-black tracking-tighter uppercase text-[#00DC82]">Distributed Agents</h2>
                    <p className="text-[12px] font-black text-slate-500 tracking-[1em] uppercase leading-relaxed">Agent Governance & Neural Provisioning</p>
                  </div>
                  <div className="flex gap-10">
                    <button 
                      onClick={() => setAgentTab('TEAM')} 
                      className={`text-[11px] font-black uppercase tracking-[0.3em] pb-3 border-b-2 transition-all ${agentTab === 'TEAM' ? 'border-[#00DC82] text-white' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
                    >
                      Active Shards ({agents.length})
                    </button>
                    <button 
                      onClick={() => setAgentTab('REGISTRY')} 
                      className={`text-[11px] font-black uppercase tracking-[0.3em] pb-3 border-b-2 transition-all ${agentTab === 'REGISTRY' ? 'border-[#00DC82] text-white' : 'border-transparent text-slate-600 hover:text-slate-400'}`}
                    >
                      Neural Registry
                    </button>
                  </div>
                </div>
                <button 
                  onClick={() => { setEditingAgent({ model: 'gemini-3-flash-preview' }); setIsAgentModalOpen(true); }}
                  className="px-10 py-5 bg-nuxt-gradient text-black font-black uppercase text-[12px] tracking-widest rounded-2xl shadow-xl hover:scale-105 transition-all mb-4"
                >
                  Provision New Shard
                </button>
              </div>

              <div className="flex-1 p-20 overflow-y-auto custom-scrollbar">
                {agentTab === 'TEAM' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {agents.map(agent => (
                      <div key={agent.id} className="p-10 bg-[#03062c] border border-[#1a1e43] rounded-[3rem] shadow-xl hover:border-[#00DC82]/30 transition-all group relative flex flex-col">
                        <div className="flex items-center justify-between mb-8">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-white/5 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🤖</div>
                          <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${agent.status === 'active' ? 'bg-[#00DC82]/10 text-[#00DC82]' : 'bg-slate-800 text-slate-500'}`}>
                            {agent.status}
                          </div>
                        </div>
                        <div className="space-y-2 mb-6">
                          <h3 className="text-2xl font-black text-white">{agent.name}</h3>
                          <div className="text-[11px] font-black text-[#00DC82] uppercase tracking-[0.2em]">{agent.role}</div>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-10 flex-1 line-clamp-3 italic opacity-80">
                          "{agent.instruction}"
                        </p>
                        <div className="pt-8 border-t border-white/5 flex items-center justify-between mt-auto">
                          <div className="text-[10px] font-mono text-slate-600 uppercase">
                            Core: {agent.model}
                          </div>
                          <div className="flex gap-6">
                            <button onClick={() => handleShareAgent(agent)} className="text-[10px] font-black uppercase text-[#00DC82]/70 hover:text-[#00DC82] transition-colors">Broadcast</button>
                            <button onClick={() => { setEditingAgent(agent); setIsAgentModalOpen(true); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors">Config</button>
                            <button onClick={() => handleDeleteAgent(agent.id)} className="text-[10px] font-black uppercase text-red-500/50 hover:text-red-500 transition-colors">Terminate</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {MARKETPLACE_AGENTS.map(agent => (
                      <div key={agent.id} className="p-10 bg-[#020420] border border-[#1a1e43] rounded-[3rem] shadow-2xl hover:border-[#00DC82]/50 transition-all group flex flex-col border-dashed">
                        <div className="flex items-center justify-between mb-8">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-[#00DC82]/5 flex items-center justify-center text-3xl group-hover:rotate-12 transition-transform">🛰️</div>
                          <div className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 text-slate-500">
                            Verified Shard
                          </div>
                        </div>
                        <div className="space-y-2 mb-6">
                          <h3 className="text-2xl font-black text-white">{agent.name}</h3>
                          <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">{agent.role}</div>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed mb-10 flex-1">
                          {agent.instruction}
                        </p>
                        <button 
                          onClick={() => handleDownloadRegistryAgent(agent)}
                          className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[11px] font-black uppercase tracking-widest text-slate-300 hover:bg-[#00DC82] hover:text-black transition-all flex items-center justify-center gap-3"
                        >
                          <span>Sync Shard</span>
                          <span className="text-lg">📥</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === TabType.BLOB && (
            <div className="h-full p-20 flex flex-col gap-12 animate-modal-fade max-w-6xl mx-auto">
              <div className="space-y-4">
                <h2 className="text-7xl font-black tracking-tighter uppercase text-[#00DC82]">Cloud Shard DB</h2>
                <p className="text-[12px] font-black text-slate-500 tracking-[1em] uppercase leading-relaxed">Vercel Blob Persistent Storage Gateway</p>
              </div>
              <div className="p-12 bg-[#03062c] border border-[#1a1e43] rounded-[4rem] shadow-2xl space-y-12">
                <div className="space-y-6">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">Database Persistence Token</label>
                  <input type="password" value={blobToken} onChange={e => setBlobToken(e.target.value)} placeholder="BLOB_READ_WRITE_TOKEN" className="w-full bg-[#020420] border border-[#1a1e43] rounded-3xl px-10 py-6 text-sm outline-none focus:border-[#00DC82]/50 font-mono text-[#00DC82]" />
                </div>
                <div className="flex gap-6">
                  <button onClick={handleBlobSync} className="flex-1 py-6 bg-white/5 border border-white/10 rounded-2xl font-black text-[11px] tracking-widest hover:bg-white/10 transition-all uppercase">Analyze Store</button>
                  <button onClick={handleBlobUpload} disabled={!generationResult || !blobToken} className="flex-1 py-6 bg-nuxt-gradient text-black rounded-2xl font-black text-[11px] tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-xl uppercase">Sync Current State</button>
                </div>
              </div>
              <div className="space-y-6">
                {blobList.map((blob, i) => (
                  <div key={i} className="p-8 bg-[#03062c] border border-[#1a1e43] rounded-[2.5rem] flex items-center justify-between group hover:border-[#00DC82]/40 transition-all">
                    <div className="flex flex-col gap-2 overflow-hidden pr-10">
                      <span className="text-[13px] font-bold text-white truncate">{blob.pathname}</span>
                      <span className="text-[10px] text-slate-500 font-mono truncate opacity-60">{blob.url}</span>
                    </div>
                    <a href={blob.url} target="_blank" rel="noreferrer" className="text-[#00DC82] text-[11px] font-black uppercase tracking-[0.2em] px-8 py-3 bg-[#00DC82]/10 rounded-xl hover:bg-[#00DC82]/20 transition-all">Inspect</a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === TabType.EDITOR && generationResult && (
            <div className="h-full flex animate-modal-fade">
              <div className="w-[380px] border-r border-[#1a1e43] bg-[#020420] flex flex-col shrink-0 shadow-2xl z-10">
                <div className="p-10 text-[11px] font-black text-slate-500 uppercase tracking-[0.5em] border-b border-[#1a1e43]">Source Protocol Shards</div>
                <div className="flex-1 overflow-y-auto custom-scrollbar py-6">
                  {generationResult.files.map(file => (
                    <button key={file.path} onClick={() => setSelectedFile(file)} className={`w-full text-left px-12 py-5 text-[12px] font-bold border-l-[6px] transition-all flex items-center gap-4 ${selectedFile?.path === file.path ? 'bg-[#00DC82]/5 border-[#00DC82] text-[#00DC82]' : 'border-transparent text-slate-600 hover:text-white hover:bg-white/5'}`}>
                      <span className="opacity-40">{file.path.endsWith('.tsx') ? '⚛️' : '📄'}</span>
                      <span className="truncate">{file.path.split('/').pop()}</span>
                    </button>
                  ))}
                </div>
                <div className="p-10 border-t border-[#1a1e43] bg-black/40 flex flex-col gap-5">
                  <button onClick={handleExportColab} className="w-full py-5 bg-white/5 border border-white/10 text-slate-300 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-white/10 flex items-center justify-center gap-4 shadow-xl transition-all">
                    <span className="text-lg">📓</span> Google Colab Link
                  </button>
                  <button onClick={() => setActiveTab(TabType.DEPLOY)} className="w-full py-6 bg-nuxt-gradient text-black font-black uppercase tracking-[0.3em] text-[11px] rounded-2xl shadow-[0_0_30px_rgba(0,220,130,0.3)] hover:scale-105 active:scale-95 transition-all">Initiate Deployment</button>
                </div>
              </div>
              <div className="flex-1 bg-[#020420]">
                {selectedFile ? <Editor height="100%" theme="vs-dark" path={selectedFile.path} defaultLanguage="typescript" value={selectedFile.content} options={{ minimap: { enabled: false }, fontSize: 16, lineHeight: 28, fontFamily: 'JetBrains Mono', padding: { top: 40, bottom: 40 } }} /> : <div className="h-full flex flex-col items-center justify-center text-slate-800 uppercase tracking-[1em] font-black opacity-30 select-none"><div className="text-8xl mb-8">💎</div>Awaiting Shard Selection</div>}
              </div>
            </div>
          )}

          {activeTab === TabType.WEBSITE_GEN && (
            <div className="h-full flex animate-modal-fade">
              <div className="w-[520px] border-r border-[#1a1e43] p-16 flex flex-col gap-14 bg-[#020420] shadow-2xl shrink-0">
                <div className="space-y-4">
                  <h2 className="text-6xl font-black text-[#00DC82] uppercase tracking-tighter">Web Studio</h2>
                  <p className="text-[11px] font-black text-slate-600 uppercase tracking-[0.8em]">Rapid Visual Synthesis</p>
                </div>
                <textarea value={webPrompt} onChange={e => setWebPrompt(e.target.value)} placeholder="Describe the UI/UX architecture and aesthetic requirements..." className="w-full h-56 bg-[#03062c] border border-[#1a1e43] rounded-[3rem] p-10 text-base outline-none resize-none focus:border-[#00DC82]/50 transition-all font-medium" />
                <button onClick={handleWebGen} disabled={isWebGenLoading} className="w-full py-8 bg-nuxt-gradient text-black font-black uppercase text-[13px] tracking-[0.3em] rounded-[2rem] shadow-2xl hover:scale-105 active:scale-95 transition-all">{isWebGenLoading ? 'Baking Architecture...' : 'Synthesize Website'}</button>
              </div>
              <div className="flex-1 bg-white relative overflow-hidden">
                {generatedHtml ? <iframe ref={previewRef} title="Web Preview" className="w-full h-full border-none" srcDoc={generatedHtml} /> : <div className="h-full flex flex-col items-center justify-center text-slate-300 bg-[#020420] opacity-30 uppercase tracking-[1.5em] font-black select-none"><div className="text-9xl mb-12">🎨</div>Visual Canvas Standby</div>}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Agent Provisioning Modal */}
      <NeuralModal 
        isOpen={isAgentModalOpen} 
        onClose={() => setIsAgentModalOpen(false)} 
        title={editingAgent?.id ? "Edit Intelligence Shard" : "Provision New Agent Shard"}
        size="lg"
        transition="fadeSlideIn"
      >
        <div className="space-y-10 p-4">
          <div className="grid grid-cols-2 gap-10">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Agent Ident</label>
              <input 
                type="text" 
                value={editingAgent?.name || ''} 
                onChange={e => setEditingAgent(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-[#03062c] border border-[#1a1e43] rounded-2xl px-8 py-5 text-sm outline-none focus:border-[#00DC82]/50 text-white"
                placeholder="Agent Name"
              />
            </div>
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Core Directive (Role)</label>
              <input 
                type="text" 
                value={editingAgent?.role || ''} 
                onChange={e => setEditingAgent(prev => ({ ...prev, role: e.target.value }))}
                className="w-full bg-[#03062c] border border-[#1a1e43] rounded-2xl px-8 py-5 text-sm outline-none focus:border-[#00DC82]/50 text-white"
                placeholder="e.g. System Architect"
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Neural Substrate (Model)</label>
            <select 
              value={editingAgent?.model || 'gemini-3-flash-preview'} 
              onChange={e => setEditingAgent(prev => ({ ...prev, model: e.target.value }))}
              className="w-full bg-[#03062c] border border-[#1a1e43] rounded-2xl p-6 text-[13px] text-[#00DC82] outline-none font-bold tracking-widest"
            >
              <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast Inference)</option>
              <option value="gemini-3-pro-preview">Gemini 3 Pro (High Reasoning)</option>
              <option value="gemini-2.5-flash-native-audio-preview-09-2025">Gemini 2.5 Audio (Native Multimodal)</option>
            </select>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">System Instructions (Inference Protocol)</label>
            <textarea 
              value={editingAgent?.instruction || ''} 
              onChange={e => setEditingAgent(prev => ({ ...prev, instruction: e.target.value }))}
              className="w-full h-48 bg-[#03062c] border border-[#1a1e43] rounded-[2rem] p-8 text-xs text-slate-400 outline-none resize-none custom-scrollbar font-medium leading-relaxed"
              placeholder="Define agent behaviors, goals, and constraints..."
            />
          </div>
          <div className="flex justify-end gap-6 pt-6">
            <button onClick={() => setIsAgentModalOpen(false)} className="px-10 py-4 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSaveAgent} className="px-12 py-4 bg-nuxt-gradient text-black rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl">{editingAgent?.id ? 'Update Shard' : 'Initialize Shard'}</button>
          </div>
        </div>
      </NeuralModal>

      <NeuralModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="Evolution Protocol Configuration" size="lg" transition="fadeSlideIn">
        <div className="space-y-20 p-4">
          <div className="grid grid-cols-2 gap-20">
            <div className="space-y-8">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Creativity Coefficient</label>
              <input type="range" min="0" max="1" step="0.1" value={modelConfig.temperature} onChange={e => setModelConfig({...modelConfig, temperature: parseFloat(e.target.value)})} className="w-full" />
              <div className="flex justify-between text-[10px] font-black text-slate-700 tracking-widest"><span>DETERMINISTIC</span><span>EVOLUTIONARY</span></div>
            </div>
            <div className="space-y-8">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Neural Shard Depth</label>
              <select value={modelConfig.thinkingBudget} onChange={e => setModelConfig({...modelConfig, thinkingBudget: parseInt(e.target.value)})} className="w-full bg-[#03062c] border border-[#1a1e43] rounded-2xl p-6 text-[13px] text-[#00DC82] outline-none font-bold tracking-widest">
                <option value="0">Flash Protocol (Standard)</option>
                <option value="16384">Balanced Reasoning Shard</option>
                <option value="32768">Deep Intelligence Protocol</option>
              </select>
            </div>
          </div>
          <div className="space-y-8">
            <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em]">Core System Instruction Override</label>
            <textarea value={modelConfig.systemInstruction} onChange={e => setModelConfig({...modelConfig, systemInstruction: e.target.value})} className="w-full h-64 bg-[#03062c] border border-[#1a1e43] rounded-[2.5rem] p-10 text-[13px] text-slate-400 outline-none resize-none custom-scrollbar font-medium leading-relaxed" />
          </div>
        </div>
      </NeuralModal>
    </div>
  );
};

const NavButton: React.FC<{ icon: string; label: string; type: TabType; active: TabType; onClick: (t: TabType) => void }> = ({ icon, label, type, active, onClick }) => (
  <button onClick={() => onClick(type)} className={`group relative flex flex-col items-center gap-2 transition-all duration-500 ${active === type ? 'text-[#00DC82]' : 'text-gray-600 hover:text-white'}`}>
    <div className={`p-4 rounded-2xl transition-all duration-300 ${active === type ? 'bg-[#00DC82]/10 shadow-[inset_0_0_15px_rgba(0,220,130,0.1)]' : 'hover:bg-white/5'}`}>
      <span className="text-2xl drop-shadow-md">{icon}</span>
    </div>
    <span className="absolute left-full ml-6 px-4 py-2 bg-[#1a1e43] text-[10px] font-black text-[#00DC82] rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 uppercase tracking-[0.3em] shadow-2xl pointer-events-none whitespace-nowrap z-50 border border-[#00DC82]/20 translate-x-[-10px] group-hover:translate-x-0">
      {label}
    </span>
  </button>
);

export default App;
