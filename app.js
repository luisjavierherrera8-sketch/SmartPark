

const STATE = {
  currentRole: 'cliente',
  isLoggedIn: false,
  loggedUser: null,
  spaces: {},
  historial: [],
  activeVehicles: {},
  tarifas: { auto: 2000, moto: 1000, camioneta: 2500, bus: 4000 },
  ingresosDia: 0,
  selectedSpace: null
};

function toggleDarkMode() {
  document.body.classList.toggle("dark");

  // guardar preferencia
  localStorage.setItem(
    "darkMode",
    document.body.classList.contains("dark")
  );
}

// Usuarios demo
const DEMO_USERS = {
  'admin@smartpark.com': { pass: '1234', role: 'admin', name: 'Carlos Administrador' },
  'op@smartpark.com':    { pass: '1234', role: 'operador', name: 'Laura Operadora' },
  'user@smartpark.com':  { pass: '1234', role: 'cliente', name: 'Juan Cliente' }
};

// Usuarios registrados
let REGISTERED_USERS = {};

// ============ INICIALIZACIÓN ============
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
  }

  generarEspacios();
  renderHeroGrid();
  renderSpacesGrid();
  renderHistorial();
  renderCharts();
  calcularTarifa();

  // Navbar scroll
  window.addEventListener('scroll', () => {
    document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 20);
  });
});

// ============ GENERAR ESPACIOS ============
function generarEspacios() {
  // Zona A: 20 espacios
  for (let i = 1; i <= 20; i++) {
    const id = `A-${String(i).padStart(2, '0')}`;
    const rand = Math.random();
    STATE.spaces[id] = {
      id, zona: 'A',
      status: rand < 0.5 ? 'free' : rand < 0.75 ? 'occupied' : 'reserved',
      vehiculo: null, placa: null, entrada: null, tipo: null
    };
    if (STATE.spaces[id].status === 'occupied') {
      const tipos = ['auto', 'moto', 'camioneta'];
      const tipo = tipos[Math.floor(Math.random() * tipos.length)];
      const placas = ['XYZ-001','MNO-345','QRS-789','TUV-112','WXY-456'];
      STATE.spaces[id].placa = placas[Math.floor(Math.random() * placas.length)];
      STATE.spaces[id].tipo = tipo;
      STATE.spaces[id].entrada = new Date(Date.now() - Math.random() * 7200000);
      STATE.activeVehicles[STATE.spaces[id].placa] = STATE.spaces[id];
    }
  }
  // Zona B: 20 espacios
  for (let i = 1; i <= 20; i++) {
    const id = `B-${String(i).padStart(2, '0')}`;
    const rand = Math.random();
    STATE.spaces[id] = {
      id, zona: 'B',
      status: rand < 0.6 ? 'free' : rand < 0.8 ? 'occupied' : 'reserved',
      vehiculo: null, placa: null, entrada: null, tipo: null
    };
  }
  actualizarKPIs();
}

// ============ HERO MINI-GRID ============
function renderHeroGrid() {
  const grid = document.getElementById('hero-grid');
  if (!grid) return;
  const allSpaces = Object.values(STATE.spaces);
  const sample = allSpaces.slice(0, 32);
  grid.innerHTML = sample.map(s =>
    `<div class="pc-space ${s.status}" title="${s.id}"></div>`
  ).join('');
  const free = allSpaces.filter(s => s.status === 'free').length;
  const avail = document.getElementById('hero-avail');
  if (avail) avail.textContent = `${free} espacios libres`;
}

// ============ GRIDS DE ESPACIOS ============
function renderSpacesGrid() {
  renderZona('A');
  renderZona('B');
}

function renderZona(zona) {
  const grid = document.getElementById(`spaces-grid-${zona}`);
  if (!grid) return;
  const spaces = Object.values(STATE.spaces).filter(s => s.zona === zona);
  grid.innerHTML = spaces.map(s => {
    const ico = s.status === 'free' ? '🅿' : s.status === 'occupied' ? '🚗' : '🔒';
    const click = s.status === 'free' ? `onclick="abrirEspacio('${s.id}')"` : '';
    return `<div class="space-slot ${s.status}" ${click} title="${s.id}">
      <span class="space-ico">${ico}</span>
      <span class="space-id">${s.id}</span>
    </div>`;
  }).join('');
}

