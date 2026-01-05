
import React, { useState, useEffect, useRef } from 'react';
import { GourmetAI } from './services/geminiService';
import { OrderRecord, AppSettings, AppStep } from './types';
import { DEFAULT_MODEL, DEFAULT_SYSTEM_INSTRUCTION, MOCK_ADDRESSES } from './constants';

const App: React.FC = () => {
  const [apiKey] = useState<string>(process.env.API_KEY || '');
  const [settings, setSettings] = useState<AppSettings>({
    modelName: DEFAULT_MODEL,
    systemInstruction: DEFAULT_SYSTEM_INSTRUCTION
  });
  const [history, setHistory] = useState<OrderRecord[]>([]);
  const [step, setStep] = useState<AppStep>(AppStep.IDLE);
  const [statusMessage, setStatusMessage] = useState<string>('Ready');
  const [suggestion, setSuggestion] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<any>(null);

  // Helper for Audio Decoding
  const decodeAndPlay = async (base64: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    const dataInt16 = new Int16Array(bytes.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  };

  // Initial Auto-Scan on Load
  useEffect(() => {
    const autoScan = async () => {
      setStatusMessage('Scanning screen...');
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        setTimeout(async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 720;
          canvas.height = 1280;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            const ai = new GourmetAI(apiKey, settings);
            const extracted = await ai.extractHistoryFromImage(base64);
            setHistory(extracted);
            setStatusMessage('Ready');
            stream.getTracks().forEach(track => track.stop());
            
            // Voice intro
            const intro = "Welcome back. I've updated your taste profile from your latest orders. What can I get for you today?";
            const audio = await ai.generateSpeech(intro);
            if (audio) decodeAndPlay(audio);
          }
        }, 2000);
      } catch (err) {
        setStatusMessage('Ready');
        console.warn('Scan skipped', err);
      }
    };
    autoScan();
  }, [apiKey]);

  const handleOrbClick = () => {
    if (step === AppStep.IDLE) {
      startListening();
    } else if (step === AppStep.RECORDING || step === AppStep.PROCESSING) {
      cancelInteraction();
    } else if (step === AppStep.CONFIRMING) {
      confirmOrder();
    }
  };

  const cancelInteraction = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setStep(AppStep.IDLE);
    setStatusMessage('Ready');
    setSuggestion(null);
  };

  const startListening = () => {
    setStep(AppStep.RECORDING);
    setStatusMessage('Listening...');
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const text = prompt("Speak your order:");
      if (text) processInput(text);
      else setStep(AppStep.IDLE);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      processInput(transcript);
    };
    recognition.onerror = () => {
      setStep(AppStep.IDLE);
      setStatusMessage('Ready');
    };
    recognition.onend = () => {
      recognitionRef.current = null;
    };
    recognition.start();
  };

  const processInput = async (input: string) => {
    setStep(AppStep.PROCESSING);
    setStatusMessage('Processing...');
    
    const ai = new GourmetAI(apiKey, settings);
    try {
      // Internal location logic
      const location = MOCK_ADDRESSES[0];
      const result = await ai.decideOrder(input, history, location);
      
      // If the user cancelled while the network request was flying
      if (statusMessage === 'Ready' && step === AppStep.IDLE) return;

      setSuggestion(result);
      
      // Voice feedback
      const audio = await ai.generateSpeech(result.spokenResponse);
      if (audio) await decodeAndPlay(audio);
      
      setStep(AppStep.CONFIRMING);
      setStatusMessage('Tap to Confirm');
    } catch (err) {
      console.error(err);
      if (step !== AppStep.IDLE) {
        setStep(AppStep.IDLE);
        setStatusMessage('Error');
      }
    }
  };

  const confirmOrder = async () => {
    setStep(AppStep.ORDER_PLACED);
    setStatusMessage('Ordered!');
    
    const ai = new GourmetAI(apiKey, settings);
    const audio = await ai.generateSpeech(`Order placed for ${suggestion.suggestedMeal} from ${suggestion.restaurant}. Bon appétit!`);
    if (audio) await decodeAndPlay(audio);

    setTimeout(() => {
      setStep(AppStep.IDLE);
      setStatusMessage('Ready');
      setSuggestion(null);
    }, 3000);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col items-center justify-center p-8 bg-slate-950 text-white relative overflow-hidden">
      
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-600 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-purple-600 rounded-full blur-[100px]"></div>
      </div>

      <button 
        onClick={() => setShowSettings(true)}
        className="absolute top-8 right-8 w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-all z-20"
      >
        <i className="fas fa-cog"></i>
      </button>

      {/* Main UI */}
      <div className="w-full flex flex-col items-center gap-16 z-10">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold tracking-[0.3em] uppercase text-blue-400">Gourmet AI Assistant</p>
          <p className="text-lg font-medium text-white/60 h-6">{statusMessage}</p>
        </div>

        <div className="relative group">
          <div 
            onClick={handleOrbClick}
            className={`assistant-orb ${step === AppStep.RECORDING || step === AppStep.PROCESSING ? 'pulse ring-4 ring-blue-500/50' : ''} ${step === AppStep.CONFIRMING ? 'bg-green-500 scale-110 shadow-[0_0_60px_rgba(34,197,94,0.4)]' : ''}`}
          >
            {step === AppStep.CONFIRMING ? (
              <i className="fas fa-check text-white text-5xl"></i>
            ) : (
              <i className={`fas ${step === AppStep.RECORDING || step === AppStep.PROCESSING ? 'fa-xmark' : 'fa-microphone'} text-white text-5xl transition-all duration-300`}></i>
            )}
            {step === AppStep.PROCESSING && <div className="scan-line"></div>}
            {step === AppStep.RECORDING && <i className="fas fa-waveform absolute -top-8 text-blue-400 animate-pulse"></i>}
          </div>
          
          {step === AppStep.CONFIRMING && (
            <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[280px] text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <p className="text-xl font-bold">{suggestion.suggestedMeal}</p>
               <p className="text-sm text-white/40">{suggestion.restaurant}</p>
               <button 
                 onClick={() => setStep(AppStep.IDLE)} 
                 className="mt-4 text-xs font-bold text-white/30 hover:text-white uppercase tracking-widest"
               >
                 Cancel Order
               </button>
            </div>
          )}
          
          {(step === AppStep.RECORDING || step === AppStep.PROCESSING) && (
             <p className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-[10px] text-white/40 font-bold uppercase tracking-widest whitespace-nowrap">
              Click to cancel
             </p>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex flex-col p-8 pt-20 animate-in fade-in duration-300">
           <div className="flex justify-between items-center mb-10">
             <h2 className="text-3xl font-bold">Preferences</h2>
             <button onClick={() => setShowSettings(false)} className="text-2xl text-white/40 hover:text-white"><i className="fas fa-times"></i></button>
           </div>
           
           <div className="space-y-8 flex-1 overflow-y-auto">
             <div className="space-y-3">
               <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Model</label>
               <select 
                 value={settings.modelName}
                 onChange={(e) => setSettings({...settings, modelName: e.target.value})}
                 className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white focus:ring-2 focus:ring-blue-500"
               >
                 <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                 <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
               </select>
             </div>

             <div className="space-y-3">
               <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Assistant Instructions</label>
               <textarea 
                 value={settings.systemInstruction}
                 onChange={(e) => setSettings({...settings, systemInstruction: e.target.value})}
                 className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white h-48 resize-none text-sm"
               />
             </div>
           </div>

           <button 
             onClick={() => setShowSettings(false)}
             className="w-full py-5 bg-blue-600 rounded-3xl font-bold mt-8 shadow-2xl shadow-blue-900/40 active:scale-95 transition-transform"
           >
             Save Configuration
           </button>
        </div>
      )}
    </div>
  );
};

export default App;
