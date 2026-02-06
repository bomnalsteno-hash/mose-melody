import { MorseSymbol, PlaybackEvent, ThemeConfig } from '../types';
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
  
  // Timing constants (in seconds)
  private readonly DOT_TIME = 0.08; 

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
      // 반주(패드)는 멜로디보다 한참 작게
      this.padGain.gain.value = 0.18;

      // Delay Effect (Echo)
      this.delayNode = this.audioCtx.createDelay();
      this.delayNode.delayTime.value = 0.35; // 350ms delay
      this.feedbackGain = this.audioCtx.createGain();
      this.feedbackGain.gain.value = 0.4; // 40% feedback

      // Routing: Melody -> Delay -> Feedback -> Delay
      //          Melody -> Master
      //          Delay -> Master
      this.melodyGain.connect(this.delayNode);
      this.delayNode.connect(this.feedbackGain);
      this.feedbackGain.connect(this.delayNode);
      
      this.melodyGain.connect(this.masterGain);
      this.delayNode.connect(this.masterGain);
      
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

    const baseFreq = theme.baseFrequency / 2; // Lower octave for bass/pad

    // 테마 스케일 기반으로 코드 톤을 뽑아서 매 재생마다 약간씩 다른 느낌
    const scale = theme.scale && theme.scale.length > 0 ? theme.scale : [0, 4, 7];
    const pickIndex = () => Math.floor(Math.random() * scale.length);
    const idx1 = pickIndex();
    const idx2 = (idx1 + 1) % scale.length;
    const idx3 = (idx1 + 2) % scale.length;

    const offsets = [scale[idx1] - 12, scale[idx2] - 12, scale[idx3] - 12];
    const freqs = offsets.map(semitone => baseFreq * Math.pow(2, semitone / 12));

    const now = this.audioCtx.currentTime;

    // Filter to make it warm and soft
    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    // 느린 곡일수록 조금 더 어둡게
    const baseCutoff = 700;
    const tempoFactor = Math.min(Math.max(theme.tempoMultiplier, 0.5), 2);
    filter.frequency.setValueAtTime(baseCutoff * tempoFactor, now);
    filter.Q.value = 0.5;
    filter.connect(this.padGain);

    freqs.forEach(f => {
      const osc = this.audioCtx!.createOscillator();
      // 테마 파형을 그대로 쓰되, 너무 공격적인 square는 약간 부드럽게
      osc.type = theme.waveform === 'square' ? 'sawtooth' : theme.waveform;
      osc.frequency.value = f;
      osc.connect(filter);
      osc.start(now);
      this.padOscillators.push(osc);
    });

    // Fade in (더 작게 올라오도록)
    this.padGain.gain.setValueAtTime(0, now);
    this.padGain.gain.linearRampToValueAtTime(0.14, now + 2.0);
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

    // Helper to get frequency from scale based on char code
    const getFrequency = (char: string) => {
        const charCode = char.charCodeAt(0);
        const scaleIndex = charCode % theme.scale.length;
        const semitoneOffset = theme.scale[scaleIndex];
        // fn = f0 * (a)^n where a is 2^(1/12)
        return theme.baseFrequency * Math.pow(2, semitoneOffset / 12);
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
                        duration: unitTime * 3,
                        symbol: MorseSymbol.DASH,
                        frequency: freq,
                        char: char
                    });
                    currentTime += unitTime * 3; // Note on
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

  public async play(theme: ThemeConfig, onComplete: () => void) {
    this.initContext();
    if (!this.audioCtx || !this.melodyGain) return;

    this.isPlaying = true;
    const startTime = this.audioCtx.currentTime + 0.1; // Scheduling delay

    // Start Ambient Drone
    this.startDrone(theme);

    this.events.forEach(event => {
      if (event.type === 'note' && event.frequency) {
        const osc = this.audioCtx!.createOscillator();
        const gain = this.audioCtx!.createGain();
        
        osc.type = theme.waveform;
        osc.frequency.value = event.frequency;
        
        // Envelope to avoid clicking
        const attack = 0.02;
        const release = 0.1; // Slightly longer release for dreamy feel
        
        osc.connect(gain);
        gain.connect(this.melodyGain!);
        
        const noteStart = startTime + event.startTime;
        const noteEnd = noteStart + event.duration;

        osc.start(noteStart);
        
        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.7, noteStart + attack);
        gain.gain.setValueAtTime(0.7, noteEnd - release);
        gain.gain.linearRampToValueAtTime(0, noteEnd);
        
        osc.stop(noteEnd + 0.1); // Allow tail
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
