(() => {
  "use strict";

  const feed = document.getElementById("feed");
  const sentinel = document.getElementById("sentinel");
  const topSpacer = document.getElementById("virtual-top");
  const shownCount = document.getElementById("shown-count");
  const searchOverlay = document.getElementById("search-overlay");
  const searchInput = document.getElementById("identity-input");
  const searchError = document.getElementById("search-error");
  const detailOverlay = document.getElementById("detail-overlay");
  const detailContent = document.getElementById("detail-content");

  const BATCH_SIZE = 18;
  const WINDOW_SIZE = 96;
  const PREFETCH_PX = 2600;
  const SAFE_PRUNE_PX = 1.25;
  const AUTO_SCROLL_SPEED = 58;
  const FRAG_A = ["Nyx","Vey","Astra","Noct","Vel","Ery","Zyra","Oryn","Vael","Iri","Kael","Xylo","Auri","Thal","Mira","Kyr","Sora","Elu","Riven","Aeon","Lumi","Drae","Vanta","Oris","Syl","Nexa","Ophi","Cyr","Aven","Zeph","Lyra","Qori","Neri","Vex","Alth","Yva"];
  const FRAG_B = ["avoryn","tharis","elune","oryx","aevum","ivara","ethiel","onyx","arion","uvane","ephyra","aziel","ovant","yriel","alara","isryn","evara","athen","oriel","yss","avelle","ethra","ionyx","aeris","uviel","arune","evryn","alith","orune","yvara","eon","aeris"];
  const FRAG_C = ["-V","-IX","-A","-01","-R","-Ø","-K","-N","-X","-Æ","-7","-Q","-S","-TH","-E","-LY"];
  const TYPES = ["VEILBORN","ORACLE","VOID CARTOGRAPHER","ECHO ENTITY","LUMEN KEEPER","DREAM ARCHIVIST","SYNTHETIC SOUL","STAR NOMAD","PARALLAX WITNESS","TIME DRIFTER","RELIC MIND","NIGHT SIGNAL"];
  const BIO_A = ["Keeps the last memory of a vanished constellation","Collects forgotten dreams from silent worlds","Maps the spaces between one thought and the next","Was discovered in a signal older than language","Guards a door that appears only in reflection","Remembers a future that never happened","Studies the architecture of invisible things","Carries a small fragment of the first dawn","Listens for messages buried beneath time","Exists at the edge of a sleeping universe","Catalogues the names reality has discarded","Follows the quiet pulse beneath creation"];
  const BIO_B = ["Their presence bends nearby light into slow spirals.","Nothing is known of their origin, by design.","They speak in patterns that feel strangely familiar.","Their shadow moves a moment before they do.","Every answer they give creates a better question.","They believe every ending is a door in disguise.","Their private language has no word for impossible.","They are drawn to places absent from all maps.","They leave no footprints, only faint afterimages.","Their memories arrive in the form of blue rain.","They see identity as a signal, not a fixed point.","They are quietly searching for an unmade thing."];
  const PERSONALITIES = ["Patient, observant, and almost impossible to surprise.","Curious beneath a calm exterior; drawn to unresolved mysteries.","Reserved and precise, with an unexpected tenderness for lost things.","Playful in conversation, solemn when the stars appear.","Independent, intuitive, and suspicious of easy answers.","Soft-spoken, fiercely perceptive, and loyal to forgotten promises.","Restless and inventive; happiest at the edge of the unknown.","Measured and enigmatic, with a habit of noticing what others miss."];
  const ROLES = ["Keeper of Unwritten Histories","Witness to the Quiet Collapse","Curator of Unstable Dreams","Navigator of the Hollow Between","Interpreter of Ancient Signals","Guardian of Unchosen Paths","Observer of the Ninth Horizon","Archivist of Lost Tomorrows","Cartographer of Inner Space","Custodian of Silent Worlds"];
  const COLORS = ["#a77bff","#7be4ed","#e7a4d7","#9db6ff","#d8b77c","#89e2bd","#ff9eaf","#b7a2ff","#8cc8ff","#c9d0e8","#df91ff","#83d4d0"];
  const SHAPES = ["arc","halo","orbit","shard","ring","crown"];
  const state = { generated: 0n, busy: false, firstRenderedId: 1n, topSpacerHeight: 0, runwayPending: false, activeDetail: null, lastFocus: null, averageCardHeight: 360, observer: null, resizeObserver: null, autoActive: false, autoFrame: 0, autoLastTime: 0 };
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFor(id) {
    let seed = hashString("NYXAVORYN::" + id) || 0x6d2b79f5;
    return () => {
      seed += 0x6D2B79F5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(list, r) { return list[Math.floor(r() * list.length)]; }
  function cleanId(raw) { return raw.replace(/\s+/g, ""); }
  function isPositiveIntegerString(s) { return /^[0-9]+$/.test(s) && /[1-9]/.test(s); }
  function canonicalId(s) { return s.replace(/^0+/, "") || "0"; }

  function makeProfile(rawId) {
    const id = canonicalId(String(rawId));
    const r = rngFor(id);
    const a = pick(FRAG_A, r), b = pick(FRAG_B, r), c = pick(FRAG_C, r);
    const name = (a + b + c).toUpperCase();
    const type = pick(TYPES, r);
    const color = pick(COLORS, r);
    const bio = pick(BIO_A, r) + ". " + pick(BIO_B, r);
    const personality = pick(PERSONALITIES, r);
    const role = pick(ROLES, r);
    const signature = signatureFor(id, r);
    const origin = ["The Umbral Index","Sector of Quiet Stars","The Ninth Archive","Asterion Drift","The Unmapped Fold","The Violet Expanse"][Math.floor(r()*6)];
    const anomaly = ["Temporal echo","Lucid resonance","Phase-shifted memory","Spectral alignment","Recursive dream","Quantum folklore"][Math.floor(r()*6)];
    const portrait = portraitFor(id, r, color, type);
    return { id, name, type, color, bio, personality, role, signature, origin, anomaly, portrait };
  }

  function signatureFor(id, r) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let out = "";
    // Hash-derived chunks keep the signature compact even for identifiers thousands of digits long.
    let h = hashString(id + "|signature");
    for (let i=0;i<12;i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
      out += alphabet[(h + Math.floor(r()*alphabet.length)) % alphabet.length];
    }
    return out.match(/.{1,4}/g).join("-");
  }

  function portraitFor(id, r, color, type) {
    const hue2 = pick(["#19142a","#10222a","#241323","#182033","#211a2a","#101c24"], r);
    const skin = pick(["#f0c9b5","#c98f79","#8d5c53","#e0ad92","#a96e5d","#d9b39c","#b98779"], r);
    const hair = pick(["#17121f","#282034","#5b3c75","#d0c0e0","#262b3e","#38251f","#8e6b9d"], r);
    const style = Math.floor(r()*6), outfit = pick(["#242039","#252c40","#38243e","#20343a","#3b2c32","#262a36"], r);
    const eye = pick(["#9cf1ed","#cbb2ff","#e9d7a1","#a9c7ff"], r);
    const x = 100 + Math.floor(r()*40-20), y = 96 + Math.floor(r()*14-7);
    const faceW = 43 + Math.floor(r()*12), faceH = 56 + Math.floor(r()*13);
    const eyeY = y-1, eyeGap = 14 + Math.floor(r()*4);
    const accessory = Math.floor(r()*5);
    let hairPath = [
      `M ${x-faceW} ${y+3} Q ${x-faceW-9} ${y-58} ${x} ${y-55} Q ${x+faceW+13} ${y-53} ${x+faceW} ${y+8} L ${x+faceW-9} ${y-17} Q ${x} ${y-37} ${x-faceW+7} ${y-12} Z`,
      `M ${x-faceW-5} ${y+8} Q ${x-faceW-20} ${y-60} ${x+3} ${y-57} Q ${x+faceW+19} ${y-54} ${x+faceW+4} ${y+18} L ${x+faceW-13} ${y-3} L ${x+12} ${y-27} L ${x-faceW+10} ${y+8} Z`,
      `M ${x-faceW} ${y+14} Q ${x-faceW-2} ${y-60} ${x+5} ${y-58} Q ${x+faceW+8} ${y-45} ${x+faceW} ${y+3} Q ${x+10} ${y-4} ${x-faceW} ${y+14} Z`,
      `M ${x-faceW-8} ${y+20} L ${x-faceW-3} ${y-31} Q ${x} ${y-72} ${x+faceW} ${y-33} L ${x+faceW+8} ${y+19} L ${x+faceW-18} ${y-2} L ${x} ${y-24} Z`,
      `M ${x-faceW} ${y+4} Q ${x-faceW+2} ${y-57} ${x} ${y-53} Q ${x+faceW+2} ${y-57} ${x+faceW} ${y+4} L ${x+faceW+20} ${y+44} L ${x+faceW-8} ${y+16} L ${x-faceW+8} ${y+17} L ${x-faceW-19} ${y+43} Z`,
      `M ${x-faceW} ${y+9} Q ${x-faceW-12} ${y-60} ${x+5} ${y-57} Q ${x+faceW+12} ${y-60} ${x+faceW} ${y+9} L ${x+13} ${y-24} L ${x-faceW+8} ${y-4} Z`
    ][style];
    let accessoryMarkup = "";
    if (accessory === 0) accessoryMarkup = `<path d="M ${x-faceW-4} ${y-22} Q ${x} ${y-68} ${x+faceW+5} ${y-19}" fill="none" stroke="${color}" stroke-width="2" opacity=".9"/>`;
    if (accessory === 1) accessoryMarkup = `<circle cx="${x+faceW+4}" cy="${y+5}" r="8" fill="none" stroke="${color}" stroke-width="2"/><circle cx="${x+faceW+4}" cy="${y+5}" r="2" fill="${color}"/>`;
    if (accessory === 2) accessoryMarkup = `<path d="M ${x-12} ${y+faceH+8} L ${x} ${y+faceH+22} L ${x+12} ${y+faceH+8}" fill="none" stroke="${color}" stroke-width="2"/>`;
    if (accessory === 3) accessoryMarkup = `<path d="M ${x-faceW+2} ${y+5} Q ${x} ${y+16} ${x+faceW-2} ${y+5}" fill="none" stroke="${eye}" stroke-width="2" opacity=".8"/>`;
    if (accessory === 4) accessoryMarkup = `<path d="M ${x} 18 L ${x+8} 33 L ${x} 48 L ${x-8} 33 Z" fill="${color}" opacity=".85"/>`;
    const halo = pick(SHAPES, r);
    let haloMarkup = halo === "ring" ? `<ellipse cx="${x}" cy="${y+6}" rx="74" ry="103" fill="none" stroke="${color}" stroke-width="1" opacity=".45" transform="rotate(-18 ${x} ${y})"/>` :
      halo === "orbit" ? `<ellipse cx="${x}" cy="${y+3}" rx="87" ry="42" fill="none" stroke="${color}" stroke-width="1.2" opacity=".55" transform="rotate(-29 ${x} ${y})"/>` :
      halo === "shard" ? `<path d="M ${x} 13 L ${x+71} 97 L ${x+23} 190 L ${x-68} 115 Z" fill="none" stroke="${color}" stroke-width="1" opacity=".45"/>` :
      halo === "crown" ? `<path d="M ${x-47} 43 L ${x-27} 16 L ${x} 37 L ${x+27} 16 L ${x+47} 43" fill="none" stroke="${color}" stroke-width="2" opacity=".7"/>` :
      halo === "arc" ? `<path d="M ${x-83} 145 A 86 86 0 0 1 ${x+83} 145" fill="none" stroke="${color}" stroke-width="2" opacity=".65"/>` :
      `<circle cx="${x}" cy="${y}" r="79" fill="none" stroke="${color}" stroke-width="1" opacity=".55"/>`;
    const svg = `<svg class="portrait" viewBox="0 0 280 300" role="img" aria-label="Generated portrait of ${nameSafe(id)}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="bg${hashString(id)}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${hue2}"/><stop offset="1" stop-color="#08070c"/></linearGradient><radialGradient id="gl${hashString(id)}"><stop stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><rect width="280" height="300" fill="url(#bg${hashString(id)})"/><circle cx="${x}" cy="112" r="130" fill="url(#gl${hashString(id)})"/><path d="M 0 235 L 65 184 L 92 300 L 0 300 Z M 280 222 L 214 179 L 186 300 L 280 300 Z" fill="#ffffff" opacity=".025"/>${haloMarkup}<g opacity=".22" stroke="${color}" stroke-width=".7"><path d="M 0 52 H 280 M 0 250 H 280"/><path d="M 30 0 V 300 M 250 0 V 300"/></g><path d="M ${x-57} 300 Q ${x-55} ${y+faceH+4} ${x} ${y+faceH+3} Q ${x+56} ${y+faceH+4} ${x+61} 300" fill="${outfit}"/><path d="M ${x-22} ${y+faceH-5} L ${x-18} ${y+faceH+35} L ${x+18} ${y+faceH+35} L ${x+22} ${y+faceH-5}" fill="${skin}"/><path d="M ${x-faceW} ${y-9} Q ${x-faceW-8} ${y+faceH/2} ${x-14} ${y+faceH+3} Q ${x} ${y+faceH+12} ${x+14} ${y+faceH+3} Q ${x+faceW+8} ${y+faceH/2} ${x+faceW} ${y-9} Q ${x} ${y-32} ${x-faceW} ${y-9} Z" fill="${skin}"/><path d="${hairPath}" fill="${hair}"/><path d="M ${x-eyeGap-7} ${eyeY-3} q 7 -4 14 0 M ${x+eyeGap-7} ${eyeY-3} q 7 -4 14 0" fill="none" stroke="${hair}" stroke-width="3" stroke-linecap="round"/><ellipse cx="${x-eyeGap}" cy="${eyeY+3}" rx="4" ry="2.5" fill="${eye}"/><ellipse cx="${x+eyeGap}" cy="${eyeY+3}" rx="4" ry="2.5" fill="${eye}"/><path d="M ${x} ${eyeY+5} l -4 17 l 8 1" fill="none" stroke="#714d4c" stroke-width="1.4" opacity=".65"/><path d="M ${x-8} ${y+faceH-9} Q ${x} ${y+faceH-5} ${x+8} ${y+faceH-9}" fill="none" stroke="#7e454a" stroke-width="1.5" stroke-linecap="round"/>${accessoryMarkup}<path d="M ${x-52} 300 L ${x-29} ${y+faceH+48} L ${x} 300 M ${x+52} 300 L ${x+29} ${y+faceH+48} L ${x} 300" fill="none" stroke="${color}" stroke-width="1.2" opacity=".8"/><text x="14" y="281" fill="#ffffff" opacity=".45" font-size="7" letter-spacing="2" font-family="monospace">NX / ${hashString(id).toString(16).toUpperCase()}</text></svg>`;
    return svg;
  }
  function nameSafe(id) { return "identity " + id; }

  function cardHTML(p, index) {
    return `<article class="profile-card" data-id="${escapeAttr(p.id)}" style="--accent:${p.color}" tabindex="0" role="button" aria-label="Discover ${escapeAttr(p.name)}, identity ${escapeAttr(p.id)}">
      <div class="portrait-wrap"><span class="portrait-code">NX / ${hashString(p.id).toString(16).toUpperCase()}</span><span class="portrait-type">${p.type}</span>${p.portrait}</div>
      <div class="card-body"><div class="identity-row"><span class="identity-id">IDENTITY #${escapeHTML(p.id)}</span><span class="identity-accent"></span></div><h3 class="profile-name">${escapeHTML(p.name)}</h3><p class="profile-bio">${escapeHTML(p.bio)}</p><div class="card-bottom"><span>${p.role.toUpperCase()}</span><span class="discover">↗</span></div></div>
    </article>`;
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function escapeAttr(s) { return escapeHTML(s); }

  function getColumns() {
    const w = window.innerWidth;
    if (w >= 1500) return 4;
    if (w <= 850) return 2;
    return 3;
  }

  function updateGeneratedCount() {
    shownCount.textContent = state.generated.toLocaleString("en-US") + " INDEXED";
  }

  // Append-only batches avoid rebuilding the visible feed. The sentinel always follows
  // the newest actual cards, so it can never point at an empty virtual bottom spacer.
  function appendBatch() {
    if (state.busy) return false;
    state.busy = true;
    try {
      const start = state.generated + 1n;
      const end = start + BigInt(BATCH_SIZE) - 1n;
      const fragment = document.createDocumentFragment();
      for (let id = start; id <= end; id += 1n) {
        const p = makeProfile(id.toString());
        const wrapper = document.createElement("div");
        wrapper.innerHTML = cardHTML(p, id.toString());
        const card = wrapper.firstElementChild;
        if (card) fragment.appendChild(card);
      }
      feed.appendChild(fragment);
      state.generated = end;
      if (state.firstRenderedId === 1n && state.generated === BigInt(BATCH_SIZE)) {
        // The archive begins with a real, immediately usable first batch.
        topSpacer.style.height = "0px";
      }
      updateGeneratedCount();
      return true;
    } catch (err) {
      console.error("Identity batch recovered from error:", err);
      return false;
    } finally {
      state.busy = false;
    }
  }

  function runwayDistance() {
    return sentinel.getBoundingClientRect().top - window.innerHeight;
  }

  function ensureRunway() {
    if (state.runwayPending || state.busy) return;
    state.runwayPending = true;
    requestAnimationFrame(() => {
      state.runwayPending = false;
      let batches = 0;
      try {
        // Fill ahead before the reader reaches the last rendered row. The guard prevents
        // a malformed layout from creating an unbounded synchronous loop.
        while (batches < 10 && runwayDistance() < PREFETCH_PX) {
          if (!appendBatch()) break;
          batches++;
          pruneOldRows();
        }
      } catch (err) {
        console.error("Runway recovery:", err);
      }
      // Keep retrying while the sentinel is inside the prefetch zone. This is deliberately
      // independent of IntersectionObserver so a missed callback cannot stall generation.
      if (runwayDistance() < PREFETCH_PX) {
        window.setTimeout(ensureRunway, 40);
      }
    });
  }

  // Persistent watchdog: repairs stalled observers, rapid-scroll races, and browser
  // layout timing issues. It checks distance to the real sentinel, never a fixed ID count.
  function generationWatchdog() {
    if (!document.hidden) {
      try {
        if (runwayDistance() < PREFETCH_PX && !state.busy && !state.runwayPending) ensureRunway();
      } catch (err) {
        console.error("Generation watchdog recovered:", err);
        window.setTimeout(ensureRunway, 50);
      }
    }
    window.setTimeout(generationWatchdog, 180);
  }

  function setTopSpacerHeight(value) {
    state.topSpacerHeight = Math.max(0, value);
    topSpacer.style.height = state.topSpacerHeight + "px";
    topSpacer.style.width = "100%";
  }

  function rowGroup(cards) {
    if (!cards.length) return 0;
    const firstTop = cards[0].getBoundingClientRect().top;
    let count = 1;
    // Slight tolerance permits a hovered/animated card in the first row.
    while (count < cards.length && Math.abs(cards[count].getBoundingClientRect().top - firstTop) < 7) count++;
    return count;
  }

  function pruneOldRows() {
    // Remove only complete rows comfortably above the viewport. For every removed row,
    // add its measured row pitch to the leading spacer; visible content stays in place.
    let cards = Array.from(feed.querySelectorAll(".profile-card"));
    const maxLoops = 24;
    let loops = 0;
    while (cards.length > WINDOW_SIZE && loops < maxLoops) {
      const count = rowGroup(cards);
      if (!count || cards.length - count < WINDOW_SIZE - getColumns()) break;
      const firstRect = cards[0].getBoundingClientRect();
      const lastRect = cards[count - 1].getBoundingClientRect();
      if (lastRect.bottom >= -window.innerHeight * SAFE_PRUNE_PX) break;
      // offsetTop uses layout coordinates, so entrance/hover transforms cannot introduce
      // a few pixels of cumulative scroll drift in the spacer math.
      const rowPitch = cards[count].offsetTop - cards[0].offsetTop;
      if (!(rowPitch > 0)) break;
      const newFirstId = cards[count].dataset.id;
      for (let i = 0; i < count; i++) cards[i].remove();
      state.firstRenderedId = BigInt(newFirstId);
      setTopSpacerHeight(state.topSpacerHeight + rowPitch);
      cards = Array.from(feed.querySelectorAll(".profile-card"));
      loops++;
    }
  }

  function restoreOlderRows() {
    // The leading spacer represents identities pruned from the DOM. When the visitor
    // scrolls back toward it, regenerate those exact IDs so older profiles remain browsable.
    let loops = 0;
    const maxLoops = 12;
    while (state.firstRenderedId > 1n && loops < maxLoops) {
      const spacerBottom = topSpacer.getBoundingClientRect().bottom;
      const restoreLead = Math.max(300, Math.min(PREFETCH_PX, window.innerHeight * 0.8));
      if (spacerBottom <= -restoreLead) break;
      const oldFirst = feed.firstElementChild;
      if (!oldFirst) break;
      const oldTop = oldFirst.getBoundingClientRect().top;
      const take = Math.min(getColumns(), Number(state.firstRenderedId - 1n));
      const start = state.firstRenderedId - BigInt(take);
      const fragment = document.createDocumentFragment();
      for (let id = start; id < state.firstRenderedId; id += 1n) {
        const identity = id.toString();
        const wrapper = document.createElement("div");
        wrapper.innerHTML = cardHTML(makeProfile(identity), identity);
        if (wrapper.firstElementChild) fragment.appendChild(wrapper.firstElementChild);
      }
      feed.insertBefore(fragment, oldFirst);
      // Measure the actual layout shift caused by the newly inserted row, then remove
      // precisely that much spacer. The old first card keeps its exact document position.
      const shift = oldFirst.getBoundingClientRect().top - oldTop;
      if (shift > 0) setTopSpacerHeight(state.topSpacerHeight - shift);
      state.firstRenderedId = BigInt(feed.firstElementChild.dataset.id);
      loops++;
    }
  }

  function onScroll() {
    restoreOlderRows();
    pruneOldRows();
    ensureRunway();
  }

  function autoLoop(timestamp) {
    if (!state.autoActive) return;
    if (!state.autoLastTime) state.autoLastTime = timestamp;
    const delta = Math.min(48, Math.max(0, timestamp - state.autoLastTime));
    state.autoLastTime = timestamp;
    // Leave the page still while visitors read a profile or enter a search identifier.
    const modalOpen = detailOverlay.classList.contains("open") || searchOverlay.classList.contains("open");
    if (!modalOpen && !document.hidden) {
      window.scrollBy(0, AUTO_SCROLL_SPEED * delta / 1000);
      ensureRunway();
    }
    state.autoFrame = requestAnimationFrame(autoLoop);
  }

  function setAutoGenerate(active) {
    state.autoActive = active;
    const button = document.getElementById("auto-generate");
    const label = button.querySelector(".auto-label");
    const symbol = button.querySelector(".auto-symbol");
    button.setAttribute("aria-pressed", String(active));
    button.title = active ? "Pause automatic archive exploration" : "Start automatic archive exploration";
    label.textContent = active ? "PAUSE AUTO" : "AUTO GENERATE";
    symbol.textContent = active ? "Ⅱ" : "✦";
    if (active) {
      state.autoLastTime = 0;
      if (!state.autoFrame) state.autoFrame = requestAnimationFrame(autoLoop);
      ensureRunway();
    } else {
      if (state.autoFrame) cancelAnimationFrame(state.autoFrame);
      state.autoFrame = 0;
      state.autoLastTime = 0;
    }
  }

  function openSearch() {
    state.lastFocus = document.activeElement;
    searchOverlay.classList.add("open");
    searchOverlay.setAttribute("aria-hidden", "false");
    searchError.textContent = "";
    setTimeout(() => searchInput.focus(), reducedMotion ? 0 : 120);
  }
  function closeSearch() {
    searchOverlay.classList.remove("open");
    searchOverlay.setAttribute("aria-hidden", "true");
    if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
  }
  function openDetail(p) {
    state.activeDetail = p;
    detailContent.innerHTML = `<div class="detail-hero" style="--accent:${p.color}"><div class="detail-portrait">${p.portrait}</div><div class="detail-copy"><span class="detail-label">${p.type} / CLASSIFIED RECORD</span><h2 id="detail-name">${escapeHTML(p.name)}</h2><div class="detail-id">IDENTITY #${escapeHTML(p.id)}</div><p class="detail-bio">${escapeHTML(p.bio)} ${escapeHTML(p.personality)}</p></div></div><div class="detail-grid"><div class="detail-stat"><span>IDENTITY CLASSIFICATION</span><strong>${escapeHTML(p.type)}</strong></div><div class="detail-stat"><span>KNOWN ROLE</span><strong>${escapeHTML(p.role)}</strong></div><div class="detail-stat"><span>ORIGIN SECTOR</span><strong>${escapeHTML(p.origin)}</strong></div><div class="detail-stat"><span>OBSERVED ANOMALY</span><strong>${escapeHTML(p.anomaly)}</strong></div><div class="detail-stat"><span>PERSONALITY PROFILE</span><strong>${escapeHTML(p.personality)}</strong></div><div class="detail-stat"><span>IDENTITY SIGNATURE</span><strong class="signature">${escapeHTML(p.signature)}</strong></div></div>`;
    detailOverlay.classList.add("open");
    detailOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    document.getElementById("detail-back").focus();
  }
  function closeDetail() {
    detailOverlay.classList.remove("open");
    detailOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    state.activeDetail = null;
  }
  function resolveIdentity(id) {
    const p = makeProfile(id);
    closeSearch();
    openDetail(p);
  }

  document.getElementById("search-open").addEventListener("click", openSearch);
  document.getElementById("auto-generate").addEventListener("click", () => setAutoGenerate(!state.autoActive));
  document.getElementById("search-close").addEventListener("click", closeSearch);
  document.getElementById("detail-back").addEventListener("click", closeDetail);
  searchOverlay.addEventListener("click", e => { if (e.target === searchOverlay) closeSearch(); });
  detailOverlay.addEventListener("click", e => { if (e.target === detailOverlay) closeDetail(); });
  document.getElementById("search-form").addEventListener("submit", e => {
    e.preventDefault();
    const raw = cleanId(searchInput.value);
    if (!isPositiveIntegerString(raw)) {
      searchError.textContent = "Enter a positive integer using digits 0–9. Zero is not a valid identity.";
      searchInput.setAttribute("aria-invalid", "true");
      return;
    }
    searchInput.removeAttribute("aria-invalid");
    searchError.textContent = "";
    resolveIdentity(canonicalId(raw));
  });
  feed.addEventListener("click", e => {
    const card = e.target.closest(".profile-card");
    if (card) openDetail(makeProfile(card.dataset.id));
  });
  feed.addEventListener("keydown", e => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("profile-card")) {
      e.preventDefault(); openDetail(makeProfile(e.target.dataset.id));
    }
  });
  window.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (detailOverlay.classList.contains("open")) closeDetail();
      if (searchOverlay.classList.contains("open")) closeSearch();
    }
  });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    restoreOlderRows();
    pruneOldRows();
    ensureRunway();
  }, { passive: true });

  // IntersectionObserver is an acceleration hint. Scroll-distance and timed retry paths
  // remain active if observer callbacks are missed or unsupported.
  if ("IntersectionObserver" in window) {
    state.observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) ensureRunway();
    }, { rootMargin: "1700px 0px" });
    state.observer.observe(sentinel);
  }
  if ("ResizeObserver" in window) {
    state.resizeObserver = new ResizeObserver(() => {
      const cards = feed.querySelectorAll(".profile-card");
      if (!cards.length) return;
      let sum = 0, count = 0;
      cards.forEach(card => { const h = card.getBoundingClientRect().height; if (h > 0) { sum += h; count++; } });
      if (count) state.averageCardHeight = Math.max(250, sum / count);
    });
    state.resizeObserver.observe(feed);
  }

  // Browser visibility changes pause motion but not generation reliability.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ensureRunway();
  });

  // The first batch is generated immediately. Then fill the runway before the first bottom
  // can be reached; the feed grows by real cards, never by an empty spacer.
  appendBatch();
  requestAnimationFrame(ensureRunway);
  window.setTimeout(ensureRunway, 150);
  window.setTimeout(generationWatchdog, 180);

})();