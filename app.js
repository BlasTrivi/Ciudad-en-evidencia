const STORAGE_KEY = 'ciudad-en-evidencia-reportes';
const SUPPORT_STORAGE_KEY = 'ciudad-en-evidencia-apoyos';

const CATEGORIES = [
  'Pozo',
  'Calle rota',
  'Cable caído',
  'Árbol sin podar',
  'Luminaria rota',
  'Basura acumulada',
  'Pérdida de agua',
  'Semáforo dañado',
  'Vereda destruida',
  'Otro'
];

const STATUSES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'en_arreglo', label: 'En arreglo' },
  { value: 'resuelto', label: 'Resuelto' }
];

const SEVERITIES = ['Baja', 'Media', 'Alta'];

const DEFAULT_CENTER = [-32.9442, -60.6505]; // Rosario

const state = {
  reports: [],
  filteredReports: [],
  selectedCoords: null,
  supportedReports: new Set(),
  visualMode: 'mixed',
  markers: new Map(),
  heatLayer: null,
  hotspotLayer: null,
  focusPulse: null,
  tempMarker: null,
  map: null,
};

const el = {
  sidebar: document.querySelector('.sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  openReportBtn: document.getElementById('openReportBtn'),
  reportModal: document.getElementById('reportModal'),
  detailsModal: document.getElementById('detailsModal'),
  reportForm: document.getElementById('reportForm'),
  reportsList: document.getElementById('reportsList'),
  reportCardTemplate: document.getElementById('reportCardTemplate'),
  category: document.getElementById('category'),
  severity: document.getElementById('severity'),
  status: document.getElementById('status'),
  categoryFilter: document.getElementById('categoryFilter'),
  statusFilter: document.getElementById('statusFilter'),
  severityFilter: document.getElementById('severityFilter'),
  searchInput: document.getElementById('searchInput'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),
  useCurrentLocationBtn: document.getElementById('useCurrentLocationBtn'),
  selectedCoords: document.getElementById('selectedCoords'),
  lat: document.getElementById('lat'),
  lng: document.getElementById('lng'),
  detailsTitle: document.getElementById('detailsTitle'),
  detailsContent: document.getElementById('detailsContent'),
  totalReports: document.getElementById('totalReports'),
  pendingReports: document.getElementById('pendingReports'),
  resolvedReports: document.getElementById('resolvedReports'),
  reportsCountBadge: document.getElementById('reportsCountBadge'),
  locateBtn: document.getElementById('locateBtn'),
  seedDataBtn: document.getElementById('seedDataBtn'),
  clearDataBtn: document.getElementById('clearDataBtn'),
  imageInput: document.getElementById('image'),
  visualModeButtons: Array.from(document.querySelectorAll('[data-visual-mode]')),
  heatLegend: document.getElementById('heatLegend'),
  mapClickPrompt: document.getElementById('mapClickPrompt'),
  mapClickPromptCoords: document.getElementById('mapClickPromptCoords'),
  openFormFromMapBtn: document.getElementById('openFormFromMapBtn'),
  closeMapPromptBtn: document.getElementById('closeMapPromptBtn'),
};

function init() {
  syncViewportHeight();
  populateSelects();
  setupMap();
  setupEvents();
  loadReports();
  loadSupportedReports();
  render();
  queueMapResizeFix();
}

function populateSelects() {
  CATEGORIES.forEach((category) => {
    el.category.add(new Option(category, category));
    el.categoryFilter.add(new Option(category, category));
  });

  SEVERITIES.forEach((severity) => {
    el.severity.add(new Option(severity, severity));
    el.severityFilter.add(new Option(severity, severity));
  });

  STATUSES.forEach((status) => {
    el.status.add(new Option(status.label, status.value));
    el.statusFilter.add(new Option(status.label, status.value));
  });

  el.status.value = 'pendiente';
  el.severity.value = 'Media';
}

function setupMap() {
  state.map = L.map('map', { zoomControl: false }).setView(DEFAULT_CENTER, 13);
  L.control.zoom({ position: 'bottomright' }).addTo(state.map);

  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: '&copy; Esri & contributors'
  }).addTo(state.map);

  state.map.on('click', (event) => {
    setSelectedCoords(event.latlng.lat, event.latlng.lng, true);
    openMapClickPrompt();
  });
}

