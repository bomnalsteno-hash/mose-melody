import React, { useState, useRef, useEffect } from 'react';
import { AudioEngine } from './services/audioEngine';
import Visualizer from './components/Visualizer';
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 미리 정의된 스케일 프리셋
  const scalePresets: Record<string, number[]> = {
    'major': [0, 2, 4, 7, 9],
    'minor': [0, 3, 5, 7, 10],
    'dreamy': [0, 2, 5, 9, 11],
    'dark': [0, 1, 4, 6, 10],
    'serene': [0, 2, 5, 7, 9],
    'gentle': [0, 3, 5, 8, 10],
    'cozy': [0, 2, 4, 6, 9],
    'peaceful': [0, 3, 6, 8, 11],
    'tranquil': [0, 2, 4, 7, 10],
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

  // 비제어 입력과 동기화: ref 값을 state에 반영 (프리뷰용)
  const syncInputToState = () => {
    const v = inputRef.current?.value ?? '';
    setInputText(v);
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

    const text = (inputRef.current?.value ?? inputText).trim();
    if (!text) return;

    // 1. 테마 결정 (자동 / 수동)
    const currentTheme = isAutoTheme ? buildAutoTheme(text) : buildManualTheme();
    setTheme(currentTheme);

    // 2. Generate Audio Timeline
    const timeline = audioEngineRef.current.generateTimeline(text, currentTheme);
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

  // 공통 컨트롤 컴포넌트 (모바일/데스크톱 공유)
  const ControlsContent = () => (
    <>
      {/* 텍스트 입력 - 비제어(한글 IME 정상 동작) + blur/compositionEnd에서만 state 동기화 */}
      <div className="relative group">
        <div
          className={`absolute -inset-0.5 bg-gradient-to-r from-sky-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 ${
            isPlaying ? 'animate-pulse opacity-60' : ''
          }`}
        ></div>
        <textarea
          ref={inputRef}
          defaultValue=""
          onBlur={syncInputToState}
          onCompositionEnd={(e) => setInputText(e.currentTarget.value)}
          onInput={() => requestAnimationFrame(syncInputToState)}
          placeholder="Write something..."
          rows={2}
          className="relative w-full h-14 md:h-16 py-2 px-3 rounded-lg bg-slate-900/80 backdrop-blur-xl text-white focus:outline-none resize-none shadow-[0_0_40px_rgba(56,189,248,0.35)] border border-white/10 placeholder-slate-400 text-sm leading-snug tracking-wide"
          style={{ fontFamily: `'Noto Sans KR', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` }}
          disabled={isPlaying}
        />
      </div>

      {/* 프리셋 버튼만 (라벨 없음) */}
      <section className="text-xs font-mono text-slate-300">
        <div className="bg-slate-900/70 border border-white/10 rounded-lg md:rounded-xl p-3 md:p-4 backdrop-blur-md">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            <button
              className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-sky-500/20 border border-sky-400/40 hover:bg-sky-500/30 text-[9px] md:text-[11px]"
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
              className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 hover:bg-emerald-500/30 text-[9px] md:text-[11px]"
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
            <button
              className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 text-[9px] md:text-[11px]"
              onClick={() => {
                setSelectedMood('Serene');
                setSelectedWaveform('sine');
                setSelectedScale('serene');
                setSelectedTempo(0.85);
                setSelectedBaseFreq(440);
                setIsAutoTheme(false);
              }}
            >
              Serene Morning
            </button>
            <button
              className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-cyan-500/20 border border-cyan-400/40 hover:bg-cyan-500/30 text-[9px] md:text-[11px]"
              onClick={() => {
                setSelectedMood('Gentle');
                setSelectedWaveform('triangle');
                setSelectedScale('gentle');
                setSelectedTempo(0.75);
                setSelectedBaseFreq(380);
                setIsAutoTheme(false);
              }}
            >
              Gentle Rain
            </button>
            <button
              className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-rose-500/20 border border-rose-400/40 hover:bg-rose-500/30 text-[9px] md:text-[11px]"
              onClick={() => {
                setSelectedMood('Cozy');
                setSelectedWaveform('sine');
                setSelectedScale('cozy');
                setSelectedTempo(0.9);
                setSelectedBaseFreq(410);
                setIsAutoTheme(false);
              }}
            >
              Cozy Evening
            </button>
            <button
              className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 hover:bg-indigo-500/30 text-[9px] md:text-[11px]"
              onClick={() => {
                setSelectedMood('Peaceful');
                setSelectedWaveform('triangle');
                setSelectedScale('peaceful');
                setSelectedTempo(0.7);
                setSelectedBaseFreq(360);
                setIsAutoTheme(false);
              }}
            >
              Peaceful Night
            </button>
            <button
              className="px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-teal-500/20 border border-teal-400/40 hover:bg-teal-500/30 text-[9px] md:text-[11px]"
              onClick={() => {
                setSelectedMood('Tranquil');
                setSelectedWaveform('sine');
                setSelectedScale('tranquil');
                setSelectedTempo(0.82);
                setSelectedBaseFreq(430);
                setIsAutoTheme(false);
              }}
            >
              Tranquil Forest
            </button>
          </div>
        </div>
      </section>

      <div className="flex justify-center">
        <button
          onClick={handlePlay}
          className={`
              relative px-6 md:px-10 py-3 md:py-5 rounded-full font-bold text-sm md:text-lg flex items-center gap-2 md:gap-3 transition-all transform hover:scale-105 active:scale-95 border
              ${isPlaying 
                  ? 'bg-red-500/10 text-red-300 border-red-500/30 hover:bg-red-500/20 backdrop-blur-md' 
                  : 'bg-white text-slate-900 border-white hover:bg-sky-50 shadow-[0_0_30px_rgba(56,189,248,0.4)]'
              }
          `}
        >
           {isPlaying ? (
              <>
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  <span>Stop</span>
              </>
           ) : (
              <>
                  <Music className="w-4 md:w-5 h-4 md:h-5" />
                  <span>Generate Music</span>
              </>
           )}
        </button>
      </div>

      {/* How it works - Minimal */}
      <div className="mt-2 md:mt-4 flex justify-center opacity-60 hover:opacity-100 transition-opacity">
        <p className="text-center text-[10px] md:text-xs font-mono text-slate-400 max-w-md leading-relaxed md:leading-loose px-2">
          Your text is converted into Morse code rhythm and played as a melodic sequence with ambient accompaniment and reactive visuals. No external AI or API is used.
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col relative font-sans text-slate-200">
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-900/20 blur-[100px]"></div>
          <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-900/20 blur-[100px]"></div>
      </div>

      {/* 단일 레이아웃: 입력창이 하나만 있어야 입력이 정상 동작 */}
      <div className="flex flex-col h-[100dvh] lg:h-screen overflow-hidden">
        {/* 모바일: 헤더 + 비주얼라이저 / 데스크톱: 비주얼라이저만 이 블록에 */}
        <div className="lg:hidden flex-none">
          <header className="w-full p-3 flex items-center justify-between bg-slate-900/30 backdrop-blur-md z-20">
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles className="text-sky-400 fill-sky-400/20 flex-shrink-0" size={16} />
              <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 font-mono tracking-wider truncate">
                MORSE MELODY
              </h1>
            </div>
          </header>
        </div>

        <div className="relative w-full flex-none h-[40dvh] min-h-[280px] lg:fixed lg:inset-0 lg:h-full lg:min-h-0 z-10">
          <Visualizer 
              isPlaying={isPlaying} 
              events={events} 
              theme={theme}
              audioCtxRef={audioCtxRef}
              startTimeRef={startTimeRef}
          />
          {/* Status Overlay - 모바일 */}
          <div className="lg:hidden absolute top-3 left-3 pointer-events-none z-10">
            <div className={`transition-all duration-700 transform ${isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
              <div className="backdrop-blur-sm bg-black/40 p-2 rounded-lg border border-white/10 shadow-2xl">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-mono uppercase text-slate-400 tracking-widest">{isAutoTheme ? 'Auto Mood' : 'Custom Mood'}</span>
                  <span className="text-lg font-bold tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" style={{ color: theme.primaryColor }}>{theme.mood}</span>
                  <div className="flex gap-1 text-[8px] text-slate-400 font-mono mt-1 uppercase tracking-wide">
                    <span className="bg-white/10 px-1.5 py-0.5 rounded">{theme.waveform}</span>
                    <span className="bg-white/10 px-1.5 py-0.5 rounded">{theme.baseFrequency}Hz</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 데스크톱: 헤더 오버레이 */}
        <header className="hidden lg:flex absolute top-0 left-0 w-full p-6 items-center justify-between bg-slate-900/30 backdrop-blur-md z-20 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Sparkles className="text-sky-400 fill-sky-400/20" size={20} />
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-300 via-purple-300 to-pink-300 font-mono tracking-wider">MORSE MELODY</h1>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">English / Hangul / Numbers</span>
          </div>
        </header>
        {/* 데스크톱: Status Overlay */}
        <div className="hidden lg:block absolute top-20 left-6 pointer-events-none z-10">
          <div className={`transition-all duration-700 transform ${isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="backdrop-blur-sm bg-black/40 p-4 rounded-xl border border-white/10 shadow-2xl">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-widest">{isAutoTheme ? 'Auto Mood' : 'Custom Mood'}</span>
                <span className="text-3xl font-bold tracking-tight drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]" style={{ color: theme.primaryColor }}>{theme.mood}</span>
                <div className="flex gap-2 text-[10px] text-slate-400 font-mono mt-2 uppercase tracking-wide">
                  <span className="bg-white/10 px-2 py-1 rounded">{theme.waveform}</span>
                  <span className="bg-white/10 px-2 py-1 rounded">{theme.baseFrequency}Hz</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 메인 패널 단 하나: 모바일은 flex-1 스크롤, 데스크톱은 fixed 하단 */}
        <main className="flex-1 min-h-0 w-full overflow-y-auto lg:flex-none lg:fixed lg:bottom-0 lg:left-0 lg:right-0 lg:max-h-[60vh] lg:min-h-0 z-30 bg-gradient-to-b from-transparent to-slate-900/95 lg:bg-gradient-to-t lg:from-slate-900/95 lg:via-slate-900/90 lg:to-transparent backdrop-blur-xl">
          <div className="w-full max-w-3xl mx-auto px-4 py-4 pb-10 lg:px-6 lg:py-10 flex flex-col gap-4 lg:gap-8">
            <ControlsContent />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
