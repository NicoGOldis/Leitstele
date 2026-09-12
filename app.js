const state = {
  tick: 0,
  shift: 0,
  score: 0,
  weather: 'Klar',
  selectedIncidentId: null,
  incidents: [],
  units: {
    fire: { total: 14, busy: 0, label: 'Feuerwehr', fleets: ['ELW', 'LF 20', 'LF 10', 'RTW', 'GW-A'] },
    police: { total: 12, busy: 0, label: 'Polizei', fleets: ['Streifenwagen', 'Einsatzwagen', 'SEK', 'Mannschaft'] },
    med: { total: 15, busy: 0, label: 'Rettungsdienst', fleets: ['RTW', 'KTW', 'NEF', 'Notarzt'] },
    rescue: { total: 8, busy: 0, label: 'Technische Hilfe', fleets: ['THW', 'Bergung', 'Gerätewagen', 'Funk'] }
  },
  log: []
};

const syncMeta = {
  storageKey: 'leitstellen-command-state',
  channelName: 'leitstellen-command-sync',
  tabId: `tab-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  audioEnabled: true,
  audioContext: null,
  channel: null
};

const districtInfo = {
  Hamburg: { x: 170, y: 105 },
  Bremen: { x: 160, y: 190 },
  Berlin: { x: 500, y: 160 },
  Hannover: { x: 270, y: 200 },
  Dortmund: { x: 240, y: 295 },
  Köln: { x: 170, y: 345 },
  Frankfurt: { x: 330, y: 380 },
  München: { x: 470, y: 500 },
  Nürnberg: { x: 410, y: 430 },
  Stuttgart: { x: 260, y: 470 },
  Leipzig: { x: 425, y: 280 },
  Rostock: { x: 600, y: 110 },
  Saarbrücken: { x: 120, y: 450 },
  Erfurt: { x: 420, y: 330 },
  Magdeburg: { x: 460, y: 230 }
};

const weatherModes = ['Klar', 'Leicht bewölkt', 'Regen', 'Schneefall', 'Nebel'];

const incidentTemplates = [
  { type: 'fire', label: 'Gebäudebrand', summary: 'Rauchentwicklung in einer Wohnanlage, mehrere Personen in der Unterkunft' },
  { type: 'fire', label: 'Waldbrand', summary: 'Brandbewegung im Waldgebiet mit starkem Wind und Sichtbehinderung' },
  { type: 'fire', label: 'Kfz-Brand', summary: 'Fahrzeugbrand an Autobahn mit Gefahr durch angrenzende Tankstelle' },
  { type: 'med', label: 'Schwerer Notfall', summary: 'Person mit Atemnot, Bewusstseinsstörung und Kreislaufproblemen' },
  { type: 'med', label: 'Herzstillstand', summary: 'Reanimationsalarm mit vorausgegangener Ohnmacht und Schocklage' },
  { type: 'med', label: 'Sturz mit Verletzung', summary: 'Person nach Sturz aus Höhe, Verdacht auf mehrere Verletzungen' },
  { type: 'police', label: 'Gewalttat', summary: 'Auseinandersetzung in der Öffentlichkeit, Verdacht auf schwere Körperverletzung' },
  { type: 'police', label: 'Einbruch', summary: 'Einbruchsdverdacht in Wohnhaus, Täter möglicherweise noch in der Nähe' },
  { type: 'police', label: 'Verkehrsunfall', summary: 'Zusammenstoß auf Hauptstraße mit Personenschaden und Leitungsbrand' },
  { type: 'rescue', label: 'Baustellenunfall', summary: 'Person im Gerüstbereich eingeklemmt, Absturzgefahr und Rettung erforderlich' },
  { type: 'rescue', label: 'Kellerbrand', summary: 'Rauch im Kellerbereich mit eingeschlossener Person und elektrischer Anlage' },
  { type: 'rescue', label: 'Technischer Einsatz', summary: 'Sperrung eines Bereichs wegen defekter Anlage und unklarer Lage' },
  { type: 'fire', label: 'Industriebrand', summary: 'Feuer in Verarbeitungshalle mit brennenden Chemikalien und enger Lage' },
  { type: 'police', label: 'Entführung', summary: 'Alarm wegen möglicher Entführung mit potenzieller unmittelbarer Gefahr' },
  { type: 'med', label: 'Schwangerschaftsnotfall', summary: 'Schwangere Person mit Blutung und Kreislaufproblemen' } 
];

const districtNames = Object.keys(districtInfo);

const els = {
  clock: document.getElementById('clock'),
  score: document.getElementById('score'),
  shift: document.getElementById('shift'),
  weather: document.getElementById('weather'),
  incidentList: document.getElementById('incidentList'),
  incidentDetails: document.getElementById('incidentDetails'),
  map: document.getElementById('map'),
  radioLog: document.getElementById('radioLog'),
  resourceGrid: document.getElementById('resourceGrid'),
  selectedRegion: document.getElementById('selectedRegion'),
  incidentCount: document.getElementById('incidentCount'),
  soundToggle: document.getElementById('soundToggle'),
  syncButton: document.getElementById('syncButton')
};

function formatClock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function randomPriority() {
  const roll = Math.random();
  if (roll < 0.38) return 1;
  if (roll < 0.76) return 2;
  return 3;
}

function randomDistrict() {
  return districtNames[Math.floor(Math.random() * districtNames.length)];
}

function getRandomVehicle(kind) {
  const fleet = state.units[kind].fleets;
  return fleet[Math.floor(Math.random() * fleet.length)];
}

function makeIncident() {
  const template = incidentTemplates[Math.floor(Math.random() * incidentTemplates.length)];
  const district = randomDistrict();
  return {
    id: `einsatz-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    type: template.type,
    label: template.label,
    summary: template.summary,
    district,
    priority: randomPriority(),
    wait: 0,
    assigned: [],
    travel: 0,
    timer: 90 + Math.random() * 120,
    vehicleHint: template.type,
    createdAt: state.tick
  };
}