function setupEvents() {
  el.openReportBtn.addEventListener('click', () => openReportModal({ preserveCoords: true }));
  el.toggleSidebarBtn.addEventListener('click', () => toggleSidebar());
  el.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
  el.reportForm.addEventListener('submit', handleSubmit);
  el.useCurrentLocationBtn.addEventListener('click', useCurrentLocation);
  el.locateBtn.addEventListener('click', locateUserOnMap);
  el.resetFiltersBtn.addEventListener('click', resetFilters);
  el.seedDataBtn.addEventListener('click', seedDemoData);
  el.clearDataBtn.addEventListener('click', clearAllData);
  el.openFormFromMapBtn.addEventListener('click', () => openReportModal({ preserveCoords: true }));
  el.closeMapPromptBtn.addEventListener('click', closeMapClickPrompt);
  el.visualModeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setVisualMode(button.dataset.visualMode);
    });
  });
  el.imageInput?.addEventListener('change', () => {
    setTimeout(queueMapResizeFix, 100);
    setTimeout(queueMapResizeFix, 350);
  });

  [el.categoryFilter, el.statusFilter, el.severityFilter, el.searchInput].forEach((node) => {
    node.addEventListener('input', render);
  });

  [el.lat, el.lng].forEach((node) => {
    node.addEventListener('input', () => {
      const lat = Number(el.lat.value);
      const lng = Number(el.lng.value);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        setSelectedCoords(lat, lng, false);
      }
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      closeModal(el.reportModal);
      closeModal(el.detailsModal);
    });
  });

  [el.reportModal, el.detailsModal].forEach((modal) => {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal);
    });
  });

  window.addEventListener('resize', queueMapResizeFix);
  window.addEventListener('orientationchange', queueMapResizeFix);
  window.addEventListener('focus', queueMapResizeFix);
  window.addEventListener('pageshow', queueMapResizeFix);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      queueMapResizeFix();
    }
  });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', queueMapResizeFix);
    window.visualViewport.addEventListener('scroll', queueMapResizeFix);
  }
}

function syncViewportHeight() {
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
}

function queueMapResizeFix() {
  syncViewportHeight();
  if (!state.map) return;

  requestAnimationFrame(() => {
    state.map.invalidateSize({ pan: false, animate: false });
  });

  setTimeout(() => {
    if (!state.map) return;
    state.map.invalidateSize({ pan: false, animate: false });
  }, 220);

  setTimeout(() => {
    if (!state.map) return;
    state.map.invalidateSize({ pan: false, animate: false });
  }, 650);
}

function loadReports() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    state.reports = data.map((report) => ({
      ...report,
      votes: Number.isFinite(report.votes) ? report.votes : 1,
    }));
  } catch {
    state.reports = [];
  }
}

function loadSupportedReports() {
  try {
    const data = JSON.parse(localStorage.getItem(SUPPORT_STORAGE_KEY));
    if (Array.isArray(data)) {
      state.supportedReports = new Set(data);
      return;
    }
    state.supportedReports = new Set();
  } catch {
    state.supportedReports = new Set();
  }
}

function saveReports() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.reports));
}

function saveSupportedReports() {
  localStorage.setItem(SUPPORT_STORAGE_KEY, JSON.stringify([...state.supportedReports]));
}

function openReportModal({ preserveCoords = false } = {}) {
  el.reportForm.reset();
  el.status.value = 'pendiente';
  el.severity.value = 'Media';

  if (!preserveCoords) {
    setSelectedCoords(null, null);
  } else if (state.selectedCoords) {
    setSelectedCoords(state.selectedCoords.lat, state.selectedCoords.lng);
  }

  closeMapClickPrompt();
  toggleSidebar(false);
  openModal(el.reportModal);

  requestAnimationFrame(() => {
    document.getElementById('title')?.focus();
  });
}

function openModal(modal) {
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  queueMapResizeFix();
}

function closeModal(modal) {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  queueMapResizeFix();
}

function openMapClickPrompt() {
  if (!state.selectedCoords) return;
  el.mapClickPromptCoords.textContent = `${state.selectedCoords.lat.toFixed(6)}, ${state.selectedCoords.lng.toFixed(6)}`;
  el.mapClickPrompt.classList.remove('hidden');
}

function closeMapClickPrompt() {
  el.mapClickPrompt.classList.add('hidden');
}

