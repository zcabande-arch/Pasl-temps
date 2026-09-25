// Pas l'temps — petits dessins au trait, dans le style de l'icône (trait rouge épais + cadre noir fin).
// Les données gardent leurs emojis (historique, posts…) : l'affichage les remplace par ces dessins.
// Expose window.ICONS : ico(nom ou emoji, taille) → <svg>, ou l'emoji tel quel s'il n'a pas de dessin.
(function(){
  // a = trait rouge épais (accent), k = trait noir fin (cadre), f = forme rouge pleine
  const D = {
    chair:     {a:"M13 9 L21 25 H35", k:"M15 40 L18 21 H30 L34 40 M16.5 33 H32.5"},
    croissant: {f:"M7 31 C7 18 16 11 24 11 C32 11 41 18 41 31 C37 26 31 23.5 24 23.5 C17 23.5 11 26 7 31 Z", k:"M16 14.5 L18.5 24.5 M24 11 V23.5 M32 14.5 L29.5 24.5 M7 31 C11 26 17 23.5 24 23.5 C31 23.5 37 26 41 31"},
    tree:      {f:"M24 8 A10 10 0 1 1 23.99 8 Z", k:"M24 26 V41 M24 33 L30 28 M16 41 H32"},
    bag:       {a:"M18 17 V13 A6 6 0 0 1 30 13 V17", k:"M11 17 H37 L35 40 H13 Z"},
    books:     {a:"M30 12 L37 39", k:"M11 12 H18 V40 H11 Z M19 16 H26 V40 H19 Z M9 40 H40"},
    shoe:      {a:"M11 17 C15 17 18 21 22 24 C28 27 36 27 39 31 V33 H11 Z", k:"M9 37 H40 M17 22 L20 20 M21 25 L24 23"},
    baguette:  {f:"M8.5 35.5 C6 33 7 29.5 10.5 27 L30 11 C33.5 8.5 37.5 8.5 39.5 10.5 C41.5 12.5 41 16.5 37.5 19 L18 35 C14.5 37.5 11 38 8.5 35.5 Z", k:"M14 28 L18.5 32.5 M20.5 23 L25 27.5 M27 18 L31.5 22.5 M33 13 L36 16 M6 43 H42"},
    cup:       {a:"M12 20 H32 V27 A10 10 0 0 1 12 27 Z", k:"M32 22 H35 A4 4 0 0 1 35 30 H32 M8 40 H38 M18 9 C16 12 20 13 18 16 M26 9 C24 12 28 13 26 16"},
    sandwich:  {a:"M10 27 H38", k:"M8 22 L24 11 L40 22 Z M9 32 H39 L37 37 H11 Z"},
    icecream:  {f:"M24 6 A9 9 0 1 1 23.99 6 Z", k:"M15 20 H33 L24 42 Z M18 26 L27 29 M20 32 L25 34"},
    plate:     {a:"M24 13 A11 11 0 1 1 23.99 13 Z", k:"M7 9 V19 A3 3 0 0 0 10 22 V39 M10 9 V17 M13 9 V19 A3 3 0 0 1 10 22 M41 9 C36 12 36 22 38 24 H41 V39"},
    forest:    {f:"M31 8 L40 26 H22 Z", k:"M31 26 V34 M16 16 L24 34 H8 Z M16 34 V40 M6 40 H42"},
    mall:      {a:"M8 17 H40", k:"M11 17 V40 H37 V17 M8 17 L13 9 H35 L40 17 M20 40 V29 H28 V40 M6 40 H42"},
    market:    {a:"M8 18 C11 22 14 22 16 18 C19 22 21 22 24 18 C27 22 29 22 32 18 C35 22 37 22 40 18", k:"M8 18 L12 9 H36 L40 18 M11 22 V40 M37 22 V40 M17 30 H31 V40 M6 40 H42"},
    gift:      {a:"M24 15 V40 M10 22 H38", k:"M10 15 H38 V22 H36 V40 H12 V22 H10 Z M24 15 C20 7 13 9 17 15 M24 15 C28 7 35 9 31 15"},
    openbook:  {a:"M24 13 C19 9 12 9 8 11 V36 C12 34 19 34 24 38 C29 34 36 34 40 36 V11 C36 9 29 9 24 13", k:"M24 13 V38 M12 17 H19 M12 22 H19 M29 17 H36 M29 22 H36"},
    monument:  {f:"M24 7 L41 17 H7 Z", k:"M11 21 V36 M19 21 V36 M29 21 V36 M37 21 V36 M8 21 H40 M7 36 H41 M5 41 H43"},
    vase:      {f:"M18 20 C11 24 12 35 18 39 H30 C36 35 37 24 30 20 Z", k:"M20 20 V13 H28 V20 M17.5 10 H30.5 M20 15 C14 15 13 22 16.5 25 M28 15 C34 15 35 22 31.5 25 M16 43 H32"},
    cocktail:  {f:"M11 10 H37 L24 25 Z", k:"M24 25 V39 M16 41 H32 M31 4 L27.5 14 M33 16 A3 3 0 1 1 32.99 16"},
    beer:      {f:"M11 16 H29 V40 H11 Z", k:"M29 21 H34 A3 3 0 0 1 37 24 V31 A3 3 0 0 1 34 34 H29 M9 17 C8 11 14 9 17 12 C19 7 26 8 27 12 C30 10 34 13 31 17 M16 23 V34 M22 23 V34"},
    frame:     {a:"M14 32 L21 23 L26 29 L29 25 L34 32", k:"M9 11 H39 V38 H9 Z M13 15 H35 V34 H13 Z M30 20 A2 2 0 1 1 29.99 20"},
    dumbbell:  {a:"M11 15 V33 M37 15 V33", k:"M15 24 H33 M6 20 V28 M42 20 V28 M15 18 V30 M33 18 V30"},
    compass:   {f:"M24 11 L28 24 L24 27 L20 24 Z", k:"M24 5 A19 19 0 1 1 23.99 5 M24 27 L28 24 L24 37 L20 24 Z"},
    star:      {a:"M24 8 L28.7 18.5 L40 19.6 L31.4 27.2 L34 38.5 L24 32.5 L14 38.5 L16.6 27.2 L8 19.6 L19.3 18.5 Z", k:"M6 43 H42"},
    pencil:    {a:"M13 35 L10 42 L17 39", k:"M13 35 L32 10 L39 15 L17 39 M28 15 L35 20 M8 44 H40"},
    pin:       {f:"M24 16 A4.5 4.5 0 1 1 23.99 16 Z", k:"M24 42 C24 42 11 29 11 20 A13 13 0 0 1 37 20 C37 29 24 42 24 42 Z"},
    walk:      {f:"M24 5 A4.5 4.5 0 1 1 23.99 5 Z", k:"M23 15 L21 27 L15 39 M21 27 L28 32 L29 41 M22.5 17 L15 22 M22.5 17 L30 21"},
    bike:      {a:"M13 31 L20 19 H31 L35 31 M20 19 L24 31 L31 19", k:"M13 23 A8 8 0 1 1 12.99 23 M35 23 A8 8 0 1 1 34.99 23 M17 15 H23 M29 13 H34 M31 19 L29.5 13"},
    car:       {f:"M6 32 V26 C6 24 7 23 9 23 L14 15 H33 L38 23 C41 23 42 24 42 26 V32 Z", k:"M16 22 L19 18 H31 L33 22 Z M14 32 A4 4 0 1 1 13.99 32 M34 32 A4 4 0 1 1 33.99 32 M4 40 H44"},
    user:      {f:"M24 8 A7.5 7.5 0 1 1 23.99 8 Z", k:"M10 41 C10 32 16 27 24 27 C32 27 38 32 38 41"},
    sofa:      {a:"M9 27 H39", k:"M9 20 V31 H39 V20 M13 20 V15 H35 V20 M12 31 V36 M36 31 V36"}
  };
  // Emoji (dans les données) → dessin
  const FROM_EMOJI = {
    "🥐":"plate", "🌳":"tree", "🛍️":"bag", "📚":"books", "🛋️":"chair", "🏃":"shoe",
    "🥖":"baguette", "☕":"cup", "🫖":"cup", "🌯":"sandwich", "🍦":"icecream", "🍝":"plate",
    "🌲":"forest", "🧺":"market", "🎁":"gift", "📖":"openbook", "🏛️":"monument", "🖼️":"frame", "🏺":"vase", "🍸":"cocktail", "🍺":"beer",
    "👟":"shoe", "🏋️":"dumbbell", "🧭":"compass", "⭐":"star", "📝":"pencil", "📍":"pin"
  };
  function ico(name, size){
    const d = D[name] || D[FROM_EMOJI[name]];
    if(!d) return name == null ? "" : String(name).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    const s = size ? ` width="${size}" height="${size}"` : "";
    return `<svg class="ico" viewBox="0 0 48 48"${s} aria-hidden="true" focusable="false">` +
      (d.f ? `<path d="${d.f}" fill="var(--ico-a, #E60A00)"/>` : "") +
      (d.a ? `<path d="${d.a}" fill="none" stroke="var(--ico-a, #E60A00)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` : "") +
      `<path d="${d.k}" fill="none" stroke="var(--ico-k, currentColor)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  const has = name => !!(D[name] || D[FROM_EMOJI[name]]);
  window.ICONS = {ico, has, names: Object.keys(D)};
})();