function ensureAudio() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!syncMeta.audioContext) {
    syncMeta.audioContext = new AudioCtor();
  }
  if (syncMeta.audioContext.state === 'suspended') {
    syncMeta.audioContext.resume();
  }
  return syncMeta.audioContext;
}

function playTone({ frequency = 880, duration = 0.22, type = 'sine', volume = 0.04, delay = 0 }) {
  if (!syncMeta.audioEnabled) return;
  const ctx = ensureAudio();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function playDispatchTone() {
  playTone({ frequency: 880, duration: 0.18, type: 'square', volume: 0.04 });
  setTimeout(() => playTone({ frequency: 660, duration: 0.18, type: 'square', volume: 0.04 }), 120);
}

function playSirenBurst() {
  playTone({ frequency: 1200, duration: 0.16, type: 'sawtooth', volume: 0.035 });
  setTimeout(() => playTone({ frequency: 900, duration: 0.14, type: 'sawtooth', volume: 0.03 }), 120);
}

function addLog(entry) {
  state.log.unshift(entry);
  state.log = state.log.slice(0, 8);
  els.radioLog.innerHTML = state.log.map(log => `<li class="log-entry"><strong>${log.time}</strong> ${log.text}</li>`).join('');
}

function getSnapshot() {
  return {
    tick: state.tick,
    shift: state.shift,
    score: state.score,
    weather: state.weather,
    selectedIncidentId: state.selectedIncidentId,
    incidents: state.incidents,
    units: state.units,
    log: state.log,
    _meta: { updatedAt: Date.now(), tabId: syncMeta.tabId }
  };
}

function persistState() {
  try {
    const payload = getSnapshot();
    localStorage.setItem(syncMeta.storageKey, JSON.stringify(payload));
    if (window.BroadcastChannel) {
      const channel = syncMeta.channel || new BroadcastChannel(syncMeta.channelName);
      syncMeta.channel = channel;
      channel.postMessage(payload);
    }
  } catch (error) {
    console.warn('Local sync unavailable:', error);
  }
}

function hydrateState(payload) {
  if (!payload || typeof payload !== 'object') return;
  if (payload._meta && payload._meta.tabId === syncMeta.tabId) return;

  state.tick = Number(payload.tick ?? state.tick);
  state.shift = Number(payload.shift ?? state.shift);
  state.score = Number(payload.score ?? state.score);
  state.weather = payload.weather || state.weather;
  state.selectedIncidentId = payload.selectedIncidentId ?? null;
  state.incidents = Array.isArray(payload.incidents) ? payload.incidents : [];
  state.units = payload.units ? {
    fire: { ...state.units.fire, ...(payload.units.fire || {}) },
    police: { ...state.units.police, ...(payload.units.police || {}) },
    med: { ...state.units.med, ...(payload.units.med || {}) },
    rescue: { ...state.units.rescue, ...(payload.units.rescue || {}) }
  } : state.units;
  state.log = Array.isArray(payload.log) ? payload.log : [];
}

function restoreRemoteState() {
  try {
    const raw = localStorage.getItem(syncMeta.storageKey);
    if (!raw) return;
    hydrateState(JSON.parse(raw));
  } catch (error) {
    console.warn('No persisted state found');
  }
}

function handlePeerState(event) {
  const payload = event && event.data ? event.data : event;
  if (!payload || !payload._meta) return;
  hydrateState(payload);
  render();
}

function setUpSync() {
  if (window.BroadcastChannel) {
    syncMeta.channel = new BroadcastChannel(syncMeta.channelName);
    syncMeta.channel.onmessage = handlePeerState;
  }
  window.addEventListener('storage', (event) => {
    if (event.key === syncMeta.storageKey && event.newValue) {
      try {
        handlePeerState(JSON.parse(event.newValue));
      } catch (error) {
        console.warn('Unable to parse local sync payload');
      }
    }
  });
}

function updateIncidentCount() {
  els.incidentCount.textContent = `${state.incidents.length} offen`;
}

function renderResources() {
  const resourceEntries = [
    ['Feuerwehr', 'fire'],
    ['Polizei', 'police'],
    ['Rettungsdienst', 'med'],
    ['Technische Hilfe', 'rescue']
  ];

  els.resourceGrid.innerHTML = resourceEntries.map(([label, key]) => {
    const unit = state.units[key];
    const free = unit.total - unit.busy;
    const statusClass = free > 0 ? 'status-available' : 'status-busy';
    const statusLabel = free > 0 ? 'bereit' : 'gebucht';
    return `
      <div class="resource-card">
        <div class="resource-name">
          <span class="dot ${key}"></span>
          <span>${label}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <span class="status-pill ${statusClass}">${statusLabel}</span>
          <span class="resource-count ${unit.busy ? 'busy' : ''}">${free}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderIncidents() {
  if (!state.incidents.length) {
    els.incidentList.innerHTML = '<li class="incident-item"><p class="incident-summary">Keine offenen Einsätze. Die Leitstelle wartet auf neue Anrufe.</p></li>';
    return;
  }

  const sorted = [...state.incidents].sort((a, b) => b.priority - a.priority || a.wait - b.wait);
  els.incidentList.innerHTML = sorted.map(incident => {
    const active = incident.id === state.selectedIncidentId ? 'active' : '';
    return `
      <li class="incident-item ${active}" data-id="${incident.id}">
        <div class="incident-topline">
          <span class="incident-type"><span class="dot ${incident.type}"></span>${incident.label}</span>
          <span class="priority-label priority-${incident.priority}">P${incident.priority}</span>
        </div>
        <div class="incident-meta">
          <span>${incident.district}</span>
          <span>${Math.max(0, Math.ceil(incident.timer - incident.travel))}s</span>
        </div>
        <p class="incident-summary">${incident.summary}</p>
      </li>
    `;
  }).join('');

  document.querySelectorAll('.incident-item[data-id]').forEach(item => {
    item.addEventListener('click', () => {
      state.selectedIncidentId = item.dataset.id;
      render();
    });
  });
}

function getPriorityLabel(priority) {
  if (priority === 1) return 'Notfall';
  if (priority === 2) return 'Akut';
  return 'Normal';
}

function formatVehicleList(assigned) {
  if (!assigned || !assigned.length) return 'Noch nicht zugewiesen';
  return assigned.map(name => `${name} (${state.units[name]?.label || name})`).join(', ');
}

function renderDetails() {
  const current = state.incidents.find(i => i.id === state.selectedIncidentId) || state.incidents[0];
  if (!current) {
    els.incidentDetails.innerHTML = `
      <div class="dispatch-header">
        <h3>Keine Auswahl</h3>
      </div>
      <div class="detail-card">
        <div class="detail-line"><span>Leitstelle</span><span class="detail-value">Wartet</span></div>
      </div>
    `;
    els.selectedRegion.textContent = 'Leitstelle';
    return;
  }

  state.selectedIncidentId = current.id;
  els.selectedRegion.textContent = `${current.district} · ${current.label}`;

  els.incidentDetails.innerHTML = `
    <div class="dispatch-header">
      <h3>${current.label}</h3>
      <span class="status-pill ${current.assigned.length ? 'status-busy' : 'status-available'}">${current.assigned.length ? 'im Einsatz' : 'offen'}</span>
    </div>
    <div class="detail-card">
      <div class="detail-line"><span>Ort</span><span class="detail-value">${current.district}</span></div>
      <div class="detail-line"><span>Priorität</span><span class="detail-value">${getPriorityLabel(current.priority)}</span></div>
      <div class="detail-line"><span>Verbleibende Zeit</span><span class="detail-value">${Math.max(0, Math.ceil(current.timer - current.travel))} s</span></div>
      <div class="detail-line"><span>Zuweisung</span><span class="detail-value">${formatVehicleList(current.assigned)}</span></div>
      <div class="detail-line"><span>Beschreibung</span><span class="detail-value">${current.summary}</span></div>
    </div>
    <div class="action-grid">
      <button class="action-btn ${current.type === 'fire' ? 'fire' : ''}" data-action="fire"><strong>Feuerwehr</strong><small>${state.units.fire.total - state.units.fire.busy} verfügbar</small></button>
      <button class="action-btn ${current.type === 'police' ? 'police' : ''}" data-action="police"><strong>Polizei</strong><small>${state.units.police.total - state.units.police.busy} verfügbar</small></button>
      <button class="action-btn ${current.type === 'med' ? 'med' : ''}" data-action="med"><strong>Rettung</strong><small>${state.units.med.total - state.units.med.busy} verfügbar</small></button>
      <button class="action-btn ${current.type === 'rescue' ? 'rescue' : ''}" data-action="rescue"><strong>Technik</strong><small>${state.units.rescue.total - state.units.rescue.busy} verfügbar</small></button>
    </div>
  `;

  document.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => assignUnit(btn.dataset.action));
  });
}

function assignUnit(kind) {
  const incident = state.incidents.find(i => i.id === state.selectedIncidentId) || state.incidents[0];
  if (!incident) return;

  if (incident.assigned.includes(kind)) {
    addLog({ time: formatClock(state.tick), text: `Für ${incident.label} ist ${state.units[kind].label} bereits im Einsatz.` });
    return;
  }

  const unit = state.units[kind];
  if (!unit || unit.total - unit.busy <= 0) {
    addLog({ time: formatClock(state.tick), text: `Für ${kind.toUpperCase()} liegen keine freien Fahrzeuge vor.` });
    return;
  }

  incident.assigned.push(kind);
  incident.travel = 0;
  unit.busy += 1;
  state.score += 20;
  addLog({ time: formatClock(state.tick), text: `${unit.label} (${getRandomVehicle(kind)}) wurde zu ${incident.label} in ${incident.district} alarmiert.` });
  playDispatchTone();
  persistState();
  render();
}

function drawMap() {
  const svgMarkup = `
    <svg id="map-svg" viewBox="0 0 760 760" preserveAspectRatio="xMidYMid meet">
      <g>
        <path class="region" data-region="Hamburg" d="M120 78 L212 52 L262 70 L250 130 L180 150 L128 120 Z"/>
        <path class="region" data-region="Bremen" d="M125 170 L205 165 L228 210 L170 232 L110 226 L102 188 Z"/>
        <path class="region" data-region="Rostock" d="M515 70 L603 43 L648 83 L620 137 L550 152 L495 118 Z"/>
        <path class="region" data-region="Berlin" d="M420 110 L568 130 L598 220 L496 248 L420 208 Z"/>
        <path class="region" data-region="Magdeburg" d="M400 210 L492 240 L518 290 L454 326 L356 300 L370 242 Z"/>
        <path class="region" data-region="Hannover" d="M180 215 L330 200 L365 290 L300 328 L210 330 L160 278 Z"/>
        <path class="region" data-region="Dortmund" d="M210 325 L312 338 L338 405 L265 445 L175 420 L155 351 Z"/>
        <path class="region" data-region="Köln" d="M120 360 L205 342 L235 422 L176 484 L92 462 L74 402 Z"/>
        <path class="region" data-region="Frankfurt" d="M270 355 L422 342 L476 416 L420 482 L324 508 L246 454 Z"/>
        <path class="region" data-region="Nürnberg" d="M355 420 L460 406 L515 470 L464 540 L365 545 L336 470 Z"/>
        <path class="region" data-region="Stuttgart" d="M250 470 L336 485 L350 565 L284 625 L216 600 L196 527 Z"/>
        <path class="region" data-region="München" d="M420 525 L556 515 L624 592 L584 672 L470 682 L410 612 Z"/>
        <path class="region" data-region="Erfurt" d="M392 304 L470 286 L518 354 L480 430 L400 420 L372 360 Z"/>
        <path class="region" data-region="Saarbrücken" d="M68 500 L142 484 L174 554 L130 610 L60 592 L42 536 Z"/>
      </g>
      <g id="districtLabels">
        <text class="region-label" x="170" y="120">Hamburg</text>
        <text class="region-label" x="125" y="205">Bremen</text>
        <text class="region-label" x="530" y="120">Rostock</text>
        <text class="region-label" x="470" y="190">Berlin</text>
        <text class="region-label" x="425" y="260">Magdeburg</text>
        <text class="region-label" x="230" y="270">Hannover</text>
        <text class="region-label" x="215" y="375">Dortmund</text>
        <text class="region-label" x="125" y="425">Köln</text>
        <text class="region-label" x="330" y="420">Frankfurt</text>
        <text class="region-label" x="380" y="500">Nürnberg</text>
        <text class="region-label" x="245" y="540">Stuttgart</text>
        <text class="region-label" x="470" y="600">München</text>
        <text class="region-label" x="397" y="365">Erfurt</text>
        <text class="region-label" x="90" y="545">Saarbrücken</text>
      </g>
      <g id="incidentPins"></g>
    </svg>
  `;
  els.map.innerHTML = svgMarkup;
  attachMapHandlers();
  renderMapPins();
}

function attachMapHandlers() {
  document.querySelectorAll('.region').forEach(region => {
    region.addEventListener('click', () => {
      const district = region.dataset.region;
      const matching = state.incidents.find(i => i.district === district);
      state.selectedIncidentId = matching ? matching.id : (state.incidents[0]?.id || null);
      render();
    });
  });
}

function renderMapPins() {
  const pins = document.getElementById('incidentPins');
  if (!pins) return;

  pins.innerHTML = state.incidents.map(incident => {
    const point = districtInfo[incident.district];
    if (!point) return '';
    const color = incident.type === 'fire' ? '#ff7a59' : incident.type === 'med' ? '#6dd3ff' : incident.type === 'police' ? '#6ea8fe' : '#9f7aea';
    return `
      <g class="map-marker ${incident.id === state.selectedIncidentId ? 'active' : ''}" data-incident="${incident.id}">
        <circle cx="${point.x}" cy="${point.y}" r="13" fill="${color}" opacity="0.14"></circle>
        <circle cx="${point.x}" cy="${point.y}" r="6" fill="${color}" stroke="#dfeffb" stroke-width="2"></circle>
      </g>
    `;
  }).join('');

  pins.querySelectorAll('[data-incident]').forEach(pin => {
    pin.addEventListener('click', () => {
      state.selectedIncidentId = pin.dataset.incident;
      render();
    });
  });

  document.querySelectorAll('.region').forEach(region => {
    const district = region.dataset.region;
    const selected = state.incidents.some(i => i.district === district && i.id === state.selectedIncidentId);
    region.classList.toggle('active', selected);
  });
}

function updateWeather() {
  state.weather = weatherModes[Math.floor((state.tick / 100) % weatherModes.length)];
}

function generateCall() {
  if (state.incidents.length < 8) {
    const next = makeIncident();
    state.incidents.push(next);
    addLog({ time: formatClock(state.tick), text: `Neuer Anruf: ${next.label} in ${next.district}.` });
    playSirenBurst();
    persistState();
  }
}

function tick() {
  state.tick += 1;
  state.shift = Math.floor(state.tick / 60);
  updateWeather();

  if (state.tick % 22 === 0) {
    generateCall();
  }

  const finished = [];
  state.incidents.forEach(incident => {
    if (incident.assigned.length) {
      incident.travel += 1;
      if (incident.travel >= incident.timer) {
        const points = incident.priority * 40 + incident.assigned.length * 15;
        state.score += points;
        addLog({ time: formatClock(state.tick), text: `Einsatz ${incident.label} in ${incident.district} abgeschlossen. ${incident.priority === 1 ? 'Erfolgreich stabilisiert.' : 'Situation unter Kontrolle.'}` });
        incident.assigned.forEach(kind => {
          if (state.units[kind]) {
            state.units[kind].busy = Math.max(0, state.units[kind].busy - 1);
          }
        });
        finished.push(incident.id);
      }
    } else {
      incident.wait += 1;
      if (incident.wait > 120 + incident.priority * 10) {
        addLog({ time: formatClock(state.tick), text: `Alarmstufe steigt: ${incident.label} in ${incident.district} ist ohne Einsatzmittel akut.` });
        state.score = Math.max(0, state.score - 12);
        incident.priority = Math.max(1, incident.priority - 1);
        playSirenBurst();
      }
    }
  });

  if (finished.length) {
    state.incidents = state.incidents.filter(incident => !finished.includes(incident.id));
    if (!state.incidents.some(item => item.id === state.selectedIncidentId)) {
      state.selectedIncidentId = state.incidents[0]?.id || null;
    }
  }

  persistState();
  render();
}

function render() {
  els.clock.textContent = formatClock(state.tick);
  els.score.textContent = String(state.score);
  els.shift.textContent = `${state.shift}h`;
  els.weather.textContent = state.weather;
  updateIncidentCount();
  renderResources();
  renderIncidents();
  renderDetails();
  renderMapPins();
  els.soundToggle.textContent = syncMeta.audioEnabled ? 'Ton: An' : 'Ton: Aus';
}

function resetToDefaultState() {
  state.tick = 0;
  state.shift = 0;
  state.score = 0;
  state.weather = 'Klar';
  state.selectedIncidentId = null;
  state.incidents = [makeIncident(), makeIncident(), makeIncident()];
  state.selectedIncidentId = state.incidents[0]?.id || null;
  state.units = {
    fire: { total: 14, busy: 0, label: 'Feuerwehr', fleets: ['ELW', 'LF 20', 'LF 10', 'RTW', 'GW-A'] },
    police: { total: 12, busy: 0, label: 'Polizei', fleets: ['Streifenwagen', 'Einsatzwagen', 'SEK', 'Mannschaft'] },
    med: { total: 15, busy: 0, label: 'Rettungsdienst', fleets: ['RTW', 'KTW', 'NEF', 'Notarzt'] },
    rescue: { total: 8, busy: 0, label: 'Technische Hilfe', fleets: ['THW', 'Bergung', 'Gerätewagen', 'Funk'] }
  };
  state.log = [];
  addLog({ time: '00:00', text: 'Leitstelle online. Einsatzlandkarte aktiviert.' });
  persistState();
}

function boot() {
  drawMap();
  setUpSync();
  restoreRemoteState();

  if (!state.incidents.length) {
    resetToDefaultState();
  } else {
    state.selectedIncidentId = state.selectedIncidentId || state.incidents[0]?.id || null;
    if (!state.log.length) {
      addLog({ time: formatClock(state.tick), text: 'Leitstelle online. Einsatzlandkarte aktiviert.' });
    }
  }

  els.soundToggle.addEventListener('click', () => {
    syncMeta.audioEnabled = !syncMeta.audioEnabled;
    if (syncMeta.audioEnabled) {
      ensureAudio();
      playDispatchTone();
    }
    render();
  });

  els.syncButton.addEventListener('click', () => {
    addLog({ time: formatClock(state.tick), text: 'Lobby-Synchronisierung manuell aktualisiert.' });
    persistState();
    render();
  });

  render();
  setInterval(tick, 1000);
}

boot();