function setSelectedCoords(lat, lng, shouldPan = false) {
  if (lat == null || lng == null) {
    state.selectedCoords = null;
    el.selectedCoords.textContent = 'Sin ubicación seleccionada.';
    el.lat.value = '';
    el.lng.value = '';
    if (state.tempMarker) {
      state.map.removeLayer(state.tempMarker);
      state.tempMarker = null;
    }
    closeMapClickPrompt();
    return;
  }

  state.selectedCoords = { lat: Number(lat), lng: Number(lng) };
  el.lat.value = Number(lat).toFixed(6);
  el.lng.value = Number(lng).toFixed(6);
  el.selectedCoords.textContent = `Ubicación seleccionada: ${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;

  if (state.tempMarker) state.map.removeLayer(state.tempMarker);
  state.tempMarker = L.marker([lat, lng]).addTo(state.map).bindPopup('Ubicación seleccionada');

  if (shouldPan) {
    state.map.flyTo([lat, lng], Math.max(state.map.getZoom(), 16), { duration: 0.8 });
    state.tempMarker.openPopup();
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      setSelectedCoords(latitude, longitude, true);
      openMapClickPrompt();
    },
    () => alert('No se pudo obtener tu ubicación.')
  );
}

function locateUserOnMap() {
  if (!navigator.geolocation) {
    alert('Tu navegador no soporta geolocalización.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      state.map.flyTo([latitude, longitude], 16, { duration: 1 });
      L.circleMarker([latitude, longitude], {
        radius: 7,
        weight: 2,
        fillOpacity: 0.95,
        color: '#ffffff',
        fillColor: '#2563eb'
      }).addTo(state.map).bindPopup('Estás acá').openPopup();
    },
    () => alert('No se pudo obtener tu ubicación.')
  );
}

async function handleSubmit(event) {
  event.preventDefault();

  const formData = new FormData(el.reportForm);
  const imageFile = formData.get('image');

  if (!el.lat.value || !el.lng.value) {
    alert('Seleccioná una ubicación en el mapa antes de guardar.');
    return;
  }

  const report = {
    id: crypto.randomUUID(),
    title: formData.get('title').trim(),
    category: formData.get('category'),
    severity: formData.get('severity'),
    status: formData.get('status'),
    lat: Number(formData.get('lat')),
    lng: Number(formData.get('lng')),
    description: formData.get('description').trim(),
    image: imageFile && imageFile.size > 0 ? await fileToBase64(imageFile) : '',
    createdAt: new Date().toISOString(),
    votes: 1,
  };

  state.reports.unshift(report);
  saveReports();
  closeModal(el.reportModal);
  closeMapClickPrompt();
  render();
  queueMapResizeFix();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getFilteredReports() {
  const search = el.searchInput.value.trim().toLowerCase();
  return state.reports.filter((report) => {
    const matchesSearch = !search || [report.title, report.description, report.category].join(' ').toLowerCase().includes(search);
    const matchesCategory = el.categoryFilter.value === 'all' || report.category === el.categoryFilter.value;
    const matchesStatus = el.statusFilter.value === 'all' || report.status === el.statusFilter.value;
    const matchesSeverity = el.severityFilter.value === 'all' || report.severity === el.severityFilter.value;
    return matchesSearch && matchesCategory && matchesStatus && matchesSeverity;
  });
}

function render() {
  state.filteredReports = getFilteredReports();
  renderStats();
  renderReportsList();
  renderMapLayers();
}

function setVisualMode(mode) {
  const allowedModes = new Set(['markers', 'heat', 'mixed']);
  if (!allowedModes.has(mode)) return;
  if (state.visualMode === mode) return;

  state.visualMode = mode;
  renderMapLayers();
  queueMapResizeFix();
}

function renderMapLayers() {
  renderMarkers();
  renderHeatLayer();
  renderHotspotShapes();
  updateVisualModeUI();
}

function renderStats() {
  el.totalReports.textContent = state.reports.length;
  el.pendingReports.textContent = state.reports.filter((r) => r.status !== 'resuelto').length;
  el.resolvedReports.textContent = state.reports.filter((r) => r.status === 'resuelto').length;
  el.reportsCountBadge.textContent = state.filteredReports.length;
}

function renderReportsList() {
  el.reportsList.innerHTML = '';

  if (!state.filteredReports.length) {
    el.reportsList.innerHTML = '<div class="empty-state">No hay reportes que coincidan con los filtros.</div>';
    return;
  }

  state.filteredReports.forEach((report) => {
    const fragment = el.reportCardTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.report-card');
    fragment.querySelector('.report-title').textContent = report.title;
    fragment.querySelector('.report-meta').textContent = `${report.category} • ${formatStatus(report.status)} • ${formatDate(report.createdAt)}`;
    fragment.querySelector('.report-description').textContent = report.description;

    const severityBadge = fragment.querySelector('.severity-badge');
    severityBadge.textContent = report.severity;
    severityBadge.classList.add(report.severity.toLowerCase());

    const tagsContainer = fragment.querySelector('.report-tags');
    [report.category, formatStatus(report.status), `${report.votes} apoyo${report.votes === 1 ? '' : 's'}`].forEach((text) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = text;
      tagsContainer.appendChild(tag);
    });

    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Ver detalle de ${report.title}`);
    card.addEventListener('click', () => openDetails(report.id));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openDetails(report.id);
      }
    });

    const viewButton = fragment.querySelector('.view-btn');
    const focusButton = fragment.querySelector('.focus-btn');
    viewButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openDetails(report.id);
    });
    focusButton.addEventListener('click', (event) => {
      event.stopPropagation();
      focusReport(report.id);
    });

    el.reportsList.appendChild(fragment);
  });
}

