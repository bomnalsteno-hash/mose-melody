import { MorseSymbol } from '../types';

const MORSE_MAP: Record<string, string> = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..',
  '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.', '0': '-----',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
  // Hangul Jamos (Standard Korean Morse)
  'ㄱ': '.-..', 'ㄴ': '..-.', 'ㄷ': '-...', 'ㄹ': '...-', 'ㅁ': '--',
  'ㅂ': '.--', 'ㅅ': '--.', 'ㅇ': '-.-', 'ㅈ': '.--.', 'ㅊ': '-.-.',
  'ㅋ': '-..-', 'ㅌ': '--..', 'ㅍ': '---', 'ㅎ': '.---',
  'ㅏ': '.', 'ㅑ': '..', 'ㅓ': '-', 'ㅕ': '...', 'ㅗ': '.-',
  'ㅛ': '-.', 'ㅜ': '....', 'ㅠ': '.-.', 'ㅡ': '-..', 'ㅣ': '..-',
  'ㅐ': '--.-', 'ㅔ': '-.--'
};

// Helper to decompose Hangul Syllables into Jamos
function decomposeHangul(char: string): string[] {
  const code = char.charCodeAt(0);
  // Hangul Syllables range: AC00 (44032) - D7A3 (55203)
  if (code < 0xAC00 || code > 0xD7A3) {
    return [char];
  }
  
  const offset = code - 0xAC00;
  const initial = Math.floor(offset / 588);
  const medial = Math.floor((offset % 588) / 28);
  const final = offset % 28;

  const initials = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const medials = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const finals = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  // Map complex Jamos to simple ones if they don't exist in standard Morse directly, 
  // or return the components.
  // Note: Korean Morse has specific codes for some combined vowels, but standard decomposition works for basic transmission.
  // We will map to the closest standard keys found in MORSE_MAP.
  
  const result: string[] = [];
  
  // Initial
  let iChar = initials[initial];
  // Simple mapping for double consonants (use single for simplicity in morse or map specific if exists)
  if (iChar === 'ㄲ') result.push('ㄱ', 'ㄱ');
  else if (iChar === 'ㄸ') result.push('ㄷ', 'ㄷ');
  else if (iChar === 'ㅃ') result.push('ㅂ', 'ㅂ');
  else if (iChar === 'ㅆ') result.push('ㅅ', 'ㅅ');
  else if (iChar === 'ㅉ') result.push('ㅈ', 'ㅈ');
  else result.push(iChar);

  // Medial
  let mChar = medials[medial];
  // Complex vowels are often combinations in Morse or have specific codes. 
  // For this app, we stick to the main map. If not in map, decompose.
  if (MORSE_MAP[mChar]) result.push(mChar);
  else {
      // Very basic decomposition for complex vowels
      if (mChar === 'ㅘ') result.push('ㅗ', 'ㅏ');
      else if (mChar === 'ㅙ') result.push('ㅗ', 'ㅐ');
      else if (mChar === 'ㅚ') result.push('ㅗ', 'ㅣ');
      else if (mChar === 'ㅝ') result.push('ㅜ', 'ㅓ');
      else if (mChar === 'ㅞ') result.push('ㅜ', 'ㅔ');
      else if (mChar === 'ㅟ') result.push('ㅜ', 'ㅣ');
      else if (mChar === 'ㅢ') result.push('ㅡ', 'ㅣ');
      else if (mChar === 'ㅒ') result.push('ㅑ', 'ㅣ'); // Approximate
      else if (mChar === 'ㅖ') result.push('ㅕ', 'ㅣ'); // Approximate
      else result.push(mChar);
  }

  // Final
  if (final !== 0) {
    let fChar = finals[final];
     if (fChar === 'ㄲ') result.push('ㄱ', 'ㄱ');
     else if (fChar === 'ㄳ') result.push('ㄱ', 'ㅅ');
     else if (fChar === 'ㄵ') result.push('ㄴ', 'ㅈ');
     else if (fChar === 'ㄶ') result.push('ㄴ', 'ㅎ');
     else if (fChar === 'ㄺ') result.push('ㄹ', 'ㄱ');
     else if (fChar === 'ㄻ') result.push('ㄹ', 'ㅁ');
     else if (fChar === 'ㄼ') result.push('ㄹ', 'ㅂ');
     else if (fChar === 'ㄽ') result.push('ㄹ', 'ㅅ');
     else if (fChar === 'ㄾ') result.push('ㄹ', 'ㅌ');
     else if (fChar === 'ㄿ') result.push('ㄹ', 'ㅍ');
     else if (fChar === 'ㅀ') result.push('ㄹ', 'ㅎ');
     else if (fChar === 'ㅄ') result.push('ㅂ', 'ㅅ');
     else if (fChar === 'ㅆ') result.push('ㅅ', 'ㅅ');
     else result.push(fChar);
  }

  return result;
}

export function textToMorse(text: string): { original: string, decomposed: string[], morse: string } {
  const upperText = text.toUpperCase();
  let morseCode = "";
  const decomposedChars: string[] = [];

  for (let i = 0; i < upperText.length; i++) {
    const char = upperText[i];
    
    if (char === ' ') {
      morseCode += MorseSymbol.WORD_SPACE + " ";
      decomposedChars.push(' ');
      continue;
    }

    // Check if Hangul
    if (char.match(/[가-힣]/)) {
      const jamos = decomposeHangul(char);
      jamos.forEach(jamo => {
        if (MORSE_MAP[jamo]) {
          morseCode += MORSE_MAP[jamo] + MorseSymbol.SPACE;
          decomposedChars.push(jamo);
        }
      });
      continue;
    }

    if (MORSE_MAP[char]) {
      morseCode += MORSE_MAP[char] + MorseSymbol.SPACE;
      decomposedChars.push(char);
    } else {
        // Unknown chars ignored or treated as space
    }
  }

  return { original: text, decomposed: decomposedChars, morse: morseCode.trim() };
}