// ============ ABRIR MODAL ESPACIO ============
function abrirEspacio(id) {
  if (!STATE.isLoggedIn || STATE.currentRole !== 'cliente') {
    showToast('❌ Por favor inicia sesión como conductor para reservar', 'error');
    openModal('modal-login');
    return;
  }
  
  const sp = STATE.spaces[id];
  if (!sp || sp.status !== 'free') return;
  STATE.selectedSpace = id;

  document.getElementById('space-modal-title').textContent = `Espacio ${id}`;
  document.getElementById('space-info').innerHTML = `
    <p>📍 Zona ${sp.zona} – Espacio ${id}</p>
    <p>✅ Estado: <b style="color:var(--green)">Libre</b></p>
  `;
  actualizarCalcEspacio();
  openModal('modal-space');

  document.getElementById('space-tiempo').onchange = actualizarCalcEspacio;
}

function actualizarCalcEspacio() {
  const tipo = document.getElementById('calc-tipo')?.value || 'auto';
  const horas = parseInt(document.getElementById('space-tiempo').value);
  const tarifa = STATE.tarifas[tipo];
  const calc = document.getElementById('space-calc');
  if (!calc) return;
  if (horas === 0) {
    calc.innerHTML = `<span class="calc-label">Tarifa</span><span class="calc-price">$${tarifa.toLocaleString('es-CO')}/h · Tiempo libre</span>`;
  } else {
    const total = tarifa * horas;
    calc.innerHTML = `<span class="calc-label">Total estimado (${horas}h)</span><span class="calc-price">$${total.toLocaleString('es-CO')}</span>`;
  }
}

function confirmarReserva() {
  if (!STATE.isLoggedIn || STATE.currentRole !== 'cliente') {
    showToast('❌ Debes iniciar sesión como conductor para reservar', 'error');
    closeModal('modal-space');
    return;
  }
  
  const placa = document.getElementById('space-placa').value.trim();
  const horas = parseInt(document.getElementById('space-tiempo').value);
  if (!placa) { showToast('⚠️ Ingresa tu placa', 'warn'); return; }
  const id = STATE.selectedSpace;
  if (!id) return;
  const tipo = document.getElementById('calc-tipo')?.value || 'auto';

  STATE.spaces[id].status = 'occupied';
  STATE.spaces[id].placa = placa.toUpperCase();
  STATE.spaces[id].tipo = tipo;
  STATE.spaces[id].entrada = new Date();
  STATE.spaces[id].horasReservadas = horas;
  STATE.activeVehicles[placa.toUpperCase()] = STATE.spaces[id];

  agregarHistorial({ placa: placa.toUpperCase(), tipo, espacio: id, entrada: new Date(), salida: null, total: null, usuario: STATE.loggedUser.name });

  renderSpacesGrid();
  renderHeroGrid();
  actualizarKPIs();
  if (STATE.currentRole === 'cliente') {
    actualizarDashboardConductor();
  }
  closeModal('modal-space');
  showToast(`✅ Reserva confirmada – Espacio ${id}`);
}

// ============ CALCULADORA TARIFA ============
function calcularTarifa() {
  const tipo = document.getElementById('calc-tipo')?.value || 'auto';
  const horas = parseInt(document.getElementById('calc-horas')?.value || 0);
  const price = document.getElementById('calc-price');
  if (!price) return;
  if (horas === 0) {
    price.textContent = 'Tiempo libre';
  } else {
    const total = STATE.tarifas[tipo] * horas;
    price.textContent = `$${total.toLocaleString('es-CO')}`;
  }
}

// ============ MODALS ============
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
  document.body.style.overflow = '';
}
function switchModal(from, to) {
  closeModal(from);
  openModal(to);
}

// Cerrar modal al clic en overlay
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
    document.body.style.overflow = '';
  }
});

// ============ ROLE TABS ============
function switchRole(role, btn) {
  STATE.currentRole = role;
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

// ============ LOGIN ============
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  
  // Buscar en usuarios demo y registrados
  let user = DEMO_USERS[email] || REGISTERED_USERS[email];

  if (user && user.pass === pass) {
    STATE.isLoggedIn = true;
    STATE.currentRole = user.role;
    STATE.loggedUser = { ...user, email };
    closeModal('modal-login');
    
    // Limpiar formulario
    document.getElementById('login-form').reset();

    if (user.role === 'admin' || user.role === 'operador') {
      mostrarDashboard();
    } else if (user.role === 'cliente') {
      mostrarDashboardConductor();
    } else {
      showToast(`👋 Bienvenido, ${user.name}.`);
    }
  } else {
    showToast('❌ Credenciales incorrectas', 'error');
  }
}

