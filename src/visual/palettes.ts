/**
 * Rich color palette system with diverse themes that cycle automatically
 * Inspired by Winamp's constantly evolving color schemes
 */

export interface ColorPalette {
  id: string;
  name: string;
  colors: [string, string, string, string];
  backgroundColor: string;
}

// 20 diverse palettes ranging from neon to organic to cosmic
export const palettes: ColorPalette[] = [
  // Neon cyberpunk
  { id: 'neon-cyber', name: 'Neon Cyber', colors: ['#FF00FF', '#00FFFF', '#FF0080', '#80FF00'], backgroundColor: '#000000' },
  // Sunset gradient
  { id: 'sunset', name: 'Sunset', colors: ['#FF6B35', '#FF2E63', '#8B2FC9', '#FFB100'], backgroundColor: '#0A0A1A' },
  // Deep ocean
  { id: 'ocean-deep', name: 'Deep Ocean', colors: ['#0077B6', '#00B4D8', '#48CAE4', '#CAF0F8'], backgroundColor: '#03045E' },
  // Emerald forest
  { id: 'emerald', name: 'Emerald', colors: ['#06D6A0', '#118AB2', '#073B4C', '#FFD166'], backgroundColor: '#001219' },
  // Vaporwave
  { id: 'vaporwave', name: 'Vaporwave', colors: ['#FF71CE', '#01CDFE', '#05FFA1', '#B967FF'], backgroundColor: '#1A0033' },
  // Fire and ice
  { id: 'fire-ice', name: 'Fire & Ice', colors: ['#FF4500', '#FF8C00', '#00CED1', '#4169E1'], backgroundColor: '#000011' },
  // Aurora borealis
  { id: 'aurora', name: 'Aurora', colors: ['#00FF87', '#60EFFF', '#9D4EDD', '#FF006E'], backgroundColor: '#000022' },
  // Molten lava
  { id: 'lava', name: 'Molten', colors: ['#FF0000', '#FF6600', '#FFCC00', '#990000'], backgroundColor: '#1A0000' },
  // Cosmic purple
  { id: 'cosmic', name: 'Cosmic', colors: ['#7400B8', '#6930C3', '#5390D9', '#48BFE3'], backgroundColor: '#0A0014' },
  // Electric lime
  { id: 'electric', name: 'Electric', colors: ['#CCFF00', '#00FF66', '#00CCFF', '#FF00CC'], backgroundColor: '#000A00' },
  // Rose gold
  { id: 'rosegold', name: 'Rose Gold', colors: ['#FFB4A2', '#E5989B', '#B5838D', '#FFD700'], backgroundColor: '#1A0A0A' },
  // Arctic
  { id: 'arctic', name: 'Arctic', colors: ['#A8DADC', '#457B9D', '#1D3557', '#F1FAEE'], backgroundColor: '#001122' },
  // Candy
  { id: 'candy', name: 'Candy', colors: ['#FF69B4', '#FF1493', '#DA70D6', '#FF6EC7'], backgroundColor: '#0D001A' },
  // Matrix
  { id: 'matrix', name: 'Matrix', colors: ['#00FF41', '#008F11', '#003B00', '#39FF14'], backgroundColor: '#000800' },
  // Blood moon
  { id: 'bloodmoon', name: 'Blood Moon', colors: ['#8B0000', '#DC143C', '#FF4500', '#2F0000'], backgroundColor: '#0A0000' },
  // Tropical
  { id: 'tropical', name: 'Tropical', colors: ['#FF6B6B', '#FEC89A', '#A7F3D0', '#67E8F9'], backgroundColor: '#001A1A' },
  // Midnight jazz
  { id: 'jazz', name: 'Midnight Jazz', colors: ['#FFD700', '#4169E1', '#191970', '#FF8C00'], backgroundColor: '#000033' },
  // Ultraviolet
  { id: 'ultraviolet', name: 'Ultraviolet', colors: ['#BC00FF', '#7700FF', '#3300FF', '#FF00FF'], backgroundColor: '#0A000A' },
  // Sakura
  { id: 'sakura', name: 'Sakura', colors: ['#FFB7C5', '#FF69B4', '#DB7093', '#FFF0F5'], backgroundColor: '#0D0008' },
  // Thunderstorm
  { id: 'storm', name: 'Thunderstorm', colors: ['#FFFFFF', '#87CEEB', '#4A0080', '#FFD700'], backgroundColor: '#000022' },
];

// Get a palette by index (wraps around)
export function getPalette(index: number): ColorPalette {
  const len = palettes.length;
  return palettes[((index % len) + len) % len];
}

// Get a random palette different from the current
export function getRandomPalette(currentId?: string): ColorPalette {
  let palette: ColorPalette;
  do {
    palette = palettes[Math.floor(Math.random() * palettes.length)];
  } while (palette.id === currentId && palettes.length > 1);
  return palette;
}

// Interpolate between two color arrays (for smooth transitions)
export function lerpColors(
  from: [string, string, string, string],
  to: [string, string, string, string],
  t: number
): [string, string, string, string] {
  const result: string[] = [];
  for (let i = 0; i < 4; i++) {
    const r1 = parseInt(from[i].slice(1, 3), 16);
    const g1 = parseInt(from[i].slice(3, 5), 16);
    const b1 = parseInt(from[i].slice(5, 7), 16);
    const r2 = parseInt(to[i].slice(1, 3), 16);
    const g2 = parseInt(to[i].slice(3, 5), 16);
    const b2 = parseInt(to[i].slice(5, 7), 16);
    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);
    result.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
  }
  return result as [string, string, string, string];
}
