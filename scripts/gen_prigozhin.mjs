import { execSync } from "child_process";
import fs from "fs";

// Create an SVG for Big Zombie Prigožin Clone
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240" width="200" height="240">
  <defs>
    <radialGradient id="zombieGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#39ff14" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#0d5c18" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#98b090"/>
      <stop offset="60%" stop-color="#7a9670"/>
      <stop offset="100%" stop-color="#556e50"/>
    </linearGradient>
    <linearGradient id="vest" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4a443b"/>
      <stop offset="100%" stop-color="#2a2620"/>
    </linearGradient>
    <linearGradient id="hammerHead" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#787f87"/>
      <stop offset="50%" stop-color="#4a5057"/>
      <stop offset="100%" stop-color="#202428"/>
    </linearGradient>
    <linearGradient id="hammerHandle" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8a5328"/>
      <stop offset="100%" stop-color="#4e2c11"/>
    </linearGradient>
    <filter id="pixelOutline">
      <feDropShadow dx="0" dy="2" stdDeviation="1" flood-color="#0a0f0a" flood-opacity="0.9"/>
    </filter>
  </defs>

  <!-- Aura of Undead Rage -->
  <circle cx="100" cy="120" r="90" fill="url(#zombieGlow)" opacity="0.35"/>

  <!-- Giant Sledgehammer (Held across back/side) -->
  <g id="sledgehammer" transform="rotate(-28 150 110)">
    <!-- Handle -->
    <rect x="145" y="10" width="12" height="180" rx="3" fill="url(#hammerHandle)" stroke="#1a0e06" stroke-width="2"/>
    <rect x="143" y="110" width="16" height="35" rx="2" fill="#2d2d2d" stroke="#111" stroke-width="1.5"/>
    <!-- Huge Hammer Head -->
    <rect x="125" y="15" width="52" height="38" rx="4" fill="url(#hammerHead)" stroke="#111" stroke-width="3"/>
    <rect x="120" y="22" width="62" height="24" rx="2" fill="#586068" stroke="#000" stroke-width="2"/>
    <!-- Skull insignia on hammer -->
    <circle cx="151" cy="34" r="6" fill="#fff" opacity="0.85"/>
    <rect x="148" y="38" width="6" height="4" fill="#fff" opacity="0.85"/>
    <circle cx="149" cy="33" r="1.5" fill="#111"/>
    <circle cx="153" cy="33" r="1.5" fill="#111"/>
  </g>

  <!-- Massive Muscular Zombie Legs -->
  <rect x="68" y="165" width="28" height="50" rx="6" fill="#444a36" stroke="#151a10" stroke-width="3"/>
  <rect x="104" y="165" width="28" height="50" rx="6" fill="#444a36" stroke="#151a10" stroke-width="3"/>
  <!-- Knee pads with metal spikes -->
  <rect x="67" y="180" width="26" height="16" rx="3" fill="#20221c" stroke="#0a0a0a" stroke-width="2"/>
  <polygon points="80,183 83,177 86,183" fill="#bbb"/>
  <rect x="107" y="180" width="26" height="16" rx="3" fill="#20221c" stroke="#0a0a0a" stroke-width="2"/>
  <polygon points="120,183 123,177 126,183" fill="#bbb"/>
  <!-- Heavy Combat Boots -->
  <path d="M 64 210 L 98 210 L 98 232 L 60 232 L 60 220 Z" fill="#1b1c1b" stroke="#0a0a0a" stroke-width="3"/>
  <path d="M 104 210 L 138 210 L 142 220 L 142 232 L 104 232 Z" fill="#1b1c1b" stroke="#0a0a0a" stroke-width="3"/>

  <!-- Hulking Undead Torso & Tactical Plate Carrier -->
  <rect x="52" y="90" width="96" height="82" rx="12" fill="url(#vest)" stroke="#111" stroke-width="4"/>
  <!-- Molle webbing & Ammo pouches (I NEED AMMO!) -->
  <rect x="58" y="125" width="24" height="32" rx="3" fill="#38342a" stroke="#151410" stroke-width="2"/>
  <rect x="88" y="125" width="24" height="32" rx="3" fill="#38342a" stroke="#151410" stroke-width="2"/>
  <rect x="118" y="125" width="24" height="32" rx="3" fill="#38342a" stroke="#151410" stroke-width="2"/>
  <text x="100" y="112" font-family="Arial, sans-serif" font-weight="900" font-size="10" fill="#ff3333" text-anchor="middle" letter-spacing="1">AMMO?!</text>
  <line x1="58" y1="120" x2="142" y2="120" stroke="#222" stroke-width="3"/>
  <line x1="58" y1="105" x2="142" y2="105" stroke="#222" stroke-width="2"/>

  <!-- Muscular Undead Shoulders & Arms -->
  <!-- Left Arm (flexed, mutated) -->
  <ellipse cx="44" cy="115" rx="16" ry="24" fill="url(#skin)" stroke="#1c2419" stroke-width="3"/>
  <ellipse cx="38" cy="148" rx="13" ry="20" fill="url(#skin)" stroke="#1c2419" stroke-width="3"/>
  <circle cx="36" cy="170" r="12" fill="#506649" stroke="#1c2419" stroke-width="3"/>
  <!-- Right Arm (holding hammer handle) -->
  <ellipse cx="156" cy="115" rx="16" ry="24" fill="url(#skin)" stroke="#1c2419" stroke-width="3"/>
  <ellipse cx="160" cy="145" rx="13" ry="20" fill="url(#skin)" stroke="#1c2419" stroke-width="3"/>
  <circle cx="155" cy="165" r="12" fill="#506649" stroke="#1c2419" stroke-width="3"/>

  <!-- Thick Bull Neck with Stitches -->
  <rect x="76" y="70" width="48" height="30" rx="4" fill="url(#skin)" stroke="#1c2419" stroke-width="3"/>
  <!-- Zombie stitches on neck -->
  <line x1="82" y1="84" x2="118" y2="84" stroke="#152012" stroke-width="2"/>
  <line x1="88" y1="80" x2="88" y2="88" stroke="#152012" stroke-width="2"/>
  <line x1="100" y1="80" x2="100" y2="88" stroke="#152012" stroke-width="2"/>
  <line x1="112" y1="80" x2="112" y2="88" stroke="#152012" stroke-width="2"/>

  <!-- Iconic Bald Head with Scars and Furious Expression -->
  <ellipse cx="100" cy="52" rx="34" ry="38" fill="url(#skin)" stroke="#1c2419" stroke-width="3.5"/>
  <!-- Forehead wrinkles & battle scars -->
  <path d="M 80 32 Q 100 28 120 32" stroke="#485c43" stroke-width="2.5" fill="none"/>
  <path d="M 84 38 Q 100 35 116 38" stroke="#485c43" stroke-width="2.5" fill="none"/>
  <line x1="74" y1="40" x2="88" y2="58" stroke="#8c1d1d" stroke-width="2.5"/>

  <!-- Fierce Bushy Zombie Eyebrows -->
  <path d="M 76 46 L 94 53" stroke="#2a3525" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M 124 46 L 106 53" stroke="#2a3525" stroke-width="4.5" stroke-linecap="round"/>

  <!-- Glowing Green/Red Zombie Eyes -->
  <ellipse cx="86" cy="56" rx="6" ry="5" fill="#ff1a1a" stroke="#000" stroke-width="1.5"/>
  <circle cx="86" cy="56" r="2.5" fill="#39ff14"/>
  <ellipse cx="114" cy="56" rx="6" ry="5" fill="#ff1a1a" stroke="#000" stroke-width="1.5"/>
  <circle cx="114" cy="56" r="2.5" fill="#39ff14"/>

  <!-- Wide Bulbous Pugnacious Nose -->
  <path d="M 100 50 L 96 66 L 104 66 Z" fill="#688260"/>
  <circle cx="94" cy="67" r="3.5" fill="#556c4e" stroke="#1c2419" stroke-width="1"/>
  <circle cx="106" cy="67" r="3.5" fill="#556c4e" stroke="#1c2419" stroke-width="1"/>

  <!-- Screaming/Shouting Open Mouth ("WHERE IS THE AMMUNITION?!") -->
  <path d="M 82 74 Q 100 71 118 74 Q 115 88 100 89 Q 85 88 82 74 Z" fill="#260808" stroke="#1c2419" stroke-width="2.5"/>
  <!-- Jagged Sharp Zombie Teeth -->
  <polygon points="85,74 88,80 91,74" fill="#eedd82"/>
  <polygon points="93,74 96,81 99,74" fill="#eedd82"/>
  <polygon points="101,74 104,81 107,74" fill="#eedd82"/>
  <polygon points="109,74 112,80 115,74" fill="#eedd82"/>
  <!-- Lower teeth -->
  <polygon points="88,86 91,82 94,86" fill="#eedd82"/>
  <polygon points="106,86 109,82 112,86" fill="#eedd82"/>
  <!-- Undead Tongue -->
  <ellipse cx="100" cy="84" rx="7" ry="4" fill="#6e2d2d"/>

  <!-- Ear details with tactical radio earpiece -->
  <circle cx="67" cy="56" r="7" fill="url(#skin)" stroke="#1c2419" stroke-width="2"/>
  <circle cx="133" cy="56" r="7" fill="url(#skin)" stroke="#1c2419" stroke-width="2"/>
  <rect x="64" y="55" width="4" height="12" rx="2" fill="#111"/>
  <path d="M 66 67 Q 75 72 82 75" stroke="#111" stroke-width="1.5" fill="none"/>
</svg>`;

fs.writeFileSync("/tmp/prigozhin.svg", svg);
execSync("convert -background none /tmp/prigozhin.svg -resize 200x240 public/sprites/prigozhin.png");
console.log("Generated public/sprites/prigozhin.png successfully!");
