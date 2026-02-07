import { MorseSymbol, PlaybackEvent, ThemeConfig, InstrumentType } from '../types';
import { textToMorse } from '../utils/morseMapping';

export class AudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private melodyGain: GainNode | null = null;
  private padGain: GainNode | null = null;
  
  // Effects
  private delayNode: DelayNode | null = null;
  private feedbackGain: GainNode | null = null;

  // Drone Oscillators
  private padOscillators: OscillatorNode[] = [];

  private events: PlaybackEvent[] = [];
  private isPlaying: boolean = false;
  private timerID: number | null = null;
  
  // Timing constants (in seconds) — 전체 템포 아주 조금 빠르게
  private readonly DOT_TIME = 0.14; 

  constructor() {}

  private initContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Master Gain
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.audioCtx.destination);

      // Bus for Melody
      this.melodyGain = this.audioCtx.createGain();
      this.melodyGain.gain.value = 0.5;

      // Bus for Pad (Accompaniment)
      this.padGain = this.audioCtx.createGain();
      this.padGain.gain.value = 0.1;

      // 멜로디는 에코 없이 직통만 → 두 번 들리는 현상 제거, 모스가 정확히 들리도록
      this.melodyGain.connect(this.masterGain);
      
      // Pad Routing
      this.padGain.connect(this.masterGain);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Generate a rich ambient drone based on the theme
  private startDrone(theme: ThemeConfig) {
    if (!this.audioCtx || !this.padGain) return;

    // Stop existing pads if any
    this.stopDrone();

    const baseFreq = theme.baseFrequency / 2;

    const scale = theme.scale && theme.scale.length > 0 ? theme.scale : [0, 4, 7];
    const pickIndex = () => Math.floor(Math.random() * scale.length);
    const idx1 = pickIndex();
    const idx2 = (idx1 + 1) % scale.length;
    const idx3 = (idx1 + 2) % scale.length;

    const offsets = [scale[idx1] - 12, scale[idx2] - 12, scale[idx3] - 12];
    const freqs = offsets.map(semitone => baseFreq * Math.pow(2, semitone / 12));

    const now = this.audioCtx.currentTime;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.Q.value = 0.3;
    filter.connect(this.padGain);

    freqs.forEach(f => {
      const osc = this.audioCtx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start(now);
      this.padOscillators.push(osc);
    });

    this.padGain.gain.setValueAtTime(0, now);
    this.padGain.gain.linearRampToValueAtTime(0.08, now + 2.0);
  }

  private stopDrone() {
    if (this.audioCtx && this.padGain) {
         const now = this.audioCtx.currentTime;
         // Fade out
         this.padGain.gain.cancelScheduledValues(now);
         this.padGain.gain.setValueAtTime(this.padGain.gain.value, now);
         this.padGain.gain.linearRampToValueAtTime(0, now + 2.0);
    }

    this.padOscillators.forEach(osc => {
        try {
            osc.stop(this.audioCtx!.currentTime + 2.1);
        } catch(e) {}
    });
    this.padOscillators = [];
  }

  public generateTimeline(text: string, theme: ThemeConfig): PlaybackEvent[] {
    const { morse, decomposed } = textToMorse(text);
    const events: PlaybackEvent[] = [];
    
    const unitTime = this.DOT_TIME / theme.tempoMultiplier;
    let currentTime = 0;

    // Helper to get frequency from scale - 더 다이나믹하게 만들기
    let charIndex = 0;
    let noteSequence = 0; // 음표 순서로 패턴 생성
    const getFrequency = (char: string) => {
        const charCode = char.charCodeAt(0);
        const pos = charIndex++;
        noteSequence++;
        
        // 여러 요소를 조합한 해시로 더 복잡한 패턴
        const hash1 = (charCode * 17 + pos * 31) % 1000;
        const hash2 = (text.length * 7 + noteSequence * 13) % 1000;
        const combinedHash = (hash1 + hash2) % 1000;
        
        // 스케일 인덱스를 더 다양하게 선택 (위치 기반 + 해시 기반)
        const baseIndex = pos % theme.scale.length;
        const hashIndex = combinedHash % theme.scale.length;
        const scaleIndex = (baseIndex + hashIndex) % theme.scale.length;
        const semitoneOffset = theme.scale[scaleIndex];
        
        // 옥타브 변화를 더 자주 발생 (약 30% 확률)
        let octaveShift = 0;
        if (combinedHash % 3 === 0) {
          // 위/아래 옥타브 또는 2옥타브 위
          const shiftType = combinedHash % 5;
          if (shiftType === 0) octaveShift = 12;      // 한 옥타브 위
          else if (shiftType === 1) octaveShift = -12; // 한 옥타브 아래
          else if (shiftType === 2) octaveShift = 24;  // 두 옥타브 위 (드물게)
        }
        
        // 추가로 반음 단위 미세 조정 (약 15% 확률로 ±1~3 반음)
        let fineTune = 0;
        if (combinedHash % 7 === 0) {
          fineTune = ((combinedHash % 7) - 3); // -3 ~ +3 반음
        }
        
        // fn = f0 * (a)^n where a is 2^(1/12)
        return theme.baseFrequency * Math.pow(2, (semitoneOffset + octaveShift + fineTune) / 12);
    };

    // Reconstruct simplified flow
    decomposed.forEach(char => {
        if (char === ' ') {
             // Word space (7 units)
             events.push({
                type: 'silence',
                startTime: currentTime,
                duration: unitTime * 7,
                symbol: MorseSymbol.WORD_SPACE
            });
            currentTime += unitTime * 7;
        } else {
            // Get morse code for this char
            const res = textToMorse(char); 
            const code = res.morse.trim();
            const freq = getFrequency(char);

            for (let i = 0; i < code.length; i++) {
                const symbol = code[i];
                if (symbol === '.') {
                    events.push({
                        type: 'note',
                        startTime: currentTime,
                        duration: unitTime,
                        symbol: MorseSymbol.DOT,
                        frequency: freq,
                        char: char
                    });
                    currentTime += unitTime; // Note on
                } else if (symbol === '-') {
                    events.push({
                        type: 'note',
                        startTime: currentTime,
                        duration: unitTime * 4,
                        symbol: MorseSymbol.DASH,
                        frequency: freq,
                        char: char
                    });
                    currentTime += unitTime * 4; // Note on
                }

                // Inter-element gap (1 unit)
                if (i < code.length - 1) {
                    events.push({
                        type: 'silence',
                        startTime: currentTime,
                        duration: unitTime,
                        symbol: null
                    });
                    currentTime += unitTime;
                }
            }
            
            // Inter-character gap (3 units)
            events.push({
                type: 'silence',
                startTime: currentTime,
                duration: unitTime * 3,
                symbol: MorseSymbol.SPACE
            });
            currentTime += unitTime * 3;
        }
    });

    // Add padding at end
    events.push({
        type: 'silence',
        startTime: currentTime,
        duration: 2.0,
        symbol: null
    });

    this.events = events;
    return events;
  }

  private playNoteWithInstrument(
    ctx: AudioContext,
    theme: ThemeConfig,
    event: PlaybackEvent & { type: 'note'; frequency: number },
    startTime: number,
    instrument: InstrumentType
  ) {
    const gain = ctx.createGain();
    gain.connect(this.melodyGain!);
    const noteStart = startTime + event.startTime;
    const noteEnd = noteStart + event.duration;
    const freq = event.frequency;

    if (instrument === 'piano') {
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.value = freq;
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2;
      const harmGain = ctx.createGain();
      harmGain.gain.value = 0.25;
      osc1.connect(gain);
      osc2.connect(harmGain);
      harmGain.connect(gain);
      const attack = 0.008;
      const decay = Math.min(event.duration * 0.4, 0.15);
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.6, noteStart + attack);
      gain.gain.linearRampToValueAtTime(0.2, noteStart + attack + decay);
      gain.gain.linearRampToValueAtTime(0, noteEnd);
      osc1.start(noteStart);
      osc2.start(noteStart);
      osc1.stop(noteEnd + 0.05);
      osc2.stop(noteEnd + 0.05);
      return;
    }

    if (instrument === 'marimba') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      const attack = 0.03;
      const release = Math.min(event.duration * 1.2, 0.25);
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.65, noteStart + attack);
      gain.gain.setValueAtTime(0.5, noteEnd - release);
      gain.gain.linearRampToValueAtTime(0, noteEnd);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.1);
      return;
    }

    if (instrument === 'violin') {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2000;
      filter.Q.value = 0.5;
      osc.connect(filter);
      filter.connect(gain);
      const attack = 0.05;
      const release = 0.08;
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.4, noteStart + attack);
      gain.gain.setValueAtTime(0.35, noteEnd - release);
      gain.gain.linearRampToValueAtTime(0, noteEnd);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.1);
      return;
    }

    if (instrument === 'chime') {
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2.5;
      const harmGain = ctx.createGain();
      harmGain.gain.value = 0.12;
      osc1.connect(gain);
      osc2.connect(harmGain);
      harmGain.connect(gain);
      const attack = 0.012;
      const release = Math.min(event.duration * 0.5, 0.2);
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.55, noteStart + attack);
      gain.gain.setValueAtTime(0.5, noteEnd - release);
      gain.gain.linearRampToValueAtTime(0, noteEnd);
      osc1.start(noteStart);
      osc2.start(noteStart);
      osc1.stop(noteEnd + 0.05);
      osc2.stop(noteEnd + 0.05);
      return;
    }

    // sine / default: 기존 단일 오실레이터
    const osc = ctx.createOscillator();
    osc.type = theme.waveform;
    osc.frequency.value = freq;
    osc.connect(gain);
    const attack = 0.02;
    const release = 0.1;
    gain.gain.setValueAtTime(0, noteStart);
    gain.gain.linearRampToValueAtTime(0.7, noteStart + attack);
    gain.gain.setValueAtTime(0.7, noteEnd - release);
    gain.gain.linearRampToValueAtTime(0, noteEnd);
    osc.start(noteStart);
    osc.stop(noteEnd + 0.1);
  }

  public async play(theme: ThemeConfig, onComplete: () => void) {
    this.initContext();
    if (!this.audioCtx || !this.melodyGain) return;

    this.isPlaying = true;
    const startTime = this.audioCtx.currentTime + 0.1; // Scheduling delay

    // Start Ambient Drone
    this.startDrone(theme);

    const instrument: InstrumentType = theme.instrument ?? 'sine';
    this.events.forEach(event => {
      if (event.type === 'note' && event.frequency) {
        this.playNoteWithInstrument(this.audioCtx!, theme, event, startTime, instrument);
      }
    });

    // Determine total duration
    const lastEvent = this.events[this.events.length - 1];
    const totalDuration = lastEvent ? lastEvent.startTime + lastEvent.duration : 0;
    
    // Set timer for cleanup
    this.timerID = window.setTimeout(() => {
        this.stopDrone();
        // Give time for drone fade out (2s)
        setTimeout(() => {
            this.stop();
            onComplete();
        }, 2000);
    }, (totalDuration + 0.5) * 1000);
  }

  public stop() {
    this.isPlaying = false;
    this.stopDrone();
    
    if (this.audioCtx) {
        this.audioCtx.suspend();
        this.audioCtx.close().then(() => {
            this.audioCtx = null;
        });
    }
    if (this.timerID) {
        clearTimeout(this.timerID);
        this.timerID = null;
    }
  }

  public getCurrentTime(): number {
    return this.audioCtx ? this.audioCtx.currentTime : 0;
  }
  
  public getRelTime(startedAt: number): number {
      if (!this.audioCtx) return 0;
      return this.audioCtx.currentTime - startedAt;
  }
}
