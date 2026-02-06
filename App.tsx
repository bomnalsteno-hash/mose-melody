import React, { useState, useRef, useEffect } from 'react';
import { AudioEngine } from './services/audioEngine';
import Visualizer from './components/Visualizer';
import CursorTrail from './components/CursorTrail';
import { ThemeConfig, DEFAULT_THEME, PlaybackEvent } from './types';
import { Music, Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [inputText, setInputText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [events, setEvents] = useState<PlaybackEvent[]>([]);
  const [isAutoTheme, setIsAutoTheme] = useState(true);
  const [selectedMood, setSelectedMood] = useState<string>('');
  const [selectedWaveform, setSelectedWaveform] = useState<OscillatorType | ''>('');
  const [selectedBaseFreq, setSelectedBaseFreq] = useState<number | ''>('');
  const [selectedTempo, setSelectedTempo] = useState<number | ''>('');
  const [selectedScale, setSelectedScale] = useState<string>('');
  
  const audioEngineRef = useRef<AudioEngine>(new AudioEngine());
  
  // These refs are for the Visualizer to access raw audio timing without re-renders
  const audioCtxRef = useRef<AudioContext | null>(null);
  const startTimeRef = useRef<number>(0);
  const totalDurationRef = useRef<number>(0);
  const [playbackProgress, setPlaybackProgress] = useState(0); // 0~1 사이 진척도

  // 미리 정의된 스케일 프리셋
  const scalePresets: Record<string, number[]> = {
    'major': [0, 2, 4, 7, 9],
    'minor': [0, 3, 5, 7, 10],
    'dreamy': [0, 2, 5, 9, 11],
    'dark': [0, 1, 4, 6, 10],
  };

  // 자동 테마 생성 로직 (간단 규칙 기반)
  const buildAutoTheme = (text: string): ThemeConfig => {
    const base: ThemeConfig = { ...DEFAULT_THEME };
    const lower = text.toLowerCase();

    let mood = 'Neutral';
    let primaryColor = '#38bdf8';
    let secondaryColor = '#ffffff';
    let waveform: OscillatorType = 'sine';
    let tempoMultiplier = 1.0;
    let baseFrequency = 440;
    let scale = scalePresets['major'];

    const len = text.length;
    if (/[!]/.test(text) || /(love|사랑|행복|happy|excited)/i.test(text)) {
      mood = 'Energetic';
      primaryColor = '#f97316';
      secondaryColor = '#ffe4b5';
      waveform = 'sawtooth';
      tempoMultiplier = 1.4;
      baseFrequency = 480;
      scale = scalePresets['major'];
    } else if (/(밤|night|별|star|dream|꿈)/i.test(text)) {
      mood = 'Dreamy';
      primaryColor = '#6366f1';
      secondaryColor = '#a855f7';
      waveform = 'triangle';
      tempoMultiplier = 0.9;
      baseFrequency = 420;
      scale = scalePresets['dreamy'];
    } else if (/(슬프|sad|lonely|외롭)/i.test(text)) {
      mood = 'Melancholic';
      primaryColor = '#0ea5e9';
      secondaryColor = '#e5e7eb';
      waveform = 'sine';
      tempoMultiplier = 0.8;
      baseFrequency = 400;
      scale = scalePresets['minor'];
    } else if (len > 80) {
      mood = 'Epic';
      primaryColor = '#22c55e';
      secondaryColor = '#bbf7d0';
      waveform = 'square';
      tempoMultiplier = 1.3;
      baseFrequency = 460;
      scale = scalePresets['major'];
    }

    return {
      ...base,
      mood,
      primaryColor,
      secondaryColor,
      waveform,
      tempoMultiplier,
      baseFrequency,
      scale,
    };
  };

  // 수동 선택값으로부터 테마 빌드
  const buildManualTheme = (): ThemeConfig => {
    const base: ThemeConfig = { ...DEFAULT_THEME };
    const mood = selectedMood || base.mood;
    const waveform = (selectedWaveform || base.waveform) as OscillatorType;
    const baseFrequency =
      typeof selectedBaseFreq === 'number' && selectedBaseFreq > 50
        ? selectedBaseFreq
        : base.baseFrequency;
    const tempoMultiplier =
      typeof selectedTempo === 'number' && selectedTempo > 0.2
        ? selectedTempo
        : base.tempoMultiplier;

    let scale = base.scale;
    if (selectedScale && scalePresets[selectedScale]) {
      scale = scalePresets[selectedScale];
    }

    return {
      ...base,
      mood,
      waveform,
      baseFrequency,
      tempoMultiplier,
      scale,
    };
  };

  // Initialize events when text changes (preview mode)
  useEffect(() => {
    const previewText = inputText || 'HELLO';
    const effectiveTheme = isAutoTheme ? buildAutoTheme(previewText) : buildManualTheme();
    setTheme(effectiveTheme);
    const timeline = audioEngineRef.current.generateTimeline(previewText, effectiveTheme);
    setEvents(timeline);
    if (timeline.length > 0) {
      const last = timeline[timeline.length - 1];
      totalDurationRef.current = last.startTime + last.duration;
    } else {
      totalDurationRef.current = 0;
    }
  }, [inputText, isAutoTheme, selectedMood, selectedWaveform, selectedBaseFreq, selectedTempo, selectedScale]);

  const handlePlay = async () => {
    if (isPlaying) {
      audioEngineRef.current.stop();
      setIsPlaying(false);
      return;
    }

    if (!inputText.trim()) return;

    // 1. 테마 결정 (자동 / 수동)
    const currentTheme = isAutoTheme ? buildAutoTheme(inputText) : buildManualTheme();
    setTheme(currentTheme);

    // 2. Generate Audio Timeline
    const timeline = audioEngineRef.current.generateTimeline(inputText, currentTheme);
    setEvents(timeline);
    if (timeline.length > 0) {
      const last = timeline[timeline.length - 1];
      totalDurationRef.current = last.startTime + last.duration;
    } else {
      totalDurationRef.current = 0;
    }

    // 3. Play
    setIsPlaying(true);
    
    // Hack: We need to capture the audioContext from the engine for the visualizer
    // We start playing, then grab the context time.
    audioEngineRef.current.play(currentTheme, () => {
      setIsPlaying(false);
    });
    
    // Allow engine to init context first
    setTimeout(() => {
        // @ts-ignore - Accessing private property for visualizer sync hack
        const ctx = (audioEngineRef.current as any).audioCtx; 
        audioCtxRef.current = ctx;
        startTimeRef.current = ctx ? ctx.currentTime : 0;
    }, 50);
  };

  // 재생 중에 어떤 부분까지 왔는지 0~1 진척도를 계산
  useEffect(() => {
    let frameId: number;

    const update = () => {
      if (!isPlaying || !audioCtxRef.current) {
        setPlaybackProgress(0);
        return;
      }
      const rel = audioCtxRef.current.currentTime - startTimeRef.current;
      const total = totalDurationRef.current || 0.0001;
      const p = Math.min(Math.max(rel / total, 0), 1);
      setPlaybackProgress(p);
      frameId = requestAnimationFrame(update);
    };

    if (isPlaying) {
      frameId = requestAnimationFrame(update);
    } else {
      setPlaybackProgress(0);
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [isPlaying]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center relative overflow-hidden font-sans text-slate-200">
      <CursorTrail />
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/20 blur-[100px]"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-900/20 blur-[100px]"></div>
      </div>

      {/* Header */}
      <header className="w-full p-6 flex items-center justify-between border-b border-white/5 bg-slate-900/30 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <Sparkles className="text-sky-400 fill-sky-400/20" size={20} />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 font-mono tracking-wider">
            MORSE MELODY AI
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
           <span className="hidden md:inline px-3 py-1 rounded-full bg-white/5 border border-white/10">English / Hangul / Numbers</span>
        </div>
      </header>

      {/* Visualizer Area - Full width with cinematic feel */}
      <div className="w-full relative z-10 border-b border-white/10">
        <Visualizer 
            isPlaying={isPlaying} 
            events={events} 
            theme={theme}
            audioCtxRef={audioCtxRef}
            startTimeRef={startTimeRef}
        />
        
        {/* Status Overlay - Floating Glass */}
        <div className="absolute top-6 left-6 pointer-events-none">
          <div
            className={`transition-all duration-700 transform ${
              isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
            }`}
          >
            <div className="backdrop-blur-sm bg-black/40 p-4 rounded-xl border border-white/10 shadow-2xl">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-widest">
                  {isAutoTheme ? 'Auto Mood' : 'Custom Mood'}
                </span>
                <span
                  className="text-3xl font-bold tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]"
                  style={{ color: theme.primaryColor }}
                >
                  {theme.mood}
                </span>
                <div className="flex gap-2 text-[10px] text-slate-400 font-mono mt-2 uppercase tracking-wide">
                  <span className="bg-white/10 px-2 py-1 rounded">{theme.waveform}</span>
                  <span className="bg-white/10 px-2 py-1 rounded">{theme.baseFrequency}Hz</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <main className="w-full max-w-3xl px-6 py-10 flex flex-col gap-8 flex-grow z-10">
        {/* Text Input */}
        <div className="relative group">
          <div
            className={`absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-purple-600 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 ${
              isPlaying ? 'animate-pulse opacity-60' : ''
            }`}
          ></div>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Write something... Your words will become music.\n(Try: 'I love you' or '오늘 밤하늘이 참 아름답네요')`}
            className="relative w-full h-40 bg-slate-900/80 backdrop-blur-xl text-white p-6 rounded-2xl focus:outline-none resize-none shadow-[0_0_40px_rgba(56,189,248,0.35)] border border-white/10 placeholder-slate-400 text-lg leading-relaxed tracking-wide"
            style={{ fontFamily: `'Noto Sans KR', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` }}
            disabled={isPlaying}
          />
        </div>

        {/* Theme Controls */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-slate-300">
          <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <span className="uppercase tracking-widest text-[10px] text-slate-400">
                Theme Mode
              </span>
              <button
                onClick={() => setIsAutoTheme(!isAutoTheme)}
                className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition"
              >
                {isAutoTheme ? '자동 (텍스트 기반)' : '수동 선택'}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              자동 모드는 텍스트 안의 키워드와 길이를 보고 분위기를 추정합니다.
              수동 모드에서는 아래에서 직접 무드/파형/속도/스케일을 고를 수 있어요.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col gap-2">
            <span className="uppercase tracking-widest text-[10px] text-slate-400 mb-1">
              Quick Presets
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 hover:bg-sky-500/30 text-[11px]"
                onClick={() => {
                  setSelectedMood('Dreamy');
                  setSelectedWaveform('triangle');
                  setSelectedScale('dreamy');
                  setSelectedTempo(0.9);
                  setSelectedBaseFreq(420);
                  setIsAutoTheme(false);
                }}
              >
                Dreamy Night
              </button>
              <button
                className="px-3 py-1 rounded-full bg-orange-500/20 border border-orange-400/40 hover:bg-orange-500/30 text-[11px]"
                onClick={() => {
                  setSelectedMood('Energetic');
                  setSelectedWaveform('sawtooth');
                  setSelectedScale('major');
                  setSelectedTempo(1.4);
                  setSelectedBaseFreq(480);
                  setIsAutoTheme(false);
                }}
              >
                Energetic Day
              </button>
              <button
                className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-[11px]"
                onClick={() => {
                  setSelectedMood('Melancholic');
                  setSelectedWaveform('sine');
                  setSelectedScale('minor');
                  setSelectedTempo(0.8);
                  setSelectedBaseFreq(400);
                  setIsAutoTheme(false);
                }}
              >
                Soft Melancholy
              </button>
            </div>
          </div>

          {!isAutoTheme && (
            <>
              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1">
                    Mood (text)
                  </label>
                  <input
                    type="text"
                    value={selectedMood}
                    onChange={(e) => setSelectedMood(e.target.value)}
                    placeholder="예: Dreamy, Energetic, Melancholic..."
                    className="w-full bg-slate-950/60 border border-white/10 rounded-md px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1">
                    Waveform
                  </label>
                  <select
                    value={selectedWaveform}
                    onChange={(e) =>
                      setSelectedWaveform(e.target.value as OscillatorType | '')
                    }
                    className="w-full bg-slate-950/60 border border-white/10 rounded-md px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">기본 (sine)</option>
                    <option value="sine">sine</option>
                    <option value="triangle">triangle</option>
                    <option value="square">square</option>
                    <option value="sawtooth">sawtooth</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1">
                    Tempo
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={typeof selectedTempo === 'number' ? selectedTempo : 1}
                    onChange={(e) => setSelectedTempo(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="text-[11px] text-slate-400 mt-1">
                    {typeof selectedTempo === 'number'
                      ? `${selectedTempo.toFixed(2)}x`
                      : '1.00x (기본 속도)'}
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1">
                    Base Frequency (Hz)
                  </label>
                  <input
                    type="number"
                    min={200}
                    max={600}
                    value={typeof selectedBaseFreq === 'number' ? selectedBaseFreq : 440}
                    onChange={(e) =>
                      setSelectedBaseFreq(
                        e.target.value ? parseInt(e.target.value, 10) : ''
                      )
                    }
                    className="w-full bg-slate-950/60 border border-white/10 rounded-md px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 backdrop-blur-md flex flex-col gap-3 md:col-span-2">
                <div>
                  <label className="block text-[11px] uppercase tracking-widest text-slate-400 mb-1">
                    Scale
                  </label>
                  <select
                    value={selectedScale}
                    onChange={(e) => setSelectedScale(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-md px-2 py-1 text-[12px] focus:outline-none focus:ring-1 focus:ring-sky-500 md:w-64"
                  >
                    <option value="">기본 (Major Pentatonic)</option>
                    <option value="major">Major Pentatonic</option>
                    <option value="minor">Minor Pentatonic</option>
                    <option value="dreamy">Dreamy</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  스케일은 어떤 음들로 멜로디를 만들지 결정해요. Major는 밝고, Minor는 조금 더 서정적이고,
                  Dreamy/Dark는 실험적인 느낌을 줍니다.
                </p>
              </div>
            </>
          )}
        </section>

        <div className="flex justify-center">
          <button
            onClick={handlePlay}
            className={`
                relative px-10 py-5 rounded-full font-bold text-lg flex items-center gap-3 transition-all transform hover:scale-105 active:scale-95 border
                ${isPlaying 
                    ? 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20 backdrop-blur-md' 
                    : 'bg-white text-slate-900 border-white hover:bg-sky-50 shadow-[0_0_30px_rgba(56,189,248,0.4)]'
                }
            `}
          >
             {isPlaying ? (
                <>
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span>Stop Playback</span>
                </>
             ) : (
                <>
                    <Music className="w-5 h-5" />
                    <span>Generate Music</span>
                </>
             )}
          </button>
        </div>

        {/* How it works - Minimal */}
        <div className="mt-4 flex justify-center opacity-60 hover:opacity-100 transition-opacity">
          <p className="text-center text-xs font-mono text-slate-400 max-w-md leading-loose">
            Your text is converted into Morse code rhythm and played as a melodic sequence with ambient accompaniment and reactive visuals. No external AI or API is used.
          </p>
        </div>

      </main>
    </div>
  );
};

export default App;