function renderMarkers() {
  for (const marker of state.markers.values()) {
    state.map.removeLayer(marker);
  }
  state.markers.clear();

  if (state.visualMode === 'heat') {
    return;
  }

  state.filteredReports.forEach((report) => {
    const marker = L.marker([report.lat, report.lng], {
      icon: createCustomIcon(report.status)
    });

    marker.bindPopup(`
      <div style="min-width:220px">
        <strong>${escapeHtml(report.title)}</strong><br>
        <span>${escapeHtml(report.category)} • ${escapeHtml(formatStatus(report.status))}</span>
        <p style="margin:8px 0 0; color:#9fb0d0">${escapeHtml(report.description.slice(0, 110))}${report.description.length > 110 ? '...' : ''}</p>
        <button onclick="window.__openDetails('${report.id}')" style="margin-top:10px; width:100%; border:none; border-radius:10px; padding:10px; background:#2563eb; color:white; cursor:pointer;">Ver detalle</button>
      </div>
    `);

    marker.addTo(state.map);
    state.markers.set(report.id, marker);
  });
}

function renderHeatLayer() {
  if (state.heatLayer) {
    state.map.removeLayer(state.heatLayer);
    state.heatLayer = null;
  }

  if (state.visualMode === 'markers') {
    return;
  }

  if (!state.filteredReports.length || typeof L.heatLayer !== 'function') {
    return;
  }

  const points = state.filteredReports.map((report) => [
    report.lat,
    report.lng,
    getReportIntensity(report),
  ]);

  state.heatLayer = L.heatLayer(points, {
    radius: window.innerWidth <= 640 ? 24 : 30,
    blur: 24,
    maxZoom: 18,
    minOpacity: 0.35,
    gradient: {
      0.15: '#38bdf8',
      0.4: '#00e8a8',
      0.7: '#f59e0b',
      1.0: '#ff4d6d',
    }
  }).addTo(state.map);
}

function renderHotspotShapes() {
  if (state.hotspotLayer) {
    state.map.removeLayer(state.hotspotLayer);
    state.hotspotLayer = null;
  }

  if (state.visualMode === 'markers') {
    return;
  }

  if (!state.filteredReports.length) {
    return;
  }

  state.hotspotLayer = L.layerGroup().addTo(state.map);

  const hotspots = [...state.filteredReports]
    .sort((a, b) => getReportIntensity(b) - getReportIntensity(a))
    .slice(0, Math.min(12, state.filteredReports.length));

  hotspots.forEach((report) => {
    const intensity = getReportIntensity(report);
    const color = getHeatColor(intensity);
    const radius = 140 + intensity * 320;

    L.circle([report.lat, report.lng], {
      radius,
      weight: 1.4,
      color,
      fillColor: color,
      fillOpacity: 0.08 + intensity * 0.18,
      opacity: 0.65,
    })
      .bindTooltip(`${escapeHtml(report.title)} • intensidad ${Math.round(intensity * 100)}%`, {
        direction: 'top',
        sticky: true,
      })
      .addTo(state.hotspotLayer);
  });
}

