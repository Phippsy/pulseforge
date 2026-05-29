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

// 60 diverse palettes — heavy on psychedelic, acid, rave, and trippy themes
export const palettes: ColorPalette[] = [
  // === ORIGINALS ===
  { id: 'neon-cyber', name: 'Neon Cyber', colors: ['#FF00FF', '#00FFFF', '#FF0080', '#80FF00'], backgroundColor: '#000000' },
  { id: 'sunset', name: 'Sunset', colors: ['#FF6B35', '#FF2E63', '#8B2FC9', '#FFB100'], backgroundColor: '#0A0A1A' },
  { id: 'ocean-deep', name: 'Deep Ocean', colors: ['#0077B6', '#00B4D8', '#48CAE4', '#CAF0F8'], backgroundColor: '#03045E' },
  { id: 'emerald', name: 'Emerald', colors: ['#06D6A0', '#118AB2', '#073B4C', '#FFD166'], backgroundColor: '#001219' },
  { id: 'vaporwave', name: 'Vaporwave', colors: ['#FF71CE', '#01CDFE', '#05FFA1', '#B967FF'], backgroundColor: '#1A0033' },
  { id: 'fire-ice', name: 'Fire & Ice', colors: ['#FF4500', '#FF8C00', '#00CED1', '#4169E1'], backgroundColor: '#000011' },
  { id: 'aurora', name: 'Aurora', colors: ['#00FF87', '#60EFFF', '#9D4EDD', '#FF006E'], backgroundColor: '#000022' },
  { id: 'lava', name: 'Molten', colors: ['#FF0000', '#FF6600', '#FFCC00', '#990000'], backgroundColor: '#1A0000' },
  { id: 'cosmic', name: 'Cosmic', colors: ['#7400B8', '#6930C3', '#5390D9', '#48BFE3'], backgroundColor: '#0A0014' },
  { id: 'electric', name: 'Electric', colors: ['#CCFF00', '#00FF66', '#00CCFF', '#FF00CC'], backgroundColor: '#000A00' },
  { id: 'rosegold', name: 'Rose Gold', colors: ['#FFB4A2', '#E5989B', '#B5838D', '#FFD700'], backgroundColor: '#1A0A0A' },
  { id: 'arctic', name: 'Arctic', colors: ['#A8DADC', '#457B9D', '#1D3557', '#F1FAEE'], backgroundColor: '#001122' },
  { id: 'candy', name: 'Candy', colors: ['#FF69B4', '#FF1493', '#DA70D6', '#FF6EC7'], backgroundColor: '#0D001A' },
  { id: 'matrix', name: 'Matrix', colors: ['#00FF41', '#008F11', '#003B00', '#39FF14'], backgroundColor: '#000800' },
  { id: 'bloodmoon', name: 'Blood Moon', colors: ['#8B0000', '#DC143C', '#FF4500', '#2F0000'], backgroundColor: '#0A0000' },
  { id: 'tropical', name: 'Tropical', colors: ['#FF6B6B', '#FEC89A', '#A7F3D0', '#67E8F9'], backgroundColor: '#001A1A' },
  { id: 'jazz', name: 'Midnight Jazz', colors: ['#FFD700', '#4169E1', '#191970', '#FF8C00'], backgroundColor: '#000033' },
  { id: 'ultraviolet', name: 'Ultraviolet', colors: ['#BC00FF', '#7700FF', '#3300FF', '#FF00FF'], backgroundColor: '#0A000A' },
  { id: 'sakura', name: 'Sakura', colors: ['#FFB7C5', '#FF69B4', '#DB7093', '#FFF0F5'], backgroundColor: '#0D0008' },
  { id: 'storm', name: 'Thunderstorm', colors: ['#FFFFFF', '#87CEEB', '#4A0080', '#FFD700'], backgroundColor: '#000022' },

  // === PSYCHEDELIC & ACID ===
  { id: 'acid-trip', name: 'Acid Trip', colors: ['#FF00FF', '#FFFF00', '#00FF00', '#FF4500'], backgroundColor: '#0D000D' },
  { id: 'dmt-realm', name: 'DMT Realm', colors: ['#FF1493', '#7FFF00', '#00CED1', '#FF6347'], backgroundColor: '#050010' },
  { id: 'lysergic', name: 'Lysergic', colors: ['#E040FB', '#76FF03', '#FFEA00', '#00E5FF'], backgroundColor: '#0A000F' },
  { id: 'mushroom-vision', name: 'Mushroom Vision', colors: ['#8B4513', '#FFD700', '#9400D3', '#32CD32'], backgroundColor: '#0A0500' },
  { id: 'peyote-sun', name: 'Peyote Sun', colors: ['#FF8C00', '#FF1493', '#00FF7F', '#FFD700'], backgroundColor: '#1A0800' },
  { id: 'kaleidoscope', name: 'Kaleidoscope', colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'], backgroundColor: '#000000' },
  { id: 'tie-dye', name: 'Tie Dye', colors: ['#FF6EC7', '#FF9F1C', '#2EC4B6', '#9B5DE5'], backgroundColor: '#0D0D0D' },
  { id: 'fractal-deep', name: 'Fractal Deep', colors: ['#FF00CC', '#00FFCC', '#CC00FF', '#CCFF00'], backgroundColor: '#000A0A' },
  { id: 'third-eye', name: 'Third Eye', colors: ['#9400D3', '#FF1493', '#00BFFF', '#FFD700'], backgroundColor: '#0A000A' },
  { id: 'astral-plane', name: 'Astral Plane', colors: ['#DA70D6', '#87CEEB', '#FFB6C1', '#98FB98'], backgroundColor: '#05000A' },
  { id: 'rainbow-serpent', name: 'Rainbow Serpent', colors: ['#FF0000', '#FF8000', '#FFFF00', '#00FF80'], backgroundColor: '#000808' },
  { id: 'ego-death', name: 'Ego Death', colors: ['#FFFFFF', '#FF00FF', '#00FFFF', '#000000'], backgroundColor: '#0A0A0A' },
  { id: 'synesthesia', name: 'Synesthesia', colors: ['#FF4081', '#7C4DFF', '#18FFFF', '#EEFF41'], backgroundColor: '#0D000D' },

  // === RAVE & CLUB ===
  { id: 'acid-house', name: 'Acid House', colors: ['#FFFF00', '#FF00FF', '#00FF00', '#FF4500'], backgroundColor: '#000000' },
  { id: 'warehouse-rave', name: 'Warehouse Rave', colors: ['#39FF14', '#FF073A', '#0FF0FC', '#DFFF00'], backgroundColor: '#050505' },
  { id: 'gabber-strobe', name: 'Gabber Strobe', colors: ['#FFFFFF', '#FF0000', '#FFFF00', '#00FF00'], backgroundColor: '#000000' },
  { id: 'trance-tunnel', name: 'Trance Tunnel', colors: ['#7B68EE', '#00FA9A', '#FF69B4', '#4169E1'], backgroundColor: '#000022' },
  { id: 'hardstyle', name: 'Hardstyle', colors: ['#FF4500', '#FF0000', '#FFD700', '#FF6347'], backgroundColor: '#0A0000' },
  { id: 'drum-n-bass', name: 'Drum & Bass', colors: ['#FFD700', '#FF4500', '#8B4513', '#FFA500'], backgroundColor: '#0A0500' },
  { id: 'goa-trance', name: 'Goa Trance', colors: ['#FF1493', '#00FF7F', '#FFD700', '#BA55D3'], backgroundColor: '#0D0008' },
  { id: 'psytrance', name: 'Psytrance', colors: ['#39FF14', '#FF00FF', '#00BFFF', '#FF6600'], backgroundColor: '#000808' },
  { id: 'techno-berlin', name: 'Berlin Techno', colors: ['#1A1A2E', '#E94560', '#16213E', '#0F3460'], backgroundColor: '#000000' },
  { id: 'uk-garage', name: 'UK Garage', colors: ['#C0C0C0', '#FFD700', '#4169E1', '#FF69B4'], backgroundColor: '#0A0A1A' },

  // === NEON & GLOW ===
  { id: 'neon-rainforest', name: 'Neon Rainforest', colors: ['#00FF41', '#FF00FF', '#00FFFF', '#ADFF2F'], backgroundColor: '#001200' },
  { id: 'blacklight', name: 'Blacklight', colors: ['#FF00FF', '#9D00FF', '#00FFFF', '#FF6EC7'], backgroundColor: '#0A000A' },
  { id: 'fluorescent', name: 'Fluorescent', colors: ['#CCFF00', '#FF6600', '#FF0066', '#00FFCC'], backgroundColor: '#000000' },
  { id: 'bioluminescent', name: 'Bioluminescent', colors: ['#00FFCC', '#7FFFD4', '#00CED1', '#40E0D0'], backgroundColor: '#001A1A' },
  { id: 'plasma-ball', name: 'Plasma Ball', colors: ['#9400D3', '#FF00FF', '#4169E1', '#8A2BE2'], backgroundColor: '#05000A' },
  { id: 'laser-show', name: 'Laser Show', colors: ['#00FF00', '#FF0000', '#0000FF', '#FFFF00'], backgroundColor: '#000000' },

  // === COSMIC & SPACE ===
  { id: 'nebula', name: 'Nebula', colors: ['#FF1493', '#8A2BE2', '#00CED1', '#FF4500'], backgroundColor: '#050008' },
  { id: 'supernova', name: 'Supernova', colors: ['#FFFFFF', '#FFD700', '#FF4500', '#FF0000'], backgroundColor: '#0A0000' },
  { id: 'wormhole', name: 'Wormhole', colors: ['#00BFFF', '#9400D3', '#FF1493', '#00FF7F'], backgroundColor: '#000011' },
  { id: 'dark-matter', name: 'Dark Matter', colors: ['#4B0082', '#2E0854', '#7B68EE', '#9370DB'], backgroundColor: '#020008' },
  { id: 'solar-flare', name: 'Solar Flare', colors: ['#FF4500', '#FFD700', '#FF8C00', '#FFFF00'], backgroundColor: '#0A0500' },
  { id: 'event-horizon', name: 'Event Horizon', colors: ['#000000', '#FF4500', '#FFD700', '#FFFFFF'], backgroundColor: '#050000' },

  // === RETRO & VINTAGE ===
  { id: 'synthwave-sunset', name: 'Synthwave Sunset', colors: ['#FF006E', '#8338EC', '#3A86FF', '#FB5607'], backgroundColor: '#0D001A' },
  { id: 'miami-vice', name: 'Miami Vice', colors: ['#FF6EC7', '#00CED1', '#FF69B4', '#40E0D0'], backgroundColor: '#0A001A' },
  { id: 'outrun', name: 'Outrun', colors: ['#FF00FF', '#FF4500', '#FFD700', '#00FFFF'], backgroundColor: '#1A0033' },
  { id: 'retro-arcade', name: 'Retro Arcade', colors: ['#FF0000', '#00FF00', '#FFFF00', '#00FFFF'], backgroundColor: '#000000' },
  { id: 'disco-floor', name: 'Disco Floor', colors: ['#FFD700', '#FF1493', '#00FF7F', '#FF4500'], backgroundColor: '#0D0D0D' },
  { id: 'lava-lamp', name: 'Lava Lamp', colors: ['#FF4500', '#FF6347', '#FFD700', '#FF1493'], backgroundColor: '#1A0500' },
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
