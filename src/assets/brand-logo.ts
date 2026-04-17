/**
 * Inline SVG logo for the family group-wedding program.
 * Two interlocking rings (gold + teal) representing union, encircled by a refined frame.
 * Returned as a data URI so it can be embedded in PDF/print HTML or <img src>.
 */
export const BRAND_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="goldG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#E9CB7E"/>
      <stop offset="55%" stop-color="#C4A25C"/>
      <stop offset="100%" stop-color="#8C6E2E"/>
    </linearGradient>
    <linearGradient id="tealG" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2A7E8B"/>
      <stop offset="100%" stop-color="#0E3A42"/>
    </linearGradient>
    <radialGradient id="bgG" cx="0.5" cy="0.5" r="0.6">
      <stop offset="0%" stop-color="#FBF7EE"/>
      <stop offset="100%" stop-color="#F1E6CB"/>
    </radialGradient>
  </defs>

  <!-- background medallion -->
  <circle cx="100" cy="100" r="96" fill="url(#bgG)" stroke="#C4A25C" stroke-width="2"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="#1B4F58" stroke-width="1" stroke-dasharray="2 3" opacity="0.4"/>

  <!-- decorative arabesque dots -->
  <g fill="#C4A25C" opacity="0.55">
    <circle cx="100" cy="14" r="2"/>
    <circle cx="100" cy="186" r="2"/>
    <circle cx="14" cy="100" r="2"/>
    <circle cx="186" cy="100" r="2"/>
  </g>

  <!-- two interlocking rings -->
  <g fill="none" stroke-width="10" stroke-linecap="round">
    <circle cx="78" cy="100" r="34" stroke="url(#goldG)"/>
    <circle cx="122" cy="100" r="34" stroke="url(#tealG)"/>
    <!-- weave: redraw a small arc of the gold ring on top to fake interlocking -->
    <path d="M 100,72 A 34 34 0 0 1 112 92" stroke="url(#goldG)"/>
  </g>

  <!-- subtle highlight -->
  <ellipse cx="80" cy="58" rx="40" ry="10" fill="#fff" opacity="0.18"/>
</svg>`;

export const BRAND_LOGO_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(BRAND_LOGO_SVG)}`;