function updateVisualModeUI() {
  el.visualModeButtons.forEach((button) => {
    const isActive = button.dataset.visualMode === state.visualMode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });

  const showHeatLegend = state.visualMode !== 'markers' && state.filteredReports.length > 0;
  el.heatLegend.classList.toggle('hidden', !showHeatLegend);
  el.heatLegend.setAttribute('aria-hidden', String(!showHeatLegend));
}

function getReportIntensity(report) {
  const severityScore = {
    Baja: 0.35,
    Media: 0.65,
    Alta: 1,
  }[report.severity] || 0.5;

  const votes = Number(report.votes) || 1;
  const votesScore = Math.min(1, Math.log1p(votes) / Math.log1p(30));
  const statusScore = report.status === 'resuelto' ? 0.4 : 1;

  const weighted = severityScore * 0.5 + votesScore * 0.3 + statusScore * 0.2;
  return Math.max(0.15, Math.min(1, weighted));
}

function getHeatColor(intensity) {
  if (intensity >= 0.85) return '#ff4d6d';
  if (intensity >= 0.68) return '#f59e0b';
  if (intensity >= 0.45) return '#00e8a8';
  return '#38bdf8';
}

function toggleSidebar(forceOpen) {
  const isOpen = forceOpen !== undefined ? forceOpen : !el.sidebar.classList.contains('open');
  el.sidebar.classList.toggle('open', isOpen);
  el.sidebarOverlay.classList.toggle('visible', isOpen);
  queueMapResizeFix();
}

function createCustomIcon(status) {
  const classMap = {
    pendiente: 'pendiente',
    en_revision: 'revision',
    en_arreglo: 'arreglo',
    resuelto: 'resuelto',
  };
  const cls = classMap[status] || 'pendiente';
  return L.divIcon({
    className: '',
    html: `<div class="custom-marker ${cls}"></div>`,
    iconSize: [14, 14],
    popupAnchor: [0, -8]
  });
}

function openDetails(reportId) {
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) return;
  const alreadySupported = hasSupportedReport(report.id);
  const supportButtonText = alreadySupported ? 'Ya apoyaste' : 'Apoyar reclamo';

  el.detailsTitle.textContent = report.title;
  el.detailsContent.innerHTML = `
    ${report.image ? `<img class="details-image" src="${report.image}" alt="${escapeHtml(report.title)}">` : ''}
    <div class="details-grid">
      <div class="detail-block"><p>Categoría</p><strong>${escapeHtml(report.category)}</strong></div>
      <div class="detail-block"><p>Estado</p><strong>${escapeHtml(formatStatus(report.status))}</strong></div>
      <div class="detail-block"><p>Severidad</p><strong>${escapeHtml(report.severity)}</strong></div>
      <div class="detail-block"><p>Fecha</p><strong>${escapeHtml(formatDate(report.createdAt))}</strong></div>
      <div class="detail-block"><p>Ubicación</p><strong>${report.lat.toFixed(6)}, ${report.lng.toFixed(6)}</strong></div>
      <div class="detail-block"><p>Apoyos</p><strong>${report.votes}</strong></div>
    </div>
    <div class="detail-block">
      <p>Descripción</p>
      <strong>${escapeHtml(report.description)}</strong>
    </div>
    <div class="form-actions">
      <button class="ghost-btn" onclick="window.__focusReport('${report.id}')">Ir al mapa</button>
      <button class="ghost-btn ${alreadySupported ? 'is-disabled' : ''}" onclick="window.__supportReport('${report.id}')" ${alreadySupported ? 'disabled' : ''}>${supportButtonText}</button>
      <button class="ghost-btn" onclick="window.__cycleStatus('${report.id}')">Cambiar estado</button>
      <button class="danger-btn" onclick="window.__deleteReport('${report.id}')">Eliminar</button>
    </div>
  `;

  openModal(el.detailsModal);
}

