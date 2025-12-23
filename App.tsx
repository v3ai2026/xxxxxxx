
import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { generateFrontendProject, generateImagePro, generateVideoVeo, groundedChat, editImage, generateSpeech } from './services/geminiService';
import { deployToVercel, checkDeploymentStatus } from './services/vercelService';
import { TEMPLATE_LIBRARY, COMPONENT_LIBRARY } from './services/library';
import { ChatMessage, GeneratedFile, TabType, DeploymentStatus, MediaItem } from './types';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentFiles, setCurrentFiles] = useState<GeneratedFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TabType>(TabType.EDITOR);
  const [vercelToken, setVercelToken] = useState('');
  const [projectName, setProjectName] = useState('ib-automated-deploy');
  const [deployment, setDeployment] = useState<DeploymentStatus | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [groundingEnabled, setGroundingEnabled] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'chat' | 'library' | 'media'>('chat');
  const [selectedFramework, setSelectedFramework] = useState('Next.js');

  // Media Settings
  const [imgSize, setImgSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imgAspect, setImgAspect] = useState('16:9');
  const [vidAspect, setVidAspect] = useState<'16:9' | '9:16'>('16:9');

  // Live API / Audio References
  const [isLiveActive, setIsLiveActive] = useState(false);
  const liveSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeSidebarTab]);

  const handleCommand = async (explicitPrompt?: string) => {
    const prompt = explicitPrompt || input;
    if (!prompt.trim()) return;
    setInput('');
    setIsGenerating(true);
    setMessages(prev => [...prev, { role: 'user', content: prompt }]);

    try {
      let finalResponse = "";
      let groundingLinks = [];

      if (groundingEnabled) {
        const result = await groundedChat(prompt, ['search', 'maps']);
        finalResponse = result.text;
        groundingLinks = result.links;
      } else {
        const result = await generateFrontendProject(`[Framework: ${selectedFramework}] ${prompt}`, thinkingEnabled);
        if (result.files && result.files.length > 0) {
          setCurrentFiles(result.files);
          setSelectedFileIndex(0);
          setActiveTab(TabType.EDITOR);
          finalResponse = `Synthesis complete: ${result.componentName}. All architectural nodes verified.`;
        } else {
          finalResponse = "Neural link established. Response synthesized.";
        }
      }

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: finalResponse,
        groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Neural Drift Error: ${e.message}` }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMediaGen = async (type: 'image' | 'video' | 'edit') => {
    if (!input.trim() && type !== 'edit') return;
    setIsGenerating(true);
    try {
      let url = "";
      if (type === 'image') {
        url = await generateImagePro(input, imgAspect, imgSize);
      } else if (type === 'video') {
        url = await generateVideoVeo(input, vidAspect);
      } else if (type === 'edit' && mediaItems.length > 0) {
        const lastImg = mediaItems.find(m => m.type === 'image')?.url;
        if (lastImg) {
          url = await editImage(input, lastImg.split(',')[1]);
        }
      }
      
      if (url) {
        const item: MediaItem = { id: Date.now().toString(), type: type === 'edit' ? 'image' : type as any, url, prompt: input };
        setMediaItems(prev => [item, ...prev]);
        setActiveTab(TabType.MEDIA);
      }
    } catch (e) { console.error(e); } finally { setIsGenerating(false); }
  };

  const playTTS = async (text: string) => {
    try {
      const base64Audio = await generateSpeech(text);
      if (base64Audio) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const bytes = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0));
        const dataInt16 = new Int16Array(bytes.buffer);
        const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
        const channelData = buffer.getChannelData(0);
        for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start();
      }
    } catch (e) { console.error("TTS Error:", e); }
  };

  const toggleLiveAPI = async () => {
    if (isLiveActive) {
      liveSessionRef.current?.close();
      setIsLiveActive(false);
      return;
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        systemInstruction: "You are the IntelliBuild Voice Core. Respond concisely to architectural queries."
      },
      callbacks: {
        onopen: () => {
          setIsLiveActive(true);
          navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
              sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          });
        },
        onmessage: async (msg: LiveServerMessage) => {
          const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audio) {
            const bytes = Uint8Array.from(atob(audio), c => c.charCodeAt(0));
            const dataInt16 = new Int16Array(bytes.buffer);
            const buffer = outputCtx.createBuffer(1, dataInt16.length, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
            const source = outputCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(outputCtx.destination);
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
          }
        },
        onclose: () => setIsLiveActive(false),
        onerror: () => setIsLiveActive(false)
      }
    });
    liveSessionRef.current = await sessionPromise;
  };

  return (
    <div className="flex h-screen bg-[#020202] text-slate-300 font-sans selection:bg-white/10 overflow-hidden">
      {/* Sidebar: Intelligent Hub */}
      <div className="w-[420px] border-r border-white/5 flex flex-col bg-[#050505] shadow-2xl relative z-20">
        <header className="p-8 border-b border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-black text-black shadow-lg">IB</div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tighter uppercase italic">IntelliBuild</h1>
                <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Compiler v9.0 Neural</div>
              </div>
            </div>
            <button onClick={toggleLiveAPI} className={`w-8 h-8 rounded-full border ${isLiveActive ? 'bg-emerald-500 border-emerald-400 animate-pulse' : 'border-white/10 hover:bg-white/5'} flex items-center justify-center transition-all`}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
            </button>
          </div>
          
          <div className="flex bg-white/[0.03] p-1 rounded-xl border border-white/5 text-[10px] font-black uppercase">
            {['chat', 'library', 'media'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveSidebarTab(tab as any)} 
                className={`flex-1 py-2 rounded-lg transition-all ${activeSidebarTab === tab ? 'bg-white text-black shadow-md' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-none">
          {activeSidebarTab === 'chat' && (
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="p-10 text-center space-y-4 opacity-40">
                  <div className="text-4xl">◇</div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em]">Neural Core Ready</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-5 rounded-[24px] text-xs leading-relaxed max-w-[90%] ${m.role === 'user' ? 'bg-white text-black font-medium shadow-xl' : 'bg-white/5 border border-white/10 group'}`}>
                    {m.content}
                    {m.role === 'assistant' && (
                      <button onClick={() => playTTS(m.content)} className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-white">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                      </button>
                    )}
                    {m.groundingLinks && (
                      <div className="mt-3 pt-3 border-t border-white/5 space-y-1">
                        {m.groundingLinks.map((l, j) => (
                          <a key={j} href={l.uri} target="_blank" className="block text-[9px] text-indigo-400 hover:underline">↗ {l.title}</a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSidebarTab === 'library' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-white tracking-[0.3em]">Neural Blocks</h3>
                {COMPONENT_LIBRARY.map(c => (
                  <button key={c.id} onClick={() => handleCommand(`Create a reusable React component for a ${c.name}: ${c.description}. Ensure it supports props for dynamic data and Tailwind styling.`)} className="w-full text-left p-5 bg-white/[0.03] border border-white/5 rounded-[24px] hover:bg-white/[0.05] transition-all group relative overflow-hidden">
                    <div className="relative z-10 flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-xs font-black text-slate-200 uppercase tracking-tight">{c.name}</span>
                        <p className="text-[10px] text-slate-500 leading-tight font-medium">{c.description}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${c.previewColor} mt-1`}></div>
                    </div>
                  </button>
                ))}
              </section>
            </div>
          )}

          {activeSidebarTab === 'media' && (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500">
               {mediaItems.map(m => (
                 <div key={m.id} className="relative aspect-square bg-black rounded-3xl border border-white/5 overflow-hidden group">
                   {m.type === 'image' ? <img src={m.url} className="w-full h-full object-cover" /> : <video src={m.url} className="w-full h-full object-cover" controls />}
                   <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                     <p className="text-[9px] font-black uppercase tracking-tight line-clamp-2">{m.prompt}</p>
                   </div>
                 </div>
               ))}
            </div>
          )}
        </div>

        <div className="p-8 bg-[#030303] border-t border-white/5 space-y-4">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-widest">
            <div className="flex space-x-2">
              <button onClick={() => setThinkingEnabled(!thinkingEnabled)} className={`px-2 py-1 rounded-full border transition-all ${thinkingEnabled ? 'bg-white text-black border-white' : 'border-white/5 text-slate-600'}`}>Thinking</button>
              <button onClick={() => setGroundingEnabled(!groundingEnabled)} className={`px-2 py-1 rounded-full border transition-all ${groundingEnabled ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/5 text-slate-600'}`}>Grounding</button>
            </div>
            <select value={imgSize} onChange={e => setImgSize(e.target.value as any)} className="bg-transparent text-white outline-none">
              <option value="1K">1K</option><option value="2K">2K</option><option value="4K">4K</option>
            </select>
          </div>
          <div className="relative group">
            <textarea 
              value={input} 
              onChange={e => setInput(e.target.value)}
              className="w-full bg-[#080808] border border-white/5 rounded-3xl p-6 text-sm h-32 focus:ring-1 ring-white outline-none transition-all resize-none font-medium placeholder:text-slate-800" 
              placeholder="Deploy a Modal, generate 4K art, or prompt video..."
              onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommand(); } }}
            />
            <div className="absolute bottom-4 right-4 flex space-x-2">
               <button onClick={() => handleMediaGen('image')} className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all text-white" title="Gen Image"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
               <button onClick={() => handleMediaGen('video')} className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all text-white" title="Gen Video"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2" ry="2"/></svg></button>
               <button onClick={() => handleCommand()} disabled={isGenerating || !input.trim()} className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-black hover:bg-slate-200 disabled:opacity-20 transition-all shadow-xl"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Area */}
      <div className="flex-1 flex flex-col bg-[#020202]">
        <nav className="flex items-center px-10 border-b border-white/5 h-20 bg-[#050505]">
          <div className="flex space-x-12 h-full">
            <TabBtn active={activeTab === TabType.EDITOR} onClick={() => setActiveTab(TabType.EDITOR)} label="Workspace" />
            <TabBtn active={activeTab === TabType.MEDIA} onClick={() => setActiveTab(TabType.MEDIA)} label="Media Lab" />
            <TabBtn active={activeTab === TabType.DEPLOY} onClick={() => setActiveTab(TabType.DEPLOY)} label="Edge Cloud" />
          </div>
          
          <div className="ml-auto flex items-center space-x-8">
             <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Compiler Stack</span>
                <span className="text-[10px] font-black text-white">{selectedFramework}</span>
             </div>
             {isGenerating && (
               <div className="flex items-center space-x-3 px-5 py-2.5 bg-white/5 border border-white/10 rounded-2xl animate-pulse">
                 <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                 <span className="text-[9px] font-black uppercase text-white tracking-[0.2em]">Compiling</span>
               </div>
             )}
          </div>
        </nav>

        <div className="flex-1 overflow-hidden relative">
          {activeTab === TabType.EDITOR ? (
            <div className="h-full flex">
              <div className="w-72 border-r border-white/5 p-8 bg-[#050505] flex flex-col">
                <p className="text-[10px] font-black uppercase text-slate-600 mb-8 tracking-[0.3em]">Source Tree</p>
                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-none">
                  {currentFiles.map((f, i) => (
                    <button 
                      key={i} 
                      onClick={() => setSelectedFileIndex(i)} 
                      className={`w-full text-left px-5 py-4 rounded-2xl text-[11px] font-black transition-all ${selectedFileIndex === i ? 'bg-white text-black shadow-2xl' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                    >
                      {f.path}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 relative">
                <Editor 
                  height="100%" 
                  theme="vs-dark" 
                  defaultLanguage="typescript" 
                  value={currentFiles[selectedFileIndex]?.content || "// Transmitting neural architectural nodes..."} 
                  options={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 15,
                    lineHeight: 1.6,
                    minimap: { enabled: false },
                    padding: { top: 32 },
                    cursorBlinking: 'smooth',
                    smoothScrolling: true
                  }}
                />
              </div>
            </div>
          ) : activeTab === TabType.MEDIA ? (
            <div className="h-full p-16 overflow-y-auto bg-[#030303] scrollbar-none">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pb-32">
                  {mediaItems.map(item => (
                    <div key={item.id} className="bg-[#080808] border border-white/5 rounded-[48px] p-8 space-y-8 shadow-3xl relative group">
                       <div className="aspect-[16/9] bg-black rounded-[32px] overflow-hidden border border-white/5 shadow-inner flex items-center justify-center">
                          {item.type === 'image' ? (
                            <img src={item.url} className="w-full h-full object-contain" />
                          ) : (
                            <video src={item.url} className="w-full h-full object-contain" controls />
                          )}
                       </div>
                       <div className="px-2 flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-widest mb-2 italic">Synthesized Asset</p>
                            <p className="text-xs text-slate-500 font-medium italic opacity-60 truncate max-w-[200px]">"{item.prompt}"</p>
                          </div>
                          <button onClick={() => handleMediaGen('edit')} className="p-3 bg-white/5 rounded-2xl hover:bg-indigo-600 transition-all text-white" title="Edit with Flash Image">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          ) : (
            <div className="h-full bg-[#020202] p-24 flex justify-center">
              <div className="max-w-3xl w-full bg-[#080808] p-20 rounded-[80px] border border-white/5 shadow-3xl space-y-16 relative overflow-hidden text-center">
                <header className="relative z-10 space-y-4">
                  <h2 className="text-7xl font-black text-white italic tracking-tighter">Global Push</h2>
                  <p className="text-[12px] font-black uppercase text-white tracking-[0.5em] opacity-40">Vercel Deployment Provisioning</p>
                </header>
                <div className="space-y-6 relative z-10">
                  <input type="password" value={vercelToken} onChange={e => setVercelToken(e.target.value)} placeholder="VERCEL_AUTH_TOKEN" className="w-full bg-black border border-white/5 p-10 rounded-[40px] text-sm outline-none font-bold placeholder:text-slate-800" />
                  <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Project ID" className="w-full bg-black border border-white/5 p-10 rounded-[40px] text-sm outline-none font-bold placeholder:text-slate-800" />
                  <button onClick={async () => {
                    setIsGenerating(true);
                    try {
                      const d = await deployToVercel(currentFiles, vercelToken, projectName);
                      setDeployment(d);
                    } catch (err: any) {
                      setMessages(prev => [...prev, { role: 'assistant', content: `Push failed: ${err.message}` }]);
                    } finally { setIsGenerating(false); }
                  }} disabled={isGenerating || currentFiles.length === 0} className="w-full bg-white py-10 rounded-[40px] font-black uppercase text-[12px] tracking-[0.4em] text-black hover:bg-slate-200 transition-all shadow-2xl">
                    {isGenerating ? "Handshaking..." : "Initialize Edge Synthesis"}
                  </button>
                </div>
                {deployment && (
                   <div className="p-10 bg-white/5 rounded-[40px] border border-white/10 flex justify-between items-center relative z-10 animate-in fade-in slide-in-from-bottom-8">
                      <div className="text-left">
                        <span className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Cloud Status</span>
                        <span className="text-[12px] font-black uppercase text-emerald-400 tracking-widest animate-pulse">{deployment.state}</span>
                      </div>
                      <a href={`https://${deployment.url}`} target="_blank" className="px-10 py-4 bg-white text-black rounded-[24px] text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Go Live</a>
                   </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const TabBtn: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-4 h-full text-[10px] font-black uppercase tracking-[0.4em] transition-all relative flex items-center group ${active ? 'text-white' : 'text-slate-600'}`}>
    {label}
    {active && <span className="absolute bottom-0 left-0 right-0 h-1.5 bg-white shadow-[0_-10px_30px_rgba(255,255,255,0.8)]"></span>}
  </button>
);

export default App;