function handleRegister(e) {
  e.preventDefault();
  
  const nombre = document.querySelector('#modal-register input[placeholder="Juan"]').value.trim();
  const apellido = document.querySelector('#modal-register input[placeholder="Pérez"]').value.trim();
  const email = document.querySelector('#modal-register input[placeholder="correo@ejemplo.com"]').value.trim();
  const placa = document.querySelector('#modal-register input[placeholder="ABC-123"]').value.trim();
  const pass = document.querySelector('#modal-register input[type="password"]').value.trim();
  
  if (!nombre || !apellido || !email || !placa || !pass) {
    showToast('⚠️ Por favor completa todos los campos', 'warn');
    return;
  }
  
  if (DEMO_USERS[email] || REGISTERED_USERS[email]) {
    showToast('❌ Este correo ya está registrado', 'error');
    return;
  }
  
  // Guardar el nuevo usuario
  const fullName = `${nombre} ${apellido}`;
  REGISTERED_USERS[email] = {
    pass: pass,
    role: 'cliente',
    name: fullName,
    placa: placa
  };
  
  closeModal('modal-register');
  showToast(`✅ Cuenta creada para ${fullName}. Ahora puedes iniciar sesión.`);
  
  // Limpiar formulario
  document.getElementById('modal-register').querySelectorAll('input, select').forEach(el => {
    el.value = '';
  });
}

// ============ DASHBOARD ============
function mostrarDashboard() {
  document.getElementById('admin-dashboard').classList.remove('hidden');
  document.getElementById('admin-dashboard').scrollIntoView({ behavior: 'smooth' });
  showToast(`🔑 Sesión iniciada como ${STATE.loggedUser.role}`);
  renderHistorial();
  renderCharts();
}

