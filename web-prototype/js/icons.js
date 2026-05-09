/* SF-Symbols-inspired SVG icon library.
 * All icons share the same 24x24 viewBox and stroke-based geometry so they
 * scale evenly. `icon(name, opts)` returns an SVG string ready to drop into
 * innerHTML. Filled tab icons live under names ending with `.fill`. */
(function (global) {
  'use strict';

  const PATHS = {
    /* Navigation / structural */
    'house.fill': '<path d="M3 11.4 12 4l9 7.4V20a1 1 0 0 1-1 1h-4v-6h-8v6H4a1 1 0 0 1-1-1V11.4Z" fill="currentColor" stroke="none"/>',
    'house': '<path d="M3 11.4 12 4l9 7.4V20a1 1 0 0 1-1 1h-4v-6h-8v6H4a1 1 0 0 1-1-1V11.4Z"/>',

    'dumbbell.fill': '<path fill="currentColor" stroke="none" d="M2 10h2v4H2zM5 8h2v8H5zM8 6h2v12H8zM14 6h2v12h-2zM17 8h2v8h-2zM20 10h2v4h-2zM10 11h4v2h-4z"/>',
    'dumbbell': '<rect x="2" y="10" width="2" height="4" rx="0.5"/><rect x="5" y="8" width="2" height="8" rx="0.5"/><rect x="8" y="6" width="2" height="12" rx="0.5"/><rect x="14" y="6" width="2" height="12" rx="0.5"/><rect x="17" y="8" width="2" height="8" rx="0.5"/><rect x="20" y="10" width="2" height="4" rx="0.5"/><line x1="10" y1="12" x2="14" y2="12"/>',

    'fork.knife.fill': '<path fill="currentColor" stroke="none" d="M7 3h2v7c0 .55-.45 1-1 1s-1-.45-1-1V3Zm-2 0h2v7H5V3Zm6 0h2v7h-2V3Zm0 0v18h2v-9c0-1.1-.9-2-2-2Zm5 0c-1.66 0-3 2.24-3 5s1.34 5 3 5h1v8h2V3h-3Z"/>',
    'fork.knife': '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-1.5 0-3 2-3 5s1.5 5 3 5h1v8M17 3v18M5 3v6"/>',

    'person.crop.circle.fill': '<path fill="currentColor" stroke="none" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 14a8 8 0 0 1-6.4-3.2c.3-1.7 4.3-2.8 6.4-2.8s6.1 1.1 6.4 2.8A8 8 0 0 1 12 21Z"/>',
    'person.crop.circle': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M5.6 18.8c1-2.3 4.1-3.3 6.4-3.3s5.4 1 6.4 3.3"/>',

    'list.bullet.rectangle.fill': '<path fill="currentColor" stroke="none" d="M3 5h18v14H3V5Zm3 3h2v2H6V8Zm0 4h2v2H6v-2Zm0 4h2v2H6v-2Zm4-8h8v2h-8V8Zm0 4h8v2h-8v-2Zm0 4h8v2h-8v-2Z"/>',
    'list.bullet.rectangle': '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="9" x2="7" y2="9"/><line x1="7" y1="13" x2="7" y2="13"/><line x1="7" y1="17" x2="7" y2="17"/><line x1="11" y1="9" x2="17" y2="9"/><line x1="11" y1="13" x2="17" y2="13"/><line x1="11" y1="17" x2="17" y2="17"/>',

    'testtube.2.fill': '<path fill="currentColor" stroke="none" d="M9 2v9.7a3.5 3.5 0 1 0 3 0V2H9Zm6 0v13.7a3.5 3.5 0 1 0 3 0V2h-3Z"/>',
    'testtube.2': '<path d="M9 2v9.7a3.5 3.5 0 1 0 3 0V2"/><path d="M15 2v13.7a3.5 3.5 0 1 0 3 0V2"/>',

    /* Common controls */
    'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'minus': '<line x1="5" y1="12" x2="19" y2="12"/>',
    'xmark': '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
    'checkmark': '<polyline points="5 13 9 17 19 7"/>',
    'chevron.right': '<polyline points="9 6 15 12 9 18"/>',
    'chevron.left': '<polyline points="15 6 9 12 15 18"/>',
    'chevron.down': '<polyline points="6 9 12 15 18 9"/>',
    'chevron.up': '<polyline points="6 15 12 9 18 15"/>',

    'magnifyingglass': '<circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/>',
    'gear': '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',

    'trash': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'pencil': '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    'square.and.pencil': '<path d="M4 4h7"/><path d="M4 4v16h16v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',

    /* Dashboard & content icons */
    'flame.fill': '<path fill="currentColor" stroke="none" d="M12 2s4 4 4 8c0 1.7-.7 3-2 4 1-2 0-3-1-3-1.5 0-2 1-2 3 0 1 .5 2 1 3-2 0-4-2-4-5 0-3 2-5 4-10Zm-1 19a5 5 0 1 0 4-9c0 2-1 3-2 3-1 0-1-1-1-2-2 1-3 3-3 5 0 1 1 2 2 3Z"/>',
    'flame': '<path d="M12 2s4 4 4 8c0 4-3 7-4 7-3 0-5-2-5-5 0-3 2-4 3-7 0 2 1 3 2 3"/>',

    'drop.fill': '<path fill="currentColor" stroke="none" d="M12 2c-1 2-7 8-7 13a7 7 0 0 0 14 0c0-5-6-11-7-13Z"/>',
    'drop': '<path d="M12 3c-1 2-6 7.5-6 12a6 6 0 0 0 12 0c0-4.5-5-10-6-12Z"/>',
    'figure.run': '<circle cx="14" cy="4" r="2"/><path d="M9 11l3-1 2 3 2 1M11 21l1-6-3-3 2-4M14 21l1-7"/>',
    'bolt.heart.fill': '<path fill="currentColor" stroke="none" d="M12 21s-7-4.5-9.5-9C1 9 2 5 5.5 5 8 5 9 7 12 9c3-2 4-4 6.5-4C22 5 23 9 21.5 12 19 16.5 12 21 12 21Z"/><polyline stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" points="13 8 10 13 14 13 11 17"/>',
    'figure.walk': '<circle cx="13" cy="4" r="2"/><path d="M9 21l3-7-3-3v-3l-2 2-2-1"/><path d="M14 21l-1-7 4-3"/>',
    'scalemass': '<path d="M3 7h18v13H3z"/><circle cx="12" cy="13" r="3.5"/><path d="M12 9.5V13"/>',
    'chart.line.uptrend.xyaxis': '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/>',
    'chart.bar.fill': '<path fill="currentColor" stroke="none" d="M3 19h2v-7H3v7Zm4 0h2V8H7v11Zm4 0h2v-4h-2v4Zm4 0h2V4h-2v15Zm4 0h2v-9h-2v9Z"/>',
    'chart.bar': '<rect x="3" y="12" width="3" height="7"/><rect x="9" y="8" width="3" height="11"/><rect x="15" y="4" width="3" height="15"/>',

    'timer': '<circle cx="12" cy="13" r="8"/><line x1="12" y1="13" x2="15" y2="11"/><line x1="9" y1="3" x2="15" y2="3"/>',
    'play.fill': '<polygon fill="currentColor" stroke="none" points="6 4 20 12 6 20 6 4"/>',
    'stop.fill': '<rect fill="currentColor" stroke="none" x="6" y="6" width="12" height="12" rx="1"/>',
    'pause.fill': '<rect fill="currentColor" stroke="none" x="6" y="5" width="4" height="14"/><rect fill="currentColor" stroke="none" x="14" y="5" width="4" height="14"/>',

    /* Camera / barcode */
    'barcode': '<line x1="3" y1="5" x2="3" y2="19"/><line x1="5" y1="5" x2="5" y2="19"/><line x1="8" y1="5" x2="8" y2="19"/><line x1="10" y1="5" x2="10" y2="19"/><line x1="13" y1="5" x2="13" y2="19"/><line x1="16" y1="5" x2="16" y2="19"/><line x1="18" y1="5" x2="18" y2="19"/><line x1="21" y1="5" x2="21" y2="19"/>',
    'barcode.viewfinder': '<path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M8 20H5a1 1 0 0 1-1-1v-3"/><line x1="8" y1="9" x2="8" y2="15"/><line x1="11" y1="9" x2="11" y2="15"/><line x1="14" y1="9" x2="14" y2="15"/><line x1="16" y1="9" x2="16" y2="15"/>',
    'camera.fill': '<path fill="currentColor" stroke="none" d="M9 4l-2 3H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3H9Zm3 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"/>',
    'camera': '<path d="M9 4l-2 3H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2-3H9Z"/><circle cx="12" cy="13" r="4"/>',

    /* Status / system */
    'checkmark.circle.fill': '<circle fill="currentColor" cx="12" cy="12" r="10" stroke="none"/><polyline stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" points="7 12 11 16 17 9"/>',
    'xmark.circle.fill': '<circle fill="currentColor" cx="12" cy="12" r="10" stroke="none"/><line stroke="white" stroke-width="2" stroke-linecap="round" x1="8" y1="8" x2="16" y2="16"/><line stroke="white" stroke-width="2" stroke-linecap="round" x1="16" y1="8" x2="8" y2="16"/>',
    'exclamationmark.triangle.fill': '<path fill="currentColor" stroke="none" d="M12 3 1 21h22L12 3Zm0 6v6m0 3v.01"/>',
    'info.circle': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="12" y1="8" x2="12.01" y2="8"/>',

    /* Theme */
    'moon.fill': '<path fill="currentColor" stroke="none" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    'sun.max.fill': '<circle fill="currentColor" cx="12" cy="12" r="5" stroke="none"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',

    /* Status bar bits */
    'wifi': '<path d="M2 8a16 16 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8 16a4 4 0 0 1 8 0"/><circle fill="currentColor" stroke="none" cx="12" cy="20" r="1.5"/>',
    'cellularbars': '<rect fill="currentColor" stroke="none" x="2" y="14" width="3" height="6" rx="0.5"/><rect fill="currentColor" stroke="none" x="7" y="11" width="3" height="9" rx="0.5"/><rect fill="currentColor" stroke="none" x="12" y="8" width="3" height="12" rx="0.5"/><rect fill="currentColor" stroke="none" x="17" y="5" width="3" height="15" rx="0.5"/>',

    /* Misc */
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'icloud.fill': '<path fill="currentColor" stroke="none" d="M16 9a5 5 0 0 0-9.6-1.5A4.5 4.5 0 0 0 7 16h9a3.5 3.5 0 0 0 0-7Z"/>',
    'icloud.slash': '<path d="M16 9a5 5 0 0 0-9.6-1.5A4.5 4.5 0 0 0 7 16h9a3.5 3.5 0 0 0 1-6.8"/><line x1="3" y1="3" x2="21" y2="21"/>',
    'heart.fill': '<path fill="currentColor" stroke="none" d="M12 21s-7-4.5-9.5-9C1 9 2 5 5.5 5 8 5 9 7 12 9c3-2 4-4 6.5-4C22 5 23 9 21.5 12 19 16.5 12 21 12 21Z"/>',
    'arrow.clockwise': '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15A9 9 0 1 1 18 6.36L23 10"/>',
    'questionmark.circle': '<circle cx="12" cy="12" r="10"/><path d="M9.5 9.5a2.5 2.5 0 1 1 4 2c-1 .8-1.5 1.5-1.5 2.5"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
  };

  function icon(name, opts) {
    opts = opts || {};
    const size = opts.size || 24;
    const stroke = opts.stroke || 'currentColor';
    const fill = opts.fill || 'none';
    const sw = opts.strokeWidth != null ? opts.strokeWidth : 2;
    const cls = opts.class ? ` class="${opts.class}"` : '';
    const path = PATHS[name];
    if (!path) {
      console.warn('Unknown icon:', name);
      return '';
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${cls}>${path}</svg>`;
  }

  global.UFB_ICONS = { icon, PATHS };
})(window);
