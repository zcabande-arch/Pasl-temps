// Fissa Fissa — petits dessins au trait, dans le style de l'icône (trait rouge épais + cadre noir fin).
// Les données gardent leurs emojis (historique, posts…) : l'affichage les remplace par ces dessins.
// Expose window.ICONS : ico(nom ou emoji, taille) → <svg>, ou l'emoji tel quel s'il n'a pas de dessin.
(function(){
  // a = trait rouge épais (accent), k = trait noir fin (cadre), f = forme rouge pleine
  const D = {
    gear:      {a:"M24 6 V11 M24 37 V42 M6 24 H11 M37 24 H42 M11.3 11.3 L14.8 14.8 M33.2 33.2 L36.7 36.7 M11.3 36.7 L14.8 33.2 M33.2 14.8 L36.7 11.3", k:"M12 24 A12 12 0 1 0 36 24 A12 12 0 1 0 12 24 M19.5 24 A4.5 4.5 0 1 0 28.5 24 A4.5 4.5 0 1 0 19.5 24"},
    clock:     {a:"M24 15 V24 L31 29", k:"M8 24 A16 16 0 1 0 40 24 A16 16 0 1 0 8 24"},
    alarm:     {a:"M24 17 V26 L30 30", k:"M10 26 A14 14 0 1 0 38 26 A14 14 0 1 0 10 26 M8 13 L14 8 M40 13 L34 8 M14 38 L11 42 M34 38 L37 42"},
    timer:     {a:"M24 18 V27 L29 31", k:"M10 27 A14 14 0 1 0 38 27 A14 14 0 1 0 10 27 M19 6 H29 M24 6 V13 M37 13 L39 11"},
    ban:       {a:"M13 13 L35 35", k:"M8 24 A16 16 0 1 0 40 24 A16 16 0 1 0 8 24"},
    thumbtack: {f:"M17 7 H31 L29 20 L35 27 H13 L19 20 Z", k:"M24 27 V42"},
    people:    {f:"M12 15 A6 6 0 1 0 24 15 A6 6 0 1 0 12 15 Z M27 17 A5 5 0 1 0 37 17 A5 5 0 1 0 27 17 Z", k:"M6 40 C6 31 11 26 18 26 C25 26 30 31 30 40 M30 27 C37 27 42 31 42 40"},
    bolt:      {f:"M27 5 L12 27 H23 L20 43 L36 20 H25 Z", k:""},
    moon:      {f:"M29 7 A17 17 0 1 0 41 30 A14 14 0 0 1 29 7 Z", k:""},
    mail:      {a:"M9 15 L24 27 L39 15", k:"M8 12 H40 V36 H8 Z"},
    fire:      {f:"M24 5 C26 14 35 18 35 29 A11 11 0 0 1 13 29 C13 22 17 20 18 14 C21 19 23 19 24 5 Z", k:"M24 27 C25 31 28 32 28 35 A4 4 0 0 1 20 35 C20 32 23 31 24 27"},
    globe:     {a:"M24 8 C16 16 16 32 24 40", k:"M8 24 A16 16 0 1 0 40 24 A16 16 0 1 0 8 24 M8 24 H40 M24 8 C32 16 32 32 24 40 M11 15 H37 M11 33 H37"},
    trophy:    {f:"M16 8 H32 V18 A8 8 0 0 1 16 18 Z", k:"M16 11 H10 C10 18 13 21 17 21 M32 11 H38 C38 18 35 21 31 21 M24 26 V34 M16 41 H32 M19 34 H29 V41 H19 Z"},
    sun:       {f:"M16 24 A8 8 0 1 0 32 24 A8 8 0 1 0 16 24 Z", k:"M24 5 V10 M24 38 V43 M5 24 H10 M38 24 H43 M10.6 10.6 L14 14 M34 34 L37.4 37.4 M10.6 37.4 L14 34 M34 14 L37.4 10.6"},
    smile:     {a:"M16 27 C19 33 29 33 32 27", k:"M7 24 A17 17 0 1 0 41 24 A17 17 0 1 0 7 24 M18 18 V20 M30 18 V20"},
    euro:      {a:"M34 13 A13 13 0 1 0 34 35", k:"M9 21 H27 M9 27 H25"},
    wheelchair:{a:"M16 25 A10 10 0 1 0 30 36", k:"M18.5 9 A3.5 3.5 0 1 0 25.5 9 A3.5 3.5 0 1 0 18.5 9 M22 15 V29 H32 L36 39 M22 21 H31"},
    rain:      {a:"M16 35 L13 42 M25 35 L22 42 M34 35 L31 42", k:"M13 29 A7 7 0 0 1 15 15 A10 10 0 0 1 34 14 A7.5 7.5 0 0 1 35 29 Z"},
    handshake: {a:"M5 20 L13 14 L22 18 M43 20 L35 14 L26 16 L18 23 C16 26 20 28 22 26 L27 22", k:"M11 26 L20 35 C22 37 24 35 23 33 M16 24 L25 33 C27 35 29 33 28 31 M24 24 L31 31 C33 33 35 31 33 29 L27 22 M35 14 L41 28"},
    heart:     {f:"M24 41 C12 32 6 26 6 18 A9 9 0 0 1 24 14 A9 9 0 0 1 42 18 C42 26 36 32 24 41 Z", k:""},
    offline:   {a:"M9 9 L39 39", k:"M16 6 H32 V42 H16 Z M22 37 H26"},
    bell:      {a:"M24 6 V10 M20 40 A4 4 0 0 0 28 40", k:"M13 34 V23 A11 11 0 0 1 35 23 V34 L38 37 H10 Z"},
    dice:      {f:"M12.3 16.5 A4.2 4.2 0 1 0 20.7 16.5 A4.2 4.2 0 1 0 12.3 16.5 Z M19.8 24 A4.2 4.2 0 1 0 28.2 24 A4.2 4.2 0 1 0 19.8 24 Z M27.3 31.5 A4.2 4.2 0 1 0 35.7 31.5 A4.2 4.2 0 1 0 27.3 31.5 Z", k:"M13 8 H35 A5 5 0 0 1 40 13 V35 A5 5 0 0 1 35 40 H13 A5 5 0 0 1 8 35 V13 A5 5 0 0 1 13 8 Z"},
    speech:    {a:"M15 18 H33 M15 25 H27", k:"M8 10 H40 V32 H22 L13 40 V32 H8 Z"},
    city:      {a:"M22 15 V17 M27 15 V17 M22 22 V24 M27 22 V24 M22 29 V31 M27 29 V31", k:"M8 41 V22 H17 M17 41 V9 H32 V41 M32 25 H40 V41 M5 41 H43"},
    map:       {a:"M10 31 C15 24 21 31 27 23 C31 18 35 21 38 16", k:"M6 12 L17 8 L31 12 L42 8 V36 L31 40 L17 36 L6 40 Z M17 8 V36 M31 12 V40"},
    bug:       {a:"M24 18 V40", k:"M14 29 A10 11 0 0 1 34 29 A10 11 0 0 1 14 29 M18 19 A6 6 0 0 1 30 19 M8 24 L14 26 M40 24 L34 26 M8 34 L14 33 M40 34 L34 33 M19 12 L16 8 M29 12 L32 8"},
    bulb:      {a:"M24 20 V30", k:"M18 31 C11 25 12 9 24 9 C36 9 37 25 30 31 V35 H18 Z M19 39 H29 M21 43 H27"},
    lock:      {a:"M24 29 V34", k:"M11 22 H37 V41 H11 Z M17 22 V16 A7 7 0 0 1 31 16 V22"},
    locate:    {f:"M19.5 24 A4.5 4.5 0 1 0 28.5 24 A4.5 4.5 0 1 0 19.5 24 Z", a:"M24 4 V11 M24 37 V44 M4 24 H11 M37 24 H44", k:"M12 24 A12 12 0 1 0 36 24 A12 12 0 1 0 12 24"},
    arrow:     {a:"M7 24 H37 M28 15 L37 24 L28 33", k:""},
    camera:    {a:"M17 27 A7 7 0 1 0 31 27 A7 7 0 1 0 17 27", k:"M7 16 H15 L19 10 H29 L33 16 H41 V38 H7 Z"},
    sprout:    {f:"M24 28 C14 28 9 21 10 13 C18 13 24 18 24 28 Z M24 24 C24 16 30 10 38 10 C39 18 33 24 24 24 Z", k:"M24 22 V41 M16 41 H32"},
    party:     {f:"M8 40 L16 16 L32 32 Z", a:"M27 8 L29 13 M36 14 L41 12 M34 23 L40 25", k:"M20 10 L21 13 M40 32 L37 33"},
    gem:       {a:"M14 10 L6 20", k:"M14 10 H34 L42 20 L24 40 L6 20 Z M6 20 H42 M19 10 L24 20 L29 10 M24 20 V40"},
    plane:     {f:"M22 7 C22 4 26 4 26 7 V19 L41 27 V31 L26 27 V36 L31 40 V42 L24 40 L17 42 V40 L22 36 V27 L7 31 V27 L22 19 Z", k:""},
    install:   {a:"M5 21 H21 M16 16 L21 21 L16 26", k:"M24 6 H38 V42 H24 Z M29 37 H33"},
    question:  {a:"M17 17 A7 7 0 1 1 27 23 C25 24 24 26 24 30", k:"M24 36 V37"},
    check:     {a:"M11 25 L20 34 L37 15", k:""},
    search:    {a:"M29 29 L39 39", k:"M9 21 A12 12 0 1 0 33 21 A12 12 0 1 0 9 21"},
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
    cart:      {f:"M13 14 H41 L37 28 H16.5 Z", k:"M5 9 H11 L17 33 H37 M20 39 A2.5 2.5 0 1 1 19.99 39 M34 39 A2.5 2.5 0 1 1 33.99 39"},
    carrot:    {f:"M33 15 C36 18 35 21 33 23 L12 39 C10 40 9 39 10 37 L25 16 C27 13 30 12 33 15 Z", k:"M31 13 L35 5 M33 14 L42 9 M34 17 L42 18 M17 30 L20.5 32.5 M22 23.5 L25.5 26"},
    cheese:    {f:"M7 24 L40 14 V37 H7 Z", k:"M7 24 L28 10 L40 14 M16 30 A2.5 2.5 0 1 1 15.99 30 M31 26 A3 3 0 1 1 30.99 26 M24 33.5 A1.5 1.5 0 1 1 23.99 33.5"},
    wine:      {f:"M19 22 C19 18 21 17 21 14 H27 C27 17 29 18 29 22 V41 H19 Z", k:"M21 14 V6 H27 V14 M19 28 H29 M19 35 H29"},
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
    "🌲":"forest", "🧺":"market", "🎁":"gift", "📖":"openbook", "🏛️":"monument", "🖼️":"frame", "🏺":"vase", "🍸":"cocktail", "🛒":"cart", "🏪":"mall", "🥕":"carrot", "🧀":"cheese", "🍷":"wine", "🍺":"beer",
    "👟":"shoe", "🏋️":"dumbbell", "🧭":"compass", "⭐":"star", "📝":"pencil", "📍":"pin",
    // pictos de l'interface (boutons, messages…)
    "⚙️":"gear", "🕐":"clock", "🕘":"clock", "⏰":"alarm", "⏱️":"timer", "🚫":"ban", "📌":"thumbtack", "👥":"people",
    "⚡":"bolt", "🌙":"moon", "✉️":"mail", "✍️":"pencil", "✏️":"pencil", "🔥":"fire", "🔎":"search", "🔍":"search", "🌍":"globe",
    "🏆":"trophy", "☀️":"sun", "😋":"smile", "😄":"smile", "💶":"euro", "♿":"wheelchair", "🌧️":"rain", "🤝":"handshake",
    "❤️":"heart", "💛":"heart", "♥":"heart", "📴":"offline", "🔔":"bell", "🎲":"dice", "💬":"speech", "🏙️":"city", "🍽️":"plate",
    "🗺️":"map", "🐞":"bug", "💡":"bulb", "🔒":"lock", "🛰️":"locate", "👉":"arrow", "📷":"camera", "🌱":"sprout", "🎉":"party",
    "💎":"gem", "✈️":"plane", "📲":"install", "❔":"question", "🚶":"walk", "🚗":"car", "🚲":"bike", "🌟":"star", "🏃":"shoe"
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

  // ---------- Emojis de l'interface → pictos dessinés ----------
  // Les textes de l'appli gardent leurs emojis (traductions…) : à l'affichage, chaque emoji connu devient
  // son picto. Les contenus écrits par les gens (posts, avis, pseudos, avatars, noms de lieux) ne sont pas touchés.
  const SKIP = "textarea,input,select,option,script,style,svg,title,[data-raw],.ava,.nm,.tx,.cm .t,.cm b,.rv1 .c p,.rv1 .h b,.quote,.pl,.note-u,#srchIn,.hours";
  const keys = Object.keys(FROM_EMOJI).flatMap(k => [k, k.replace(/\uFE0F/g, "")]).filter((k, i, a) => k && a.indexOf(k) === i).sort((a, b) => b.length - a.length);
  const RE = new RegExp("(" + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\uFE0F?", "g");
  const nameOf = e => FROM_EMOJI[e] || FROM_EMOJI[e + "\uFE0F"] || FROM_EMOJI[e.replace(/\uFE0F/g, "")];
  function decorate(root){
    if(!root) return;
    if(root.nodeType === 3){ swap(root); return; }
    if(root.nodeType !== 1 || root.closest(SKIP)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {acceptNode: n => {
      const p = n.parentElement; if(!p || p.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      RE.lastIndex = 0; return RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }});
    const list = []; while(w.nextNode()) list.push(w.currentNode);
    list.forEach(swap);
  }
  function swap(n){
    const p = n.parentElement; if(!p || p.closest(SKIP)) return;
    const t = n.nodeValue; RE.lastIndex = 0; if(!RE.test(t)) return;
    const frag = document.createDocumentFragment(); let last = 0; RE.lastIndex = 0; let m;
    while((m = RE.exec(t))){
      if(m.index > last) frag.appendChild(document.createTextNode(t.slice(last, m.index)));
      const sp = document.createElement("span"); sp.className = "ei"; sp.innerHTML = ico(nameOf(m[1])); frag.appendChild(sp);
      last = m.index + m[0].length;
    }
    if(last < t.length) frag.appendChild(document.createTextNode(t.slice(last)));
    n.replaceWith(frag);
  }
  if(typeof document !== "undefined" && typeof MutationObserver !== "undefined"){
    const start = () => {
      decorate(document.body);
      new MutationObserver(ms => ms.forEach(m => { if(m.type === "characterData") swap(m.target); else m.addedNodes.forEach(decorate); }))
        .observe(document.body, {childList: true, subtree: true, characterData: true});
    };
    if(document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  }
  window.ICONS = {ico, has, names: Object.keys(D), decorate};
})();