function cerrarSesion() {
  STATE.isLoggedIn = false;
  STATE.loggedUser = null;
  STATE.currentRole = 'cliente';
  document.getElementById('admin-dashboard').classList.add('hidden');
  showToast('👋 Sesión cerrada. Hasta pronto!');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ DASHBOARD CONDUCTOR ============
function mostrarDashboardConductor() {
  document.getElementById('conductor-dashboard').classList.remove('hidden');
  document.getElementById('conductor-dashboard').scrollIntoView({ behavior: 'smooth' });
  actualizarDashboardConductor();
  showToast(`👋 Bienvenido, ${STATE.loggedUser.name}!`);
}

function actualizarDashboardConductor() {
  // Información personal
  const nombre = document.getElementById('cond-nombre');
  const email = document.getElementById('cond-email');
  const placa = document.getElementById('cond-placa');
  const info = document.getElementById('conductor-info');
  
  if (nombre) nombre.textContent = STATE.loggedUser.name;
  if (email) email.textContent = STATE.loggedUser.email;
  if (placa) placa.textContent = STATE.loggedUser.placa;
  if (info) info.textContent = `Email: ${STATE.loggedUser.email} • Placa: ${STATE.loggedUser.placa}`;
  
  // Actualizar KPIs
  const all = Object.values(STATE.spaces);
  const libre = all.filter(s => s.status === 'free').length;
  const ocupado = all.filter(s => s.status === 'occupied').length;
  
  const total = document.getElementById('cond-total');
  const libreNumDoc = document.getElementById('cond-libre');
  const ocupadoDoc = document.getElementById('cond-ocupado');
  const libreNum = document.getElementById('cond-avail-num');
  const ocupadoNum = document.getElementById('cond-ocupado-num');
  
  if (total) total.textContent = all.length;
  if (libreNumDoc) libreNumDoc.textContent = libre;
  if (ocupadoDoc) ocupadoDoc.textContent = ocupado;
  if (libreNum) libreNum.textContent = libre;
  if (ocupadoNum) ocupadoNum.textContent = ocupado;
  
  // Renderizar reservas
  renderizarReservasConductor();
}

function renderizarReservasConductor() {
  const userReservas = STATE.historial.filter(h => h.usuario === STATE.loggedUser.name && !h.salida);
  const empty = document.getElementById('conductor-reservas-empty');
  const table = document.getElementById('conductor-reservas-table');
  const tbody = document.getElementById('conductor-reservas-body');
  const reservasNum = document.getElementById('cond-reservas');
  
  if (reservasNum) reservasNum.textContent = userReservas.length;
  
  if (userReservas.length === 0) {
    if (empty) empty.classList.remove('hidden');
    if (table) table.classList.add('hidden');
    return;
  }
  
  if (empty) empty.classList.add('hidden');
  if (table) table.classList.remove('hidden');
  
  tbody.innerHTML = userReservas.map(h => `
    <tr>
      <td><b>${h.placa}</b></td>
      <td>${h.tipo || '—'}</td>
      <td>${h.espacio}</td>
      <td>${h.entrada.toLocaleTimeString('es-CO')}</td>
      <td><span class="badge active">En curso</span></td>
    </tr>
  `).join('');
}

function cerrarSesionConductor() {
  STATE.isLoggedIn = false;
  STATE.loggedUser = null;
  STATE.currentRole = 'cliente';
  document.getElementById('conductor-dashboard').classList.add('hidden');
  showToast('👋 Sesión cerrada. ¡Hasta pronto!');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============ REGISTRAR INGRESO (OPERADOR) ============
function registrarIngreso() {
  const placa = document.getElementById('op-placa').value.trim().toUpperCase();
  const tipo = document.getElementById('op-tipo').value;
  if (!placa) { showToast('⚠️ Ingresa la placa', 'warn'); return; }
  if (STATE.activeVehicles[placa]) { showToast('⚠️ Vehículo ya se encuentra en el parqueadero', 'warn'); return; }

  // Encontrar espacio libre
  const espacio = Object.values(STATE.spaces).find(s => s.status === 'free');
  if (!espacio) { showToast('❌ No hay espacios disponibles', 'error'); return; }

  espacio.status = 'occupied';
  espacio.placa = placa;
  espacio.tipo = tipo;
  espacio.entrada = new Date();
  STATE.activeVehicles[placa] = espacio;

  document.getElementById('op-espacio').value = espacio.id;
  agregarHistorial({ placa, tipo, espacio: espacio.id, entrada: new Date(), salida: null, total: null });

  renderSpacesGrid();
  renderHeroGrid();
  actualizarKPIs();
  showToast(`✅ Ingreso registrado – ${placa} → Espacio ${espacio.id}`);
  document.getElementById('op-placa').value = '';
  document.getElementById('op-espacio').value = '';
}

// ============ REGISTRAR SALIDA (OPERADOR) ============
function buscarVehiculo(placa) {
  const v = STATE.activeVehicles[placa.toUpperCase()];
  const info = document.getElementById('out-info');
  if (!info) return;
  if (v) {
    const minutos = Math.ceil((Date.now() - v.entrada.getTime()) / 60000);
    const horas = minutos / 60;
    const total = Math.ceil(horas * STATE.tarifas[v.tipo || 'auto']);
    info.classList.remove('hidden');
    document.getElementById('out-tipo-txt').textContent = v.tipo || 'auto';
    document.getElementById('out-espacio-txt').textContent = v.id;
    document.getElementById('out-hora-txt').textContent = v.entrada.toLocaleTimeString('es-CO');
    document.getElementById('out-total-txt').textContent = `$${total.toLocaleString('es-CO')} (${minutos} min)`;
    info._vehiculo = v;
    info._total = total;
  } else {
    info.classList.add('hidden');
  }
}

function registrarSalida() {
  const placa = document.getElementById('out-placa').value.trim().toUpperCase();
  const info = document.getElementById('out-info');
  if (!placa) { showToast('⚠️ Ingresa la placa', 'warn'); return; }
  const v = STATE.activeVehicles[placa];
  if (!v) { showToast('❌ Vehículo no encontrado en el parqueadero', 'error'); return; }

  const total = info._total || 0;
  STATE.ingresosDia += total;
  v.status = 'free';
  v.placa = null;
  v.tipo = null;
  v.entrada = null;
  delete STATE.activeVehicles[placa];

  // Actualizar historial
  const entry = STATE.historial.find(h => h.placa === placa && !h.salida);
  if (entry) {
    entry.salida = new Date();
    entry.total = total;
  }

  renderSpacesGrid();
  renderHeroGrid();
  actualizarKPIs();
  renderHistorial();
  renderCharts();
  info.classList.add('hidden');
  document.getElementById('out-placa').value = '';
  showToast(`✅ Salida registrada – ${placa} | Total: $${total.toLocaleString('es-CO')}`);
}

// ============ HISTORIAL ============
function agregarHistorial(entry) {
  STATE.historial.unshift(entry);
  renderHistorial();
}

function renderHistorial(filtro = '') {
  const tbody = document.getElementById('historial-body');
  if (!tbody) return;
  let data = STATE.historial;
  if (filtro) data = data.filter(h => h.placa.includes(filtro.toUpperCase()));

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:20px">Sin registros aún</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(h => `
    <tr>
      <td><b>${h.placa}</b></td>
      <td>${h.tipo || '—'}</td>
      <td>${h.espacio}</td>
      <td>${h.entrada.toLocaleTimeString('es-CO')}</td>
      <td>${h.salida ? h.salida.toLocaleTimeString('es-CO') : '—'}</td>
      <td>${h.total !== null ? `$${h.total.toLocaleString('es-CO')}` : '—'}</td>
      <td><span class="badge ${h.salida ? 'done' : 'active'}">${h.salida ? 'Finalizado' : 'En curso'}</span></td>
    </tr>
  `).join('');
}

function filtrarHistorial(val) {
  renderHistorial(val);
}

// ============ KPIs ============
function actualizarKPIs() {
  const all = Object.values(STATE.spaces);
  const libre = all.filter(s => s.status === 'free').length;
  const ocupado = all.filter(s => s.status === 'occupied').length;

  const kpiLibre = document.getElementById('kpi-libre');
  const kpiOcupado = document.getElementById('kpi-ocupado');
  const kpiIngresos = document.getElementById('kpi-ingresos');

  if (kpiLibre) kpiLibre.textContent = libre;
  if (kpiOcupado) kpiOcupado.textContent = ocupado;
  if (kpiIngresos) kpiIngresos.textContent = `$${STATE.ingresosDia.toLocaleString('es-CO')}`;
}

// ============ CHARTS ============
function renderCharts() {
  renderBarChart();
  renderDonutChart();
}

function renderBarChart() {
  const container = document.getElementById('chart-bars');
  if (!container) return;
  const horas = ['6h','8h','10h','12h','14h','16h','18h','20h'];
  const ocupacion = [15,28,45,80,92,85,70,55];
  container.innerHTML = horas.map((h, i) => `
    <div class="chart-bar-wrap">
      <div class="chart-bar" style="height:${ocupacion[i]}%; background:${ocupacion[i] > 75 ? 'var(--red)' : 'var(--green)'}"></div>
      <span class="chart-bar-lbl">${h}</span>
    </div>
  `).join('');
}

function renderDonutChart() {
  const container = document.getElementById('donut-container');
  if (!container) return;
  const tipos = [
    { label: 'Automóvil', pct: 55, color: 'var(--green)', val: '$46.000' },
    { label: 'Moto',      pct: 25, color: '#00bcd4',      val: '$21.000' },
    { label: 'Camioneta', pct: 15, color: 'var(--gold)',   val: '$12.600' },
    { label: 'Bus',       pct: 5,  color: 'var(--red)',    val: '$4.400'  },
  ];
  container.innerHTML = tipos.map(t => `
    <div class="donut-row">
      <span class="donut-label">${t.label}</span>
      <div class="donut-bar-bg">
        <div class="donut-bar-fill" style="width:${t.pct}%;background:${t.color}"></div>
      </div>
      <span class="donut-val">${t.val}</span>
    </div>
  `).join('');
}

// ============ EXPORTAR REPORTE ============
function exportarReporte() {
  const rows = [
    ['Placa', 'Tipo', 'Espacio', 'Entrada', 'Salida', 'Total', 'Estado'],
    ...STATE.historial.map(h => [
      h.placa, h.tipo || '—', h.espacio,
      h.entrada.toLocaleString('es-CO'),
      h.salida ? h.salida.toLocaleString('es-CO') : 'En curso',
      h.total !== null ? `$${h.total}` : '—',
      h.salida ? 'Finalizado' : 'Activo'
    ])
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `SmartPark_Reporte_${new Date().toLocaleDateString('es-CO').replace(/\//g,'-')}.csv`;
  a.click();
  showToast('📥 Reporte exportado como CSV');
}

// ============ TOAST ============
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.borderLeftColor = type === 'error' ? 'var(--red)' : type === 'warn' ? 'var(--gold)' : 'var(--green)';
  t.classList.remove('hidden');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => t.classList.add('hidden'), 3500);
}

// ============ MENU MÓVIL ============
function toggleMenu() {
  const links = document.querySelector('.nav-links');
  const actions = document.querySelector('.nav-actions');
  if (!links) return;
  const show = links.style.display === 'flex';
  links.style.cssText = show ? '' : 'display:flex;flex-direction:column;position:fixed;top:70px;left:0;right:0;background:white;padding:20px;gap:16px;box-shadow:0 8px 24px rgba(0,0,0,0.1);z-index:99';
  if (actions) actions.style.cssText = show ? '' : 'display:flex;flex-direction:column;position:fixed;top:220px;left:0;right:0;background:white;padding:20px;gap:12px;box-shadow:0 8px 24px rgba(0,0,0,0.1);z-index:99';
}

// ============ SCROLL TO ============
function scrollTo(selector) {
  const el = document.querySelector(selector);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
