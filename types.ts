export enum MorseSymbol {
  DOT = '.',
  DASH = '-',
  SPACE = ' ', // Space between letters
  WORD_SPACE = '/', // Space between words
}

export interface MorseChar {
  char: string;
  code: string;
}

export interface PlaybackEvent {
  type: 'note' | 'silence';
  startTime: number;
  duration: number;
  symbol: MorseSymbol | null;
  frequency?: number;
  char?: string;
}

export interface ThemeConfig {
  mood: string;
  primaryColor: string; // Hex code for main glow
  secondaryColor: string; // Hex code for particles
  waveform: OscillatorType;
  baseFrequency: number;
  tempoMultiplier: number; // 1.0 is standard (~60ms dot)
  scale: number[]; // Array of frequency ratios or semitone offsets
}

export const DEFAULT_THEME: ThemeConfig = {
  mood: "Neutral",
  primaryColor: "#38bdf8", // Sky blue
  secondaryColor: "#ffffff",
  waveform: "sine",
  baseFrequency: 440,
  tempoMultiplier: 1.0,
  scale: [0, 2, 4, 7, 9] // Major Pentatonic
};