function focusReport(reportId) {
  const report = state.reports.find((item) => item.id === reportId);
  const marker = state.markers.get(reportId);
  if (!report) return;

  closeModal(el.detailsModal);
  toggleSidebar(false);
  state.map.flyTo([report.lat, report.lng], 18, { duration: 0.9 });

  if (marker) {
    marker.openPopup();
    return;
  }

  if (state.focusPulse) {
    state.map.removeLayer(state.focusPulse);
    state.focusPulse = null;
  }

  state.focusPulse = L.circleMarker([report.lat, report.lng], {
    radius: 10,
    weight: 2.5,
    color: '#ffffff',
    fillColor: '#00e8a8',
    fillOpacity: 0.9,
  })
    .addTo(state.map)
    .bindPopup(escapeHtml(report.title));

  state.focusPulse.openPopup();

  setTimeout(() => {
    if (!state.focusPulse) return;
    state.map.removeLayer(state.focusPulse);
    state.focusPulse = null;
  }, 2200);
}

function supportReport(reportId) {
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) return;

  if (hasSupportedReport(reportId)) {
    alert('Ya apoyaste este reclamo desde este dispositivo.');
    return;
  }

  report.votes += 1;
  state.supportedReports.add(reportId);
  saveReports();
  saveSupportedReports();
  render();
  openDetails(reportId);
}

function hasSupportedReport(reportId) {
  return state.supportedReports.has(reportId);
}

function cycleStatus(reportId) {
  const report = state.reports.find((item) => item.id === reportId);
  if (!report) return;
  const currentIndex = STATUSES.findIndex((status) => status.value === report.status);
  const nextIndex = (currentIndex + 1) % STATUSES.length;
  report.status = STATUSES[nextIndex].value;
  saveReports();
  render();
  openDetails(reportId);
}

function deleteReport(reportId) {
  const confirmDelete = confirm('¿Seguro que querés eliminar este reporte?');
  if (!confirmDelete) return;
  state.reports = state.reports.filter((item) => item.id !== reportId);
  state.supportedReports.delete(reportId);
  saveReports();
  saveSupportedReports();
  closeModal(el.detailsModal);
  render();
}

function resetFilters() {
  el.searchInput.value = '';
  el.categoryFilter.value = 'all';
  el.statusFilter.value = 'all';
  el.severityFilter.value = 'all';
  render();
}

function seedDemoData() {
  if (state.reports.length && !confirm('Ya hay reportes cargados. ¿Querés agregar datos demo igual?')) return;

  const sample = [
    {
      id: crypto.randomUUID(),
      title: 'Pozo enorme frente a la plaza',
      category: 'Pozo',
      severity: 'Alta',
      status: 'pendiente',
      lat: -32.9461,
      lng: -60.6393,
      description: 'Pozo profundo que complica autos y motos. Cuando llueve, se vuelve invisible.',
      image: '',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      votes: 7,
    },
    {
      id: crypto.randomUUID(),
      title: 'Cable caído en vereda',
      category: 'Cable caído',
      severity: 'Alta',
      status: 'en_revision',
      lat: -32.9524,
      lng: -60.6587,
      description: 'Cable colgando a baja altura sobre la vereda. Riesgo para peatones.',
      image: '',
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      votes: 12,
    },
    {
      id: crypto.randomUUID(),
      title: 'Árbol sin podar tapa luminaria',
      category: 'Árbol sin podar',
      severity: 'Media',
      status: 'en_arreglo',
      lat: -32.9382,
      lng: -60.6461,
      description: 'Las ramas tapan la luz y de noche queda toda la cuadra a oscuras.',
      image: '',
      createdAt: new Date(Date.now() - 86400000 * 9).toISOString(),
      votes: 4,
    },
    {
      id: crypto.randomUUID(),
      title: 'Basura acumulada en esquina',
      category: 'Basura acumulada',
      severity: 'Baja',
      status: 'resuelto',
      lat: -32.9341,
      lng: -60.6732,
      description: 'Se juntaba basura durante días. Ya fue levantada, quedó como historial.',
      image: '',
      createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      votes: 9,
    }
  ];

  state.reports = [...sample, ...state.reports];
  saveReports();
  render();
}

function clearAllData() {
  const confirmed = confirm('Esto eliminará todos los reportes guardados en este navegador.');
  if (!confirmed) return;
  state.reports = [];
  state.supportedReports.clear();
  saveReports();
  saveSupportedReports();
  closeModal(el.detailsModal);
  render();
}

function formatDate(isoString) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(isoString));
}

function formatStatus(value) {
  return STATUSES.find((status) => status.value === value)?.label || value;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

window.__openDetails = openDetails;
window.__focusReport = focusReport;
window.__supportReport = supportReport;
window.__cycleStatus = cycleStatus;
window.__deleteReport = deleteReport;

init();
