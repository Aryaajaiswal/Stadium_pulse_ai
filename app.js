/* ============================================================
   Stadium Pulse AI — app.js
   Simulated GenAI core + operational state engine (fully offline)
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     Utility helpers
     ---------------------------------------------------------- */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const rand = (min, max) => Math.random() * (max - min) + min;
  const randInt = (min, max) => Math.floor(rand(min, max + 1));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const pick = (arr) => arr[randInt(0, arr.length - 1)];
  const pad = (n) => String(n).padStart(2, '0');

  // Animate a numeric display from `from` to `to` over `duration` ms
  function animateValue(el, from, to, duration, format) {
    if (!el) return;
    el.classList.add('ticking');
    const start = performance.now();
    const diff = to - from;
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(Math.round(from + diff * eased));
      if (t < 1) requestAnimationFrame(step);
      else { el.textContent = format(to); el.classList.remove('ticking'); }
    }
    requestAnimationFrame(step);
  }

  function polar(cx, cy, r, angleDeg) {
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  // Build an SVG path for a donut wedge (used for bowl sections)
  function wedgePath(cx, cy, rInner, rOuter, startDeg, endDeg) {
    const p1 = polar(cx, cy, rOuter, startDeg);
    const p2 = polar(cx, cy, rOuter, endDeg);
    const p3 = polar(cx, cy, rInner, endDeg);
    const p4 = polar(cx, cy, rInner, startDeg);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return [
      `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
      `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
      'Z',
    ].join(' ');
  }

  function densityColor(level) {
    // level: 0 (empty) -> 1 (critical)
    if (level < 0.45) return '#0df2a2';
    if (level < 0.75) return '#ff9f43';
    return '#ff4d6a';
  }

  /* ----------------------------------------------------------
     Scenario presets
     ---------------------------------------------------------- */
  const SCENARIOS = {
    prematch: {
      label: 'Pre-Match — Gates Open',
      occupancy: 38, occupancyDelta: '+6%/10min',
      transitWait: 6, transitDelta: '-1min',
      energy: 61, energyDelta: '+2%',
      throughput: 420, throughputDelta: '+40/min',
      baseDensity: 0.28, spread: 0.25,
      weather: 'Clear, 24°C',
      aiLine: 'Occupancy trending nominal. Recommend holding gate staffing at baseline; pre-position two extra crew at Gate A ahead of projected 5:40pm surge.',
    },
    kickoff: {
      label: 'Kick-off Surge — Final Approach',
      occupancy: 88, occupancyDelta: '+14%/10min',
      transitWait: 14, transitDelta: '+6min',
      energy: 78, energyDelta: '+9%',
      throughput: 960, throughputDelta: '+310/min',
      baseDensity: 0.68, spread: 0.28,
      weather: 'Clear, 23°C',
      aiLine: 'Gate throughput is spiking on the East concourse. Reallocating 4 stewards from Fan Zone to Gates C/D and opening overflow lane 3 to prevent queue backlog.',
    },
    halftime: {
      label: 'Halftime Rush — Concourse Peak',
      occupancy: 91, occupancyDelta: '+1%/10min',
      transitWait: 9, transitDelta: '-2min',
      energy: 84, energyDelta: '+4%',
      throughput: 1180, throughputDelta: '+520/min',
      baseDensity: 0.72, spread: 0.22,
      weather: 'Clear, 22°C',
      aiLine: 'Concourse food-stall queues exceeding 8 minutes at Sections 110–118. Suggest dynamic pricing nudge on Stall 4-6 and directing overflow signage toward Stall 9-11, which are under-utilized.',
    },
    postmatch: {
      label: 'Post-Match Exit — Controlled Egress',
      occupancy: 22, occupancyDelta: '-58%/10min',
      transitWait: 21, transitDelta: '+11min',
      energy: 52, energyDelta: '-14%',
      throughput: 1340, throughputDelta: '+180/min',
      baseDensity: 0.55, spread: 0.35,
      weather: 'Clear, 20°C',
      aiLine: 'Initiating staggered egress protocol: releasing upper bowl sections 30 seconds ahead of lower bowl to flatten transit-hub arrival curve. Rideshare pickup zone rerouted to Lot C.',
    },
    weather: {
      label: 'Severe Weather — Shelter Protocol',
      occupancy: 95, occupancyDelta: 'holding',
      transitWait: 27, transitDelta: '+16min',
      energy: 91, energyDelta: '+22%',
      throughput: 140, throughputDelta: '-780/min',
      baseDensity: 0.8, spread: 0.15,
      weather: 'Storm Warning, 19°C',
      aiLine: 'Lightning detected within 8-mile radius. Pausing all outdoor concourse movement, activating concourse shelter-in-place messaging, and looping PA/AR announcements in 4 languages.',
    },
  };

  const SCENARIO_AI_STEPS = {
    prematch: [
      "Initializing Stadium Pulse operational framework...",
      "Analyzing gate telemetry: ingress rate nominal at 420/min.",
      "Syncing with transit dispatch: train headways at 6 minutes.",
      "Recommendation: Occupancy trending nominal. Hold gate staffing at baseline; pre-position two extra crew at Gate A ahead of projected 5:40pm surge."
    ],
    kickoff: [
      "Analyzing seat density: final approach surge detected.",
      "East concourse gate queues climbing above optimal SLA.",
      "Steward distribution map updated.",
      "Recommendation: Gate throughput is spiking on the East concourse. Reallocating 4 stewards from Fan Zone to Gates C/D and opening overflow lane 3."
    ],
    halftime: [
      "Concourse concession sensors online for halftime rush.",
      "Stall 4-6 queues flagged at 8+ minute wait times.",
      "Analyzing under-utilized alternative concession points...",
      "Recommendation: Food-stall queues exceeding 8 minutes at Sections 110–118. Directing overflow signage to under-utilized Stall 9-11."
    ],
    postmatch: [
      "Initiating egress mode: seats emptying rapidly.",
      "Rideshare queue at Lot C experiencing vehicle gridlock.",
      "Adjusting external signage and digital maps for exit routes.",
      "Recommendation: Releasing upper bowl sections 30s ahead of lower bowl. Rideshare pickup zone rerouted to Lot C."
    ],
    weather: [
      "CRITICAL: Lightning proximity alarm triggered within 8 miles.",
      "Outdoor concourse shelter-in-place protocol activated.",
      "Syncing bilingual emergency announcements to venue PA.",
      "Recommendation: Pausing all outdoor movement, activating shelter-in-place messaging, and looping PA/AR announcements in 4 languages."
    ]
  };

  const state = {
    mode: 'prematch',
    incidents: [],
    incidentSeq: 0,
    ecoPoints: 0,
    ecoMax: 55,
    chatBusy: false,
    activeTimeouts: [],
    pendingFanGreeting: false, // fires proactive message on next Fan tab open
    fanAlertMsg: null,         // set when an incident triggers a fan-alert
  };

  /* ----------------------------------------------------------
     Scenario → Fan Concierge context map
     ---------------------------------------------------------- */
  const SCENARIO_FAN_CONTEXT = {
    prematch: {
      badge: '⚡ Pre-Match',
      isAlert: false,
      greeting: 'Hello! We are currently experiencing higher traffic near Gate C. For the fastest entry to Block D, I recommend navigating to Gate A. Do you need walking directions?',
      arTarget: 'Gate A',
      arInstruction: 'Head north-west — Gate A is currently the least congested entry point.',
      arDist: '120 m',
      arAlert: false,
    },
    kickoff: {
      badge: '🔴 Kick-off',
      isAlert: true,
      greeting: 'Heads up! Seating Bowl Block D is at 98% occupancy. Please exercise caution when navigating concourses. Are you trying to find food with the shortest queues?',
      arTarget: 'My Seat',
      arInstruction: 'Bear left past the Fan Zone — concourse is busy, stay to the right.',
      arDist: '85 m',
      arAlert: true,
    },
    halftime: {
      badge: '⏸ Halftime',
      isAlert: false,
      greeting: 'Halftime! Stalls 9–11 have the shortest queues right now — under 3 minutes. Head to the North Concourse for fastest service.',
      arTarget: 'Food Stalls 9–11',
      arInstruction: 'Follow the green path — North Concourse food stalls are 60m ahead.',
      arDist: '60 m',
      arAlert: false,
    },
    postmatch: {
      badge: '🚪 Post-Match',
      isAlert: false,
      greeting: 'Thank you for attending! We expect significant delays for Metro Line 1. The Rideshare Hub currently has a 30-minute wait. Would you like to check available shuttle bus schedules for faster transit?',
      arTarget: 'Transit Hub 2',
      arInstruction: 'Exit via Gate E and follow signs to Transit Hub 2 — shuttle buses running every 8 min.',
      arDist: '210 m',
      arAlert: false,
    },
    weather: {
      badge: '⚠ Weather Alert',
      isAlert: true,
      greeting: '⚠️ Severe weather alert! All outdoor areas are temporarily closed. Please remain in the covered concourse areas. Staff will guide you to shelter zones.',
      arTarget: 'Nearest Shelter',
      arInstruction: 'Shelter in place — nearest covered area is 30m to your left.',
      arDist: '30 m',
      arAlert: true,
    },
  };

  /* ----------------------------------------------------------
     Live clock
     ---------------------------------------------------------- */
  function tickClock() {
    const now = new Date();
    $('#clockTime').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  setInterval(tickClock, 1000);
  tickClock();

  /* ----------------------------------------------------------
     Portal tab switching
     ---------------------------------------------------------- */
  function initPortalTabs() {
    const tabOps = $('#tabOps');
    const tabFan = $('#tabFan');
    const portalOps = $('#portalOps');
    const portalFan = $('#portalFan');

    function activate(tab) {
      const isOps = tab === 'ops';
      tabOps.classList.toggle('is-active', isOps);
      tabFan.classList.toggle('is-active', !isOps);
      tabOps.setAttribute('aria-selected', String(isOps));
      tabFan.setAttribute('aria-selected', String(!isOps));
      portalOps.classList.toggle('is-active', isOps);
      portalFan.classList.toggle('is-active', !isOps);

      // On switch to Fan view — inject proactive greeting & update AR
      if (!isOps) {
        updateFanContext();

        // Fire fan-alert message if an incident triggered it
        if (state.fanAlertMsg) {
          setTimeout(() => {
            addChatMessage(state.fanAlertMsg, 'bot', true);
            state.fanAlertMsg = null;
          }, 350);
        } else if (state.pendingFanGreeting) {
          const ctx = SCENARIO_FAN_CONTEXT[state.mode];
          setTimeout(() => {
            addChatMessage(ctx.greeting, 'bot', true);
            state.pendingFanGreeting = false;
          }, 350);
        }
      }
    }

    tabOps.addEventListener('click', () => activate('ops'));
    tabFan.addEventListener('click', () => activate('fan'));

    // Expose for external callers (e.g. incident fan-alert)
    window._activatePortal = activate;
  }

  /* ----------------------------------------------------------
     Fan context updater — drives AR, badge, alert from state.mode
     ---------------------------------------------------------- */
  function updateFanContext() {
    const ctx = SCENARIO_FAN_CONTEXT[state.mode];
    if (!ctx) return;

    // Scenario badge in chat header
    const badge = $('#chatScenarioBadge');
    if (badge) {
      badge.textContent = ctx.badge;
      badge.classList.toggle('is-alert', ctx.isAlert);
    }

    // AR Wayfinder destination + instruction
    const destLabel = $('#arDestLabel');
    const destDist  = $('#arDestDist');
    const instr     = $('#arInstruction');
    const pathLine  = $('#arPathLine');
    if (destLabel) destLabel.textContent = ctx.arTarget;
    if (destDist)  destDist.textContent  = ctx.arDist;
    if (instr)     instr.textContent     = ctx.arInstruction;
    if (pathLine) {
      pathLine.style.opacity = 0;
      requestAnimationFrame(() => {
        pathLine.style.transition = 'opacity 0.4s ease';
        pathLine.style.opacity = ctx.arAlert ? 0.45 : 0.85;
      });
    }

    // AR alert badge
    const arBadge = $('#arAlertBadge');
    if (arBadge) arBadge.classList.toggle('is-hidden', !ctx.arAlert);
  }

  /* ----------------------------------------------------------
     Stadium SVG map — build once, recolor on state change
     ---------------------------------------------------------- */
  const MAP_CX = 300, MAP_CY = 300;
  const BOWL_INNER = 175, BOWL_OUTER = 265;
  const SECTION_COUNT = 20;
  const GATES = 8;
  const sectionEls = [];

  function buildStaticMap() {
    const bowlGroup = $('#bowlSections');
    const gap = 2.2;
    for (let i = 0; i < SECTION_COUNT; i++) {
      const start = (360 / SECTION_COUNT) * i + gap / 2;
      const end = (360 / SECTION_COUNT) * (i + 1) - gap / 2;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', wedgePath(MAP_CX, MAP_CY, BOWL_INNER, BOWL_OUTER, start, end));
      path.setAttribute('class', 'bowl-section');
      path.setAttribute('fill', '#0df2a2');
      const sectionNum = 100 + i;
      path.addEventListener('mousemove', (e) => showTooltip(e, `Section ${sectionNum}`, path.dataset.density));
      path.addEventListener('mouseleave', hideTooltip);
      bowlGroup.appendChild(path);
      sectionEls.push(path);
    }

    // Gates
    const gateGroup = $('#mapGates');
    for (let g = 0; g < GATES; g++) {
      const angle = (360 / GATES) * g;
      const pos = polar(MAP_CX, MAP_CY, BOWL_OUTER + 26, angle);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const size = 16;
      rect.setAttribute('x', pos.x - size / 2);
      rect.setAttribute('y', pos.y - size / 2);
      rect.setAttribute('width', size);
      rect.setAttribute('height', size);
      rect.setAttribute('rx', 4);
      rect.setAttribute('class', 'map-gate');
      const label = String.fromCharCode(65 + g);
      rect.dataset.label = `Gate ${label}`;
      rect.addEventListener('mousemove', (e) => showTooltip(e, `Gate ${label}`, rect.dataset.wait));
      rect.addEventListener('mouseleave', hideTooltip);
      gateGroup.appendChild(rect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', pos.x);
      text.setAttribute('y', pos.y + 3);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'map-gate-label');
      text.textContent = label;
      gateGroup.appendChild(text);
    }

    // Transit zones (3, spaced around bottom)
    const transitGroup = $('#mapTransit');
    const transitAngles = [150, 210, 270];
    transitAngles.forEach((angle, idx) => {
      const pos = polar(MAP_CX, MAP_CY, BOWL_OUTER + 55, angle);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', pos.x - 22);
      rect.setAttribute('y', pos.y - 12);
      rect.setAttribute('width', 44);
      rect.setAttribute('height', 24);
      rect.setAttribute('rx', 6);
      rect.setAttribute('class', 'map-transit');
      rect.addEventListener('mousemove', (e) => showTooltip(e, `Transit Hub ${idx + 1}`, rect.dataset.wait));
      rect.addEventListener('mouseleave', hideTooltip);
      transitGroup.appendChild(rect);
    });

    // Food stalls (dotted around inner concourse ring)
    const foodGroup = $('#mapFood');
    for (let f = 0; f < 12; f++) {
      const angle = (360 / 12) * f + 15;
      const pos = polar(MAP_CX, MAP_CY, (BOWL_INNER + 155) / 2 + 5, angle);
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', pos.x);
      c.setAttribute('cy', pos.y);
      c.setAttribute('r', 3.2);
      c.setAttribute('class', 'map-food');
      c.addEventListener('mousemove', (e) => showTooltip(e, `Food Stall ${f + 1}`, ''));
      c.addEventListener('mouseleave', hideTooltip);
      foodGroup.appendChild(c);
    }
  }

  function showTooltip(evt, title, detail) {
    const tip = $('#mapTooltip');
    const wrap = $('.map-wrap').getBoundingClientRect();
    tip.textContent = detail ? `${title} · ${detail}` : title;
    tip.style.left = `${evt.clientX - wrap.left}px`;
    tip.style.top = `${evt.clientY - wrap.top}px`;
    tip.classList.add('is-visible');
  }
  function hideTooltip() {
    $('#mapTooltip').classList.remove('is-visible');
  }

  function recolorMap(scenario) {
    sectionEls.forEach((el) => {
      const level = clamp(scenario.baseDensity + rand(-scenario.spread, scenario.spread), 0.05, 0.98);
      el.setAttribute('fill', densityColor(level));
      el.dataset.density = `${Math.round(level * 100)}% capacity`;
      // Add pulsing glow class to critical sections
      if (level >= 0.75) {
        el.classList.add('is-critical');
      } else {
        el.classList.remove('is-critical');
      }
    });
    $$('.map-gate').forEach((g) => {
      const wait = clamp(Math.round(scenario.transitWait * rand(0.4, 1.6)), 0, 40);
      g.dataset.wait = `${wait} min wait`;
      g.setAttribute('fill', wait > 18 ? 'rgba(255,77,106,0.25)' : wait > 9 ? 'rgba(255,159,67,0.2)' : '#0a0b1e');
    });
    $$('.map-transit').forEach((t) => {
      const wait = clamp(Math.round(scenario.transitWait * rand(0.7, 1.3)), 1, 35);
      t.dataset.wait = `${wait} min headway`;
    });
    // Show/hide telemetry dots based on scenario
    const telGroup = $('#telemetryGroup');
    if (telGroup) {
      const showDots = ['kickoff', 'halftime'].includes(state.mode);
      telGroup.classList.toggle('is-active', showDots);
    }
  }

  /* ----------------------------------------------------------
     Live metrics panel
     ---------------------------------------------------------- */
  function renderMetrics(scenario) {
    const grid = $('#metricsGrid');
    const openCount = state.incidents.filter((i) => !i.resolved).length;
    const items = [
      { label: 'Seat Occupancy',  numVal: scenario.occupancy,   fmt: v => `${v}%`,     delta: scenario.occupancyDelta,  pct: scenario.occupancy, color: scenario.occupancy > 85 ? 'var(--red)' : scenario.occupancy > 60 ? 'var(--orange)' : 'var(--green)' },
      { label: 'Transit Wait',    numVal: scenario.transitWait, fmt: v => `${v} min`,   delta: scenario.transitDelta,    pct: clamp(scenario.transitWait * 3, 5, 100), color: scenario.transitWait > 18 ? 'var(--red)' : scenario.transitWait > 10 ? 'var(--orange)' : 'var(--green)' },
      { label: 'Green Energy Use',numVal: scenario.energy,      fmt: v => `${v}%`,     delta: scenario.energyDelta,     pct: scenario.energy, color: 'var(--green)' },
      { label: 'Gate Throughput', numVal: scenario.throughput,  fmt: v => `${v}/min`,  delta: scenario.throughputDelta, pct: clamp(scenario.throughput / 14, 5, 100), color: 'var(--cyan)' },
      { label: 'Weather',         numVal: null, value: scenario.weather.split(',')[0], delta: scenario.weather.split(',')[1]?.trim() || '', pct: 100, color: 'var(--cyan)' },
      { label: 'Open Incidents',  numVal: openCount,            fmt: v => `${v}`,      delta: 'live', pct: clamp(openCount * 25, 5, 100), color: 'var(--orange)' },
    ];

    // Capture previous numeric values before re-rendering
    const prevVals = $$('.metric-card__value', grid).map(el => parseFloat(el.textContent) || 0);

    grid.innerHTML = items.map((it) => {
      const displayVal = it.numVal !== null ? it.fmt(it.numVal) : it.value;
      return `
      <div class="metric-card">
        <span class="metric-card__label">${it.label}</span>
        <span class="metric-card__value">${displayVal}</span>
        <div class="metric-card__bar"><div class="metric-card__bar-fill" style="width:${it.pct}%; background:${it.color};"></div></div>
        <span class="metric-card__delta ${it.delta.includes('+') ? 'up' : it.delta.includes('-') ? 'down' : ''}">${it.delta}</span>
      </div>`;
    }).join('');

    // Animate numeric values from previous to new
    $$('.metric-card__value', grid).forEach((el, i) => {
      if (items[i].numVal !== null) {
        const prev = prevVals[i] || items[i].numVal;
        if (prev !== items[i].numVal) {
          animateValue(el, prev, items[i].numVal, 900, items[i].fmt);
        }
      }
    });

    $('#metricsUpdated').textContent = `synced ${$('#clockTime').textContent}`;
  }

  /* ----------------------------------------------------------
     OpsGenius AI feed (simulated LLM typing)
     ---------------------------------------------------------- */
  function triggerAiAnalysis(mode) {
    state.activeTimeouts = state.activeTimeouts || [];
    state.activeTimeouts.forEach(clearTimeout);
    state.activeTimeouts = [];

    const feed = $('#aiFeed');
    feed.innerHTML = ''; // clear old items

    const steps = SCENARIO_AI_STEPS[mode] || [];
    
    let delay = 0;
    steps.forEach((stepText) => {
      const timeoutId = setTimeout(() => {
        pushAiMessage(stepText, { typing: true });
      }, delay);
      
      state.activeTimeouts.push(timeoutId);
      delay += randInt(1300, 1600); // Stagger message rendering by ~1.5s
    });
  }

  function pushAiMessage(text, { typing = true } = {}) {
    const feed = $('#aiFeed');
    state.activeTimeouts = state.activeTimeouts || [];
    
    // Remove any leftover typing indicators
    $$('.ai-typing', feed).forEach(el => el.remove());

    if (typing) {
      const typingEl = document.createElement('div');
      typingEl.className = 'ai-typing';
      typingEl.innerHTML = '<span></span><span></span><span></span>';
      typingEl.style.padding = '8px 12px';
      feed.appendChild(typingEl);
      feed.scrollTop = feed.scrollHeight;

      return new Promise((resolve) => {
        const timeoutId = setTimeout(() => {
          typingEl.remove();
          appendAiMessage(text);
          resolve();
        }, rand(600, 1000));
        
        state.activeTimeouts.push(timeoutId);
      });
    } else {
      appendAiMessage(text);
      return Promise.resolve();
    }
  }

  function appendAiMessage(text) {
    const feed = $('#aiFeed');
    const el = document.createElement('div');
    el.className = 'ai-msg ai-msg--typing';
    const now = new Date();

    // Build the structure immediately but stream the text content
    const strong = document.createElement('strong');
    strong.textContent = 'OpsGenius: ';
    const textNode = document.createTextNode('');
    const cursor = document.createElement('span');
    cursor.className = 'ai-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    const timeEl = document.createElement('time');
    timeEl.style.display = 'none';
    timeEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    el.appendChild(strong);
    el.appendChild(textNode);
    el.appendChild(cursor);
    el.appendChild(timeEl);
    feed.appendChild(el);

    while (feed.children.length > 10) feed.removeChild(feed.firstChild);
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });

    // Typewriter: stream characters at ~38ms each
    let i = 0;
    const speed = Math.max(18, Math.min(42, Math.round(1400 / text.length)));
    const interval = setInterval(() => {
      textNode.textContent = text.slice(0, ++i);
      feed.scrollTop = feed.scrollHeight;
      if (i >= text.length) {
        clearInterval(interval);
        cursor.remove();
        timeEl.style.display = '';
        el.classList.remove('ai-msg--typing');
      }
    }, speed);
  }

  /* ----------------------------------------------------------
     Incident log
     ---------------------------------------------------------- */
  const INCIDENT_TEMPLATES = {
    prematch: [
      { title: 'Minor queue buildup at Gate B', severity: 'low' },
      { title: 'Wheelchair assist requested — Section 104', severity: 'low' },
    ],
    kickoff: [
      { title: 'Congestion forming at Gate C bag-check', severity: 'mid' },
      { title: 'Ticket scanner offline — Lane 7', severity: 'mid' },
      { title: 'Lost child reported near Fan Zone', severity: 'high' },
    ],
    halftime: [
      { title: 'Food stall 4-6 queue exceeding 8 min', severity: 'mid' },
      { title: 'Restroom flooding — Concourse Level 2', severity: 'high' },
      { title: 'Medical assist requested — Section 214', severity: 'high' },
    ],
    postmatch: [
      { title: 'Transit hub overcrowding — Hub 2', severity: 'high' },
      { title: 'Rideshare zone gridlock — Lot C', severity: 'mid' },
    ],
    weather: [
      { title: 'Lightning proximity alert — outdoor concourse', severity: 'high' },
      { title: 'Shelter capacity nearing limit — West Concourse', severity: 'high' },
      { title: 'Roof drainage sensor flagged — Section 118', severity: 'mid' },
    ],
  };

  function seedIncidents(mode) {
    state.incidents = [];
    const templates = INCIDENT_TEMPLATES[mode] || [];
    templates.forEach((t) => {
      state.incidentSeq += 1;
      state.incidents.push({
        id: state.incidentSeq,
        title: t.title,
        severity: t.severity,
        resolved: false,
        time: new Date(),
      });
    });
    renderIncidents();
  }

  function renderIncidents() {
    const list = $('#incidentList');
    list.innerHTML = state.incidents.map((inc) => {
      const fanBtn = inc.severity === 'high' && !inc.resolved
        ? `<button class="incident-fan-alert" data-action="fan-alert" data-id="${inc.id}" title="Switch to Fan view with alert">🔗 Fan Alert</button>`
        : '';
      return `
      <li class="incident-item ${inc.resolved ? 'is-resolved' : ''}" data-id="${inc.id}">
        <div class="incident-item__info">
          <span class="incident-item__title">${inc.title}</span>
          <span class="incident-item__meta">#${String(inc.id).padStart(3, '0')} · ${pad(inc.time.getHours())}:${pad(inc.time.getMinutes())} <span class="incident-badge incident-badge--${inc.severity}">${inc.severity}</span></span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          ${fanBtn}
          <button class="incident-resolve" ${inc.resolved ? 'disabled' : ''} data-action="resolve" data-id="${inc.id}">
            ${inc.resolved ? '✓ Resolved' : 'Resolve with AI'}
          </button>
        </div>
      </li>`;
    }).join('');
    const openCount = state.incidents.filter((i) => !i.resolved).length;
    $('#incidentCount').textContent = `${openCount} open`;
  }

  const RESOLUTION_LINES = [
    'Dispatched nearest available steward; ETA 90 seconds.',
    'Rerouted foot traffic via digital signage and PA announcement.',
    'Escalated to on-site medical/security team; incident acknowledged.',
    'Auto-adjusted staffing allocation to relieve the affected zone.',
    'Notified venue operations lead and logged for post-match review.',
  ];

  function resolveIncident(id) {
    const inc = state.incidents.find((i) => i.id === id);
    if (!inc || inc.resolved) return;

    // Step 1: Show analyzing spinner on the button
    const btn = $(`[data-action="resolve"][data-id="${id}"]`);
    if (btn) {
      btn.textContent = '[Analyzing…]';
      btn.classList.add('is-analyzing');
    }

    // Step 2: After a brief delay, commit the resolution
    setTimeout(() => {
      inc.resolved = true;
      renderIncidents();
      renderMetrics(SCENARIOS[state.mode]);
      const resolutionText = `Incident #${String(id).padStart(3, '0')} ("${inc.title}") resolved. ${pick(RESOLUTION_LINES)}`;
      pushAiMessage(resolutionText);
    }, randInt(1100, 1600));
  }

  /* ----------------------------------------------------------
     Simulation mode switching
     ---------------------------------------------------------- */
  function applyScenario(mode) {
    state.mode = mode;
    state.pendingFanGreeting = true; // arm proactive message for next Fan tab switch
    const scenario = SCENARIOS[mode];
    $('#simStatusValue').textContent = scenario.label;
    $$('.sim-mode').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.mode === mode));
    recolorMap(scenario);
    renderMetrics(scenario);
    seedIncidents(mode);
    triggerAiAnalysis(mode);

    // If Fan tab is already active, update context immediately
    if ($('#portalFan').classList.contains('is-active')) {
      updateFanContext();
      const ctx = SCENARIO_FAN_CONTEXT[mode];
      if (ctx) addChatMessage(ctx.greeting, 'bot', true);
      state.pendingFanGreeting = false;
    }
  }

  function initSimController() {
    $('#simModes').addEventListener('click', (e) => {
      const btn = e.target.closest('.sim-mode');
      if (!btn) return;
      applyScenario(btn.dataset.mode);
    });
  }

  function initIncidentPanel() {
    $('#incidentList').addEventListener('click', (e) => {
      // Resolve with AI
      const resolveBtn = e.target.closest('[data-action="resolve"]');
      if (resolveBtn) { resolveIncident(Number(resolveBtn.dataset.id)); return; }

      // Fan Alert — switch to Fan view with priority message
      const fanBtn = e.target.closest('[data-action="fan-alert"]');
      if (fanBtn) {
        const inc = state.incidents.find(i => i.id === Number(fanBtn.dataset.id));
        if (inc) {
          state.fanAlertMsg = `⚠️ A priority alert has been issued: “${inc.title}”. Staff are responding. Please stay aware of your surroundings.`;
          if (typeof window._activatePortal === 'function') window._activatePortal('fan');
        }
      }
    });
  }

  // periodic ambient refresh of metrics + occasional AI commentary
  const AMBIENT_LINES = [
    'Crowd-flow model re-calibrated; no anomalies detected in the last cycle.',
    'Sustainability index holding steady — solar contribution at expected levels for this hour.',
    'Cross-checking gate scan rates against ticketing manifest — all nominal.',
    'Predictive model suggests next surge point in approximately 12 minutes.',
  ];
  setInterval(() => {
    if (!$('#portalOps').classList.contains('is-active')) return;
    const scenario = SCENARIOS[state.mode];
    recolorMap(scenario);
    renderMetrics(scenario);
    const isTyping = $('.ai-typing', $('#aiFeed'));
    if (!isTyping && Math.random() < 0.35) pushAiMessage(pick(AMBIENT_LINES));
  }, 8000);

  /* ----------------------------------------------------------
     Fan Companion chatbot
     ---------------------------------------------------------- */
  const CHAT_RESPONSES = {
    transit: [
      'The nearest transit hub is Hub 2, about 4 minutes on foot from your gate. Rail departures are running every 6–8 minutes this evening.',
      'Parking Lot C still has availability. Shuttle buses run continuously to Lots D and E — expect a 10 minute ride during peak exit.',
    ],
    accessibility: [
      'Accessible seating and companion seats are available near Sections 104, 118, and 214. I can flag a steward to meet you at your gate if you\'d like.',
      'Elevators are operating at all four concourse cores. The nearest accessible restroom to you is 60 meters past Gate C.',
    ],
    queue: [
      'Gate C is currently the fastest entry point at roughly 4 minutes. Gate A has a longer line, closer to 12 minutes, due to bag-check volume.',
      'Concession queues are shortest at Stalls 9–11 right now — about half the wait of the main concourse stalls.',
    ],
    sustainability: [
      'Refill stations are located every 40 meters along the main concourse — using one instead of buying a bottle earns you Eco-Tracker points.',
      'Taking the train instead of rideshare tonight cuts your trip\'s footprint by roughly 70%, and logs points on your Eco-Tracker.',
    ],
    seat: [
      'Tell me your section and row and I\'ll route you the fastest way there — or tap "My Seat" in the AR Wayfinder for turn-by-turn guidance.',
      'Your seat can also be found by scanning the QR code on your digital ticket for a live AR overlay from your current position.',
    ],
    greeting: [
      'Hi! I\'m your Fan Companion — ask me about gates, transit, food, accessibility, or your seat, and I\'ll help you get there.',
    ],
    fallback: [
      'I want to make sure I get that right — could you tell me a bit more, or tap one of the quick prompts below?',
      'I can help with transit, gates, accessibility, sustainability, or finding your seat. Which would be most useful right now?',
    ],
  };

  function classifyMessage(msg) {
    const m = msg.toLowerCase();
    if (/transit|bus|train|shuttle|park/.test(m)) return 'transit';
    if (/access|wheelchair|disab|elevator/.test(m)) return 'accessibility';
    if (/queue|wait|line|gate/.test(m)) return 'queue';
    if (/green|sustain|eco|recycle|carbon/.test(m)) return 'sustainability';
    if (/seat|section|row/.test(m)) return 'seat';
    if (/hi|hello|hey/.test(m)) return 'greeting';
    return 'fallback';
  }

  function addChatMessage(text, who, proactive = false) {
    const win = $('#chatWindow');
    const el = document.createElement('div');
    el.className = `chat-msg chat-msg--${who}${proactive ? ' chat-msg--proactive' : ''}`;
    el.textContent = text;
    win.appendChild(el);
    win.scrollTop = win.scrollHeight;
  }

  function botReply(userText) {
    if (state.chatBusy) return;
    state.chatBusy = true;
    const win = $('#chatWindow');
    const typing = document.createElement('div');
    typing.className = 'ai-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    typing.style.padding = '8px 13px';
    win.appendChild(typing);
    win.scrollTop = win.scrollHeight;

    setTimeout(() => {
      typing.remove();
      const category = classifyMessage(userText);
      const reply = pick(CHAT_RESPONSES[category]);
      addChatMessage(reply, 'bot');
      state.chatBusy = false;
    }, rand(600, 1100));
  }

  function initChat() {
    addChatMessage(CHAT_RESPONSES.greeting[0], 'bot');

    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#chatInput');
      const text = input.value.trim();
      if (!text) return;
      addChatMessage(text, 'user');
      input.value = '';
      botReply(text);
    });

    $('#quickPrompts').addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-prompt');
      if (!btn) return;
      const label = btn.textContent.trim();
      addChatMessage(label, 'user');
      botReply(btn.dataset.prompt);
    });
  }

  /* ----------------------------------------------------------
     AR Wayfinder
     ---------------------------------------------------------- */
  const AR_INSTRUCTIONS = [
    'Head north-east toward the concourse ramp',
    'Continue straight past the merchandise stand',
    'Bear left at the next junction, then follow the cyan path',
    'Almost there — destination is 20 meters ahead on your right',
  ];

  function initAR() {
    $$('.ar-target').forEach((btn) => {
      btn.addEventListener('click', () => {
        $('#arDestLabel').textContent = btn.dataset.target;
        $('#arDestDist').textContent = `${randInt(40, 220)} m`;
        $('#arInstruction').textContent = pick(AR_INSTRUCTIONS);
        const path = $('#arPathLine');
        path.style.opacity = 0;
        requestAnimationFrame(() => { path.style.transition = 'opacity 0.3s ease'; path.style.opacity = 0.85; });
      });
    });
  }

  /* ----------------------------------------------------------
     Eco-Tracker
     ---------------------------------------------------------- */
  const ECO_RING_CIRC = 2 * Math.PI * 52; // matches r=52 in SVG
  const ECO_TIERS = [
    { min: 0, label: 'Complete actions to unlock fan reward tiers.' },
    { min: 30, label: 'Bronze tier unlocked — 10% off concession stalls.' },
    { min: 65, label: 'Silver tier unlocked — free transit day-pass code.' },
    { min: 90, label: 'Gold tier unlocked — priority merchandise access.' },
  ];

  function updateEcoRing() {
    const pct = clamp(Math.round((state.ecoPoints / state.ecoMax) * 100), 0, 100);
    const offset = ECO_RING_CIRC - (ECO_RING_CIRC * pct) / 100;
    $('#ecoRingProgress').style.strokeDasharray = `${ECO_RING_CIRC}`;
    $('#ecoRingProgress').style.strokeDashoffset = `${offset}`;
    $('#ecoPercent').textContent = `${pct}%`;
    $('#ecoScoreLabel').textContent = `${state.ecoPoints} pts`;
    const tier = [...ECO_TIERS].reverse().find((t) => pct >= t.min);
    $('#ecoNote').textContent = tier.label;
  }

  function initEcoTracker() {
    updateEcoRing();
    $('.eco-actions').addEventListener('click', (e) => {
      const btn = e.target.closest('.eco-action');
      if (!btn || btn.disabled) return;
      const points = Number(btn.dataset.points);
      const ecoType = btn.dataset.eco;
      state.ecoPoints += points;
      btn.disabled = true;
      btn.querySelector('.eco-pts').textContent = '✓';
      updateEcoRing();

      // Transit check-in — post confirmation to Fan Companion chat
      if (ecoType === 'transit') {
        setTimeout(() => {
          addChatMessage(
            'Transit check-in confirmed! 🌟 You just earned sustainable choice points towards exclusive FIFA World Cup 2026 rewards.',
            'bot'
          );
        }, 400);
      }
    });
  }

  /* ----------------------------------------------------------
     Live pitch telemetry (player dots)
     ---------------------------------------------------------- */
  // Pitch bounds: ellipse cx=300 cy=300 rx=145 ry=100
  const TELEMETRY_DOTS = [
    { id: 'telDotA1', x: 265, y: 295, vx: 0.35, vy: -0.2  },
    { id: 'telDotA2', x: 310, y: 285, vx: -0.2, vy: 0.3   },
    { id: 'telDotB1', x: 335, y: 315, vx: -0.4, vy: -0.15 },
    { id: 'telDotB2', x: 278, y: 318, vx: 0.25, vy: -0.35 },
    { id: 'telBall',  x: 300, y: 300, vx: 0.55, vy: 0.4   },
  ];
  const PITCH_CX = 300, PITCH_CY = 300, PITCH_RX = 142, PITCH_RY = 98;

  function stepTelemetry(speedMult) {
    TELEMETRY_DOTS.forEach(dot => {
      dot.x += dot.vx * speedMult;
      dot.y += dot.vy * speedMult;
      // Bounce off pitch ellipse boundary
      const nx = (dot.x - PITCH_CX) / PITCH_RX;
      const ny = (dot.y - PITCH_CY) / PITCH_RY;
      if (nx * nx + ny * ny > 0.88) {
        dot.vx += (PITCH_CX - dot.x) * 0.008;
        dot.vy += (PITCH_CY - dot.y) * 0.008;
      }
      // Speed cap + random jitter
      dot.vx = clamp(dot.vx + rand(-0.04, 0.04), -1.2, 1.2);
      dot.vy = clamp(dot.vy + rand(-0.04, 0.04), -1.2, 1.2);
    });
  }

  function renderTelemetry() {
    TELEMETRY_DOTS.forEach(dot => {
      const el = document.getElementById(dot.id);
      if (el) { el.setAttribute('cx', dot.x.toFixed(1)); el.setAttribute('cy', dot.y.toFixed(1)); }
    });
  }

  // Scenarios with active play get faster dots; weather stops movement
  const TELEMETRY_SPEED = { prematch: 0, kickoff: 1.2, halftime: 0.65, postmatch: 0.3, weather: 0 };
  let telFrameId = null;

  function telemetryLoop() {
    const speed = TELEMETRY_SPEED[state.mode] ?? 0;
    if (speed > 0) {
      stepTelemetry(speed);
      renderTelemetry();
    }
    telFrameId = requestAnimationFrame(telemetryLoop);
  }

  function initTelemetry() {
    telemetryLoop();
  }

  /* ----------------------------------------------------------
     Init
     ---------------------------------------------------------- */
  function init() {
    initPortalTabs();
    buildStaticMap();
    initSimController();
    initIncidentPanel();
    initChat();
    initAR();
    initEcoTracker();
    initTelemetry();
    applyScenario('prematch');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
