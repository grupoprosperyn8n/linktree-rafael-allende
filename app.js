/* =====================================================
   RAFAEL ALLENDE & ASOCIADOS - LINKTREE
   JavaScript - Modales, Formularios y Funcionalidad
   ===================================================== */

// Sucursales - se cargan desde API
let sucursales = [];

// Cargar sucursales desde Airtable
async function loadSucursales() {
    try {
        const API_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:8000' 
            : 'https://web-production-2584d.up.railway.app';
        
        const response = await fetch(`${API_URL}/api/sucursales`);
        const data = await response.json();
        
        if (data.status === 'success' && data.sucursales) {
            sucursales = data.sucursales;
            renderSucursales();
        }
    } catch (error) {
        console.error('Error cargando sucursales:', error);
    }
}

// =====================================================
// UTILS
// =====================================================

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 120000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
  
    try {
        const response = await fetch(resource, {
        ...options,
        signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function firstFieldValue(value) {
    if (Array.isArray(value)) return value[0] ?? '';
    return value ?? '';
}

function formatAsesoriaHumanDate(dateStr) {
    if (!dateStr) return '';

    try {
        const dateObj = new Date(`${dateStr}T00:00:00`);
        const formatted = new Intl.DateTimeFormat('es-AR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        }).format(dateObj);

        return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    } catch (error) {
        return dateStr;
    }
}

function formatAsesoriaTimestamp(dateStr) {
    try {
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(dateStr));
    } catch (error) {
        return dateStr || '';
    }
}

function buildAsesoriaReceiptData({ reserva, fecha, horaInicio, motivo, plataforma, notas, esCliente, nombreFallback, emailFallback, telefonoFallback }) {
    const fields = (reserva && reserva.fields) || {};
    const codigoReal = firstFieldValue(fields.CODIGO) || firstFieldValue(fields['Código']) || firstFieldValue(fields['CÓDIGO']) || '';

    return {
        codigo: codigoReal,
        recordId: reserva?.id || '',
        emitidoEn: formatAsesoriaTimestamp(reserva?.createdTime || new Date().toISOString()),
        fecha: fields.FECHA || fecha || '',
        fechaLegible: formatAsesoriaHumanDate(fields.FECHA || fecha || ''),
        horaInicio: fields.HORA_INICIO || horaInicio || '',
        horaFin: fields.HORA_FIN || '',
        motivo: fields.MOTIVO || motivo || '',
        plataforma: fields.PLATAFORMA || plataforma || '',
        notas: fields.NOTAS || notas || '',
        estado: fields.ESTADO || 'Solicitud',
        esCliente: Boolean(esCliente),
        nombre: firstFieldValue(fields['NOMBRE DEL CLIENTE']) || fields.NOMBRE_NO_CLIENTE || nombreFallback || 'Solicitante',
        email: firstFieldValue(fields['EMAIL (from CLIENTE)']) || fields.EMAIL_NO_CLIENTE || emailFallback || '',
        telefono: firstFieldValue(fields['TELEFONO (from CLIENTE)']) || fields.TELEFONO_NO_CLIENTE || telefonoFallback || ''
    };
}

let activeModalScrollObserver = null;
let activeModalScrollTarget = null;
let activeModalScrollListener = null;
let activeModalTracked = null;

function getPageScrollTarget() {
    return document.scrollingElement || document.documentElement;
}

function elementCanScroll(element) {
    if (!element || !element.isConnected) return false;

    const styles = window.getComputedStyle(element);
    const overflowY = styles.overflowY;
    const isScrollable = /(auto|scroll|overlay)/.test(overflowY);
    const hasOverflow = (element.scrollHeight - element.clientHeight) > 24;
    const isVisible = element.getClientRects().length > 0;

    return isScrollable && hasOverflow && isVisible;
}

function getModalScrollTarget(modal) {
    if (!modal) return null;

    const preferredTargets = [
        ...modal.querySelectorAll('[data-scroll-hint="true"]'),
        ...modal.querySelectorAll('.branches-list, .qs-modal-wrapper, .modal-body, .modal-content')
    ];

    return preferredTargets.find(elementCanScroll) || null;
}

function teardownModalScrollTracking() {
    if (activeModalScrollTarget && activeModalScrollListener) {
        activeModalScrollTarget.removeEventListener('scroll', activeModalScrollListener);
    }

    if (activeModalScrollObserver) {
        activeModalScrollObserver.disconnect();
    }

    activeModalScrollObserver = null;
    activeModalScrollTarget = null;
    activeModalScrollListener = null;
    activeModalTracked = null;
}

function ensureModalScrollTracking(activeModal, scrollTarget) {
    if (activeModalTracked !== activeModal) {
        if (activeModalScrollObserver) {
            activeModalScrollObserver.disconnect();
        }

        activeModalTracked = activeModal;

        if (activeModal) {
            activeModalScrollObserver = new MutationObserver(() => {
                window.requestAnimationFrame(syncScrollIndicators);
            });
            activeModalScrollObserver.observe(activeModal, {
                childList: true,
                subtree: true,
                attributes: true
            });
        }
    }

    if (activeModalScrollTarget !== scrollTarget) {
        if (activeModalScrollTarget && activeModalScrollListener) {
            activeModalScrollTarget.removeEventListener('scroll', activeModalScrollListener);
        }

        activeModalScrollTarget = scrollTarget;
        activeModalScrollListener = scrollTarget
            ? () => window.requestAnimationFrame(syncScrollIndicators)
            : null;

        if (activeModalScrollTarget && activeModalScrollListener) {
            activeModalScrollTarget.addEventListener('scroll', activeModalScrollListener, { passive: true });
        }
    }
}

function syncScrollIndicators() {
    const mainIndicator = document.getElementById('scroll-indicator');
    const modalIndicator = document.getElementById('global-scroll-indicator');
    const activeModal = document.querySelector('.modal.active');

    if (activeModal) {
        if (mainIndicator) {
            mainIndicator.style.display = 'none';
            mainIndicator.classList.add('hidden');
        }

        const scrollTarget = getModalScrollTarget(activeModal);
        ensureModalScrollTracking(activeModal, scrollTarget);

        if (modalIndicator) {
            if (scrollTarget && elementCanScroll(scrollTarget)) {
                modalIndicator.style.display = 'flex';
                modalIndicator.classList.toggle('hidden', scrollTarget.scrollTop > 48);
            } else {
                modalIndicator.style.display = 'none';
                modalIndicator.classList.add('hidden');
            }
        }

        return;
    }

    teardownModalScrollTracking();

    if (modalIndicator) {
        modalIndicator.style.display = 'none';
        modalIndicator.classList.add('hidden');
    }

    if (mainIndicator) {
        const pageTarget = getPageScrollTarget();
        const canScroll = (pageTarget.scrollHeight - window.innerHeight) > 24;
        mainIndicator.style.display = canScroll ? 'flex' : 'none';
        mainIndicator.classList.toggle('hidden', !canScroll || pageTarget.scrollTop > 48);
    }
}

function downloadAsesoriaReceipt(receiptData) {
    const jsPDFConstructor = window.jspdf?.jsPDF;
    if (!jsPDFConstructor) {
        throw new Error('No pudimos preparar el PDF en este navegador.');
    }

    const doc = new jsPDFConstructor({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    const addKeyValue = (label, value, options = {}) => {
        const text = String(value || '-');
        const split = doc.splitTextToSize(text, options.maxWidth || 240);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(58, 123, 213);
        doc.text(label, margin + (options.xOffset || 0), y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(split, margin + (options.xOffset || 0), y + 16);
        return Math.max(46, 22 + split.length * 15);
    };

    doc.setFillColor(7, 17, 31);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, margin, contentWidth, pageHeight - (margin * 2), 18, 18, 'F');

    doc.setFillColor(0, 210, 255);
    doc.roundedRect(margin, margin, contentWidth, 110, 18, 18, 'F');
    doc.setFillColor(58, 123, 213);
    doc.rect(margin, margin + 55, contentWidth, 55, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.setTextColor(255, 255, 255);
    doc.text('Comprobante de Asesoria Online', margin + 24, margin + 38);
    doc.setFontSize(11);
    doc.setTextColor(255, 245, 157);
    doc.text('Rafael Allende & Asociados', margin + 24, margin + 66);

    doc.setDrawColor(255, 214, 10);
    doc.setLineWidth(1.5);
    doc.line(pageWidth - 170, margin + 36, pageWidth - 65, margin + 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(receiptData.codigo || '-', pageWidth - 165, margin + 60);

    y = margin + 140;

    const leftHeight = addKeyValue('Solicitante', receiptData.nombre, { maxWidth: 210 });
    const rightHeight = addKeyValue('Tipo de usuario', receiptData.esCliente ? 'Cliente' : 'Nuevo contacto', { xOffset: 270, maxWidth: 180 });
    y += Math.max(leftHeight, rightHeight);

    const fechaHeight = addKeyValue('Fecha de la asesoria', receiptData.fechaLegible || receiptData.fecha, { maxWidth: 210 });
    const horaHeight = addKeyValue('Horario', `${receiptData.horaInicio}${receiptData.horaFin ? ` a ${receiptData.horaFin}` : ''}`, { xOffset: 270, maxWidth: 180 });
    y += Math.max(fechaHeight, horaHeight) + 4;

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, y, pageWidth - margin, y);
    y += 24;

    const detailRows = [
        ['Plataforma', receiptData.plataforma],
        ['Motivo', receiptData.motivo],
        ['Estado', receiptData.estado],
        ['E-mail', receiptData.email],
        ['Telefono', receiptData.telefono]
    ];

    detailRows.forEach(([label, value]) => {
        if (!value) return;
        const rowHeight = addKeyValue(label, value, { maxWidth: contentWidth - 40 });
        y += rowHeight;
    });

    if (receiptData.notas) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(58, 123, 213);
        doc.text('Notas', margin, y);
        const notas = doc.splitTextToSize(String(receiptData.notas), contentWidth - 10);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(notas, margin, y + 18);
        y += 24 + notas.length * 15;
    }

    y += 10;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, y, contentWidth, 68, 14, 14, 'F');
    doc.setDrawColor(250, 204, 21);
    doc.setLineWidth(1);
    doc.roundedRect(margin, y, contentWidth, 68, 14, 14, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(`Emitido: ${receiptData.emitidoEn}`, margin + 18, y + 26);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text('Guardalo como comprobante de tu reserva.', margin + 18, y + 46);

    const codeForFile = receiptData.codigo || `${receiptData.fecha || 'sin-fecha'}-${String(receiptData.horaInicio || 'sin-hora').replace(':', '')}`;
    const fileName = `comprobante-asesoria-${codeForFile}.pdf`;
    doc.save(fileName);
}

// =====================================================

function openModal(modalId) {


    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        syncScrollIndicators();
        window.requestAnimationFrame(syncScrollIndicators);
        setTimeout(syncScrollIndicators, 180);
        setTimeout(syncScrollIndicators, 650);
        
        // Animar estadísticas si es el modal "nosotros"
        if (modalId === 'nosotros') {
            setTimeout(animateStats, 300);
        }

        // Cargar sucursales si es el modal "sucursales"
        if (modalId === 'sucursales') {
            if (sucursales.length === 0) {
                loadSucursales();
            } else {
                renderSucursales();
            }
        }
        
        // Renderizar sucursales si es el modal
        if (modalId === 'sucursales') {
            renderSucursales();
        }

        if (modalId === 'siniestro') {
            if (hasFormConfig()) {
                renderDynamicMenu();
            } else {
                renderFormConfigLoader('Cargando tipos de denuncia...');
                loadFormConfig({ force: true, silent: true }).catch(error => {
                    console.warn('⚠️ No se pudo precargar la configuración de siniestros:', error);
                });
            }
        }
    }
}

function closeModal(modalId) {


    const modal = document.getElementById(`modal-${modalId}`);
    if (modal) {
        modal.classList.remove('active');

        document.body.style.overflow = 'auto';
        syncScrollIndicators();
        window.requestAnimationFrame(syncScrollIndicators);

        // RESET Siniestro Modal specifically
        if (modalId === 'siniestro') {
            resetSiniestro();
        }
    }
}

function resetSiniestro() {
    // 1. Reset Internal State (UI)
    // Hide Form & Selection steps
    document.getElementById('step-form-siniestro').classList.remove('active');
    document.getElementById('step-selection-siniestro').classList.remove('active');
    
    // Show Validation step (Start fresh)
    document.getElementById('step-validation-siniestro').classList.add('active');

    // 2. Clear Iframe content to stop video/form
    const iframeWrapper = document.getElementById('iframe-wrapper-siniestro');
    if (iframeWrapper) iframeWrapper.innerHTML = '';
}

// Función para actualizar el indicador de pasos
function updateSiniestroStep(step) {
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`sin-dot-${i}`);
        if (dot) {
            dot.classList.remove('active', 'completed');
            if (i < step) {
                dot.classList.add('completed');
            } else if (i === step) {
                dot.classList.add('active');
            }
        }
    }
}

// Cerrar modal al hacer click afuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        const modalId = e.target.id.replace('modal-', '');
        closeModal(modalId);
    }
});

// Cerrar modal con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {


        document.querySelectorAll('.modal.active').forEach(modal => {
            const modalId = modal.id.replace('modal-', '');
            closeModal(modalId);
        });
    }
});

// =====================================================
// ACCORDION (FAQ)
// =====================================================

document.querySelectorAll('.accordion-header').forEach(button => {
    button.addEventListener('click', () => {
        const item = button.parentElement;
        const isActive = item.classList.contains('active');
        
        // Cerrar todos
        document.querySelectorAll('.accordion-item').forEach(i => {
            i.classList.remove('active');
        });
        
        // Abrir el seleccionado si no estaba activo
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// =====================================================
// SUCURSALES
// =====================================================

function renderSucursales() {
    const container = document.querySelector('.branches-list');
    if (!container) return;
    
    container.innerHTML = sucursales.map(suc => `
        <div class="branch-item" 
             onclick="window.open('${suc.googleMap}', '_blank')"
             onmouseenter="updateMapPreview('${suc.direccion}, ${suc.localidad}')">
            <div class="branch-icon">
                <i class="fas fa-building"></i>
            </div>
            <div class="branch-info">
                <h3>${suc.nombre.replace(/\s*\([^)]*\)\s*$/, '').trim()}</h3>
                <p>${suc.direccion}</p>
                <span class="branch-locality">${suc.localidad}</span>
                <span class="branch-hours">${suc.horario}</span>
            </div>
            <i class="fas fa-external-link-alt"></i>
        </div>
    `).join('');
}

function updateMapPreview(address) {
    const mapFrame = document.querySelector('#map iframe');
    if (mapFrame) {
        // Simple Google Maps Embed without API Key (Search mode)
        const query = encodeURIComponent(address);
        mapFrame.src = `https://maps.google.com/maps?q=${query}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
    }
}

// =====================================================
// ESTADÍSTICAS ANIMADAS
// =====================================================

function animateStats() {
    // Seleccionar todos los elementos de estadísticas
    const stats = document.querySelectorAll('.stat-number, .qs-stat-number');
    
    stats.forEach(stat => {
        const targetAttr = stat.dataset.target;
        if (!targetAttr) return;
        
        const target = parseInt(targetAttr, 10);
        if (isNaN(target) || target <= 0) {
            stat.textContent = '0';
            return;
        }
        
        // Iniciar desde 0
        stat.textContent = '0';
        
        // Animación más fluida
        const duration = 5000; // 5 segundos
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Función de easing para efecto más natural
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(target * easeOut);
            
            stat.textContent = current.toLocaleString();
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                stat.textContent = target.toLocaleString();
            }
        }
        
        requestAnimationFrame(update);
    });
}

// =====================================================
// STAR RATING
// =====================================================

let selectedRating = 0;

document.querySelectorAll('.star-rating input').forEach(input => {
    input.addEventListener('change', (e) => {
        selectedRating = parseInt(e.target.value);
    });
});

// =====================================================
// FORMULARIOS
// =====================================================

// Número de WhatsApp de la empresa (cambiar por el real)
const WHATSAPP_NUMBER = '5493415551234';

// =====================================================
// MULTICOTIZADOR DE SEGUROS
// =====================================================

// Estado global del multicotizador
let mcotCurrentStep = 1;
let mcotVehiculoData = {};
let mcotContactoData = {};
let mcotResultados = [];
let mcotIdGestion = null;

// Cache de datos de la API
let mcotBrandsCache = [];
let mcotModelsCache = {};
let mcotVersionsCache = {};

// URL base de la API ArgAutos (gratuita, sin API key)
const ARGAUTOS_API = 'https://argautos.com/api/v1';

// Nombres legibles de coberturas
const COBERTURA_NOMBRES = {
  'rc': 'Responsabilidad Civil',
  'tc': 'Terceros Completo',
  'tcg': 'Terceros Completo + Granizo',
  'trcf': 'Todo Riesgo con Franquicia',
  'trsf': 'Todo Riesgo sin Franquicia'
};

// ---- CARGA DINÁMICA DE MARCAS DESDE API ---- 
(async function mcotInitBrands() {
  const sel = document.getElementById('mcot-marca');
  if (!sel) return;
  
  try {
    sel.classList.add('mcot-loading');
    // Cargar todas las páginas de marcas
    let allBrands = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const resp = await fetch(`${ARGAUTOS_API}/brands?page=${page}`);
      const data = await resp.json();
      allBrands = allBrands.concat(data.data || []);
      hasMore = data.links?.next !== null;
      page++;
    }
    
    // Ordenar alfabéticamente
    allBrands.sort((a, b) => a.name.localeCompare(b.name));
    mcotBrandsCache = allBrands;
    
    // Populate el select
    sel.innerHTML = '<option value="">Seleccioná una marca</option>';
    allBrands.forEach(brand => {
      const opt = document.createElement('option');
      opt.value = brand.id;
      // Capitalizar nombre: "FIAT" → "Fiat"
      opt.textContent = brand.name.split(' ').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(' ');
      opt.dataset.name = brand.name;
      sel.appendChild(opt);
    });
    
    sel.classList.remove('mcot-loading');
  } catch (err) {
    console.warn('⚠️ Error cargando marcas de API, usando fallback:', err);
    sel.classList.remove('mcot-loading');
    // Fallback: marcas estáticas más comunes
    sel.innerHTML = `
      <option value="">Seleccioná una marca</option>
      <option value="3" data-name="AUDI">Audi</option>
      <option value="5" data-name="BMW">BMW</option>
      <option value="8" data-name="CHERY">Chery</option>
      <option value="9" data-name="CHEVROLET">Chevrolet</option>
      <option value="11" data-name="CITROEN">Citroën</option>
      <option value="13" data-name="DODGE">Dodge</option>
      <option value="18" data-name="FIAT">Fiat</option>
      <option value="19" data-name="FORD">Ford</option>
      <option value="25" data-name="HONDA">Honda</option>
      <option value="26" data-name="HYUNDAI">Hyundai</option>
      <option value="30" data-name="JEEP">Jeep</option>
      <option value="35" data-name="KIA">Kia</option>
      <option value="44" data-name="MERCEDES BENZ">Mercedes Benz</option>
      <option value="48" data-name="NISSAN">Nissan</option>
      <option value="49" data-name="PEUGEOT">Peugeot</option>
      <option value="52" data-name="RENAULT">Renault</option>
      <option value="59" data-name="SUZUKI">Suzuki</option>
      <option value="60" data-name="TOYOTA">Toyota</option>
      <option value="61" data-name="VOLKSWAGEN">Volkswagen</option>
    `;
  }
})();

// ---- GEOREF: Carga de Provincias desde API del Gobierno ----
const GEOREF_API = 'https://apis.datos.gob.ar/georef/api';

(async function mcotInitProvincias() {
  const sel = document.getElementById('mcot-provincia');
  if (!sel) return;
  
  try {
    const resp = await fetch(`${GEOREF_API}/provincias?campos=id,nombre&max=50&orden=nombre`);
    const data = await resp.json();
    const provincias = data.provincias || [];
    
    sel.innerHTML = '<option value="">Seleccioná una provincia</option>';
    provincias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    provincias.forEach(prov => {
      const opt = document.createElement('option');
      opt.value = prov.id;
      opt.textContent = prov.nombre;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.warn('⚠️ Error cargando provincias:', err);
    // Fallback: provincias más comunes
    sel.innerHTML = `
      <option value="">Seleccioná una provincia</option>
      <option value="06">Buenos Aires</option>
      <option value="02">Ciudad Autónoma de Buenos Aires</option>
      <option value="14">Córdoba</option>
      <option value="82">Santa Fe</option>
      <option value="50">Mendoza</option>
      <option value="90">Tucumán</option>
      <option value="54">Misiones</option>
      <option value="22">Chaco</option>
      <option value="30">Entre Ríos</option>
      <option value="62">Río Negro</option>
      <option value="58">Neuquén</option>
      <option value="70">San Juan</option>
      <option value="74">San Luis</option>
      <option value="66">Salta</option>
      <option value="38">Jujuy</option>
      <option value="18">Corrientes</option>
    `;
  }
})();

// ---- CASCADA: Provincia → Localidades ----
document.getElementById('mcot-provincia')?.addEventListener('change', async (e) => {
  const provId = e.target.value;
  const locSel = document.getElementById('mcot-localidad');
  
  if (!provId) {
    locSel.innerHTML = '<option value="">Primero seleccioná provincia</option>';
    locSel.disabled = true;
    return;
  }
  
  locSel.innerHTML = '<option value="">Cargando localidades...</option>';
  locSel.disabled = true;
  locSel.classList.add('mcot-loading');
  
  try {
    const resp = await fetch(`${GEOREF_API}/localidades?provincia=${provId}&campos=id,nombre&max=1000&orden=nombre`);
    const data = await resp.json();
    const localidades = data.localidades || [];
    
    locSel.innerHTML = '<option value="">Seleccioná una localidad</option>';
    localidades.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = loc.nombre;
      locSel.appendChild(opt);
    });
    
    locSel.disabled = false;
    locSel.classList.remove('mcot-loading');
  } catch (err) {
    console.warn('⚠️ Error cargando localidades:', err);
    locSel.innerHTML = '<option value="">Ingresá manualmente</option>';
    locSel.disabled = false;
    locSel.classList.remove('mcot-loading');
  }
});

// ---- CASCADA: Marca → Modelos ----
document.getElementById('mcot-marca')?.addEventListener('change', async (e) => {
  const brandId = e.target.value;
  const modelSel = document.getElementById('mcot-modelo');
  const versionSel = document.getElementById('mcot-version');
  
  // Reset modelo y versión
  modelSel.innerHTML = '<option value="">Cargando modelos...</option>';
  modelSel.disabled = true;
  modelSel.classList.add('mcot-loading');
  versionSel.innerHTML = '<option value="">Primero seleccioná un modelo</option>';
  versionSel.disabled = true;
  
  if (!brandId) {
    modelSel.innerHTML = '<option value="">Primero seleccioná una marca</option>';
    modelSel.classList.remove('mcot-loading');
    return;
  }
  
  try {
    // Verificar cache
    if (mcotModelsCache[brandId]) {
      mcotPopulateModels(mcotModelsCache[brandId], modelSel);
      return;
    }
    
    // Cargar modelos (pueden ser paginados)
    let allModels = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const resp = await fetch(`${ARGAUTOS_API}/brands/${brandId}/models?page=${page}`);
      const data = await resp.json();
      allModels = allModels.concat(data.data || []);
      hasMore = data.links?.next !== null;
      page++;
    }
    
    allModels.sort((a, b) => a.name.localeCompare(b.name));
    mcotModelsCache[brandId] = allModels;
    mcotPopulateModels(allModels, modelSel);
    
  } catch (err) {
    console.warn('Error cargando modelos:', err);
    modelSel.innerHTML = '<option value="">Error - escribí el modelo manualmente</option>';
    modelSel.classList.remove('mcot-loading');
  }
});

function mcotPopulateModels(models, sel) {
  sel.innerHTML = '<option value="">Seleccioná un modelo</option>';
  models.forEach(model => {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = model.name.split(' ').map(w => 
      w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join(' ');
    opt.dataset.name = model.name;
    sel.appendChild(opt);
  });
  sel.disabled = false;
  sel.classList.remove('mcot-loading');
}

// ---- CASCADA: Modelo → Versiones ----
document.getElementById('mcot-modelo')?.addEventListener('change', async (e) => {
  const modelId = e.target.value;
  const versionSel = document.getElementById('mcot-version');
  
  versionSel.innerHTML = '<option value="">Cargando versiones...</option>';
  versionSel.disabled = true;
  versionSel.classList.add('mcot-loading');
  
  if (!modelId) {
    versionSel.innerHTML = '<option value="">Primero seleccioná un modelo</option>';
    versionSel.classList.remove('mcot-loading');
    return;
  }
  
  try {
    if (mcotVersionsCache[modelId]) {
      mcotPopulateVersions(mcotVersionsCache[modelId], versionSel);
      return;
    }
    
    let allVersions = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const resp = await fetch(`${ARGAUTOS_API}/models/${modelId}/versions?page=${page}`);
      const data = await resp.json();
      allVersions = allVersions.concat(data.data || []);
      hasMore = data.links?.next !== null;
      page++;
    }
    
    mcotVersionsCache[modelId] = allVersions;
    mcotPopulateVersions(allVersions, versionSel);
    
  } catch (err) {
    console.warn('Error cargando versiones:', err);
    versionSel.innerHTML = '<option value="">No se pudieron cargar versiones</option>';
    versionSel.classList.remove('mcot-loading');
  }
});

function mcotPopulateVersions(versions, sel) {
  sel.innerHTML = '<option value="">Seleccioná una versión (opcional)</option>';
  versions.forEach(ver => {
    const opt = document.createElement('option');
    opt.value = ver.id;
    opt.textContent = ver.name;
    opt.dataset.name = ver.name;
    sel.appendChild(opt);
  });
  sel.disabled = false;
  sel.classList.remove('mcot-loading');
}

// ---- BÚSQUEDA POR PATENTE ----
async function mcotBuscarPatente() {
  const input = document.getElementById('mcot-patente');
  const status = document.getElementById('mcot-patente-status');
  const btn = document.getElementById('mcot-btn-patente');
  const patente = input.value.trim().toUpperCase().replace(/\s/g, '');
  
  if (!patente || patente.length < 6) {
    status.textContent = '⚠️ Ingresá una patente válida (6-7 caracteres)';
    status.className = 'error';
    status.style.display = 'block';
    return;
  }
  
  btn.disabled = true;
  status.textContent = '🔍 Buscando datos del vehículo...';
  status.className = 'loading';
  status.style.display = 'block';
  
  try {
    // Intentar buscar en nuestro backend
    const resp = await fetchWithTimeout(
      `https://web-production-2584d.up.railway.app/api/consulta-patente/${patente}`,
      { method: 'GET' }
    );
    
    if (resp.ok) {
      const data = await resp.json();
      if (data.marca && data.modelo) {
        // Auto-seleccionar marca
        const marcaSel = document.getElementById('mcot-marca');
        const marcaOpt = Array.from(marcaSel.options).find(o => 
          o.dataset.name && o.dataset.name.toUpperCase() === data.marca.toUpperCase()
        );
        if (marcaOpt) {
          marcaSel.value = marcaOpt.value;
          marcaSel.dispatchEvent(new Event('change'));
          
          // Esperar que se carguen modelos y auto-seleccionar
          setTimeout(() => {
            const modelSel = document.getElementById('mcot-modelo');
            const modelOpt = Array.from(modelSel.options).find(o =>
              o.dataset.name && o.dataset.name.toUpperCase().includes(data.modelo.toUpperCase())
            );
            if (modelOpt) {
              modelSel.value = modelOpt.value;
              modelSel.dispatchEvent(new Event('change'));
            }
          }, 1500);
        }
        
        // Auto-seleccionar año si viene
        if (data.anio) {
          const anioSel = document.getElementById('mcot-anio');
          anioSel.value = data.anio;
        }
        
        status.textContent = `✅ Encontrado: ${data.marca} ${data.modelo} ${data.anio || ''}`;
        status.className = 'success';
      } else {
        throw new Error('No data');
      }
    } else {
      throw new Error('Not found');
    }
  } catch (err) {
    // Endpoint no disponible aún - mostrar mensaje amigable
    status.textContent = '📋 Consulta de patentes próximamente. Completá los datos manualmente.';
    status.className = 'error';
    console.info('Consulta patente no disponible aún:', err);
  }
  
  btn.disabled = false;
}

// Populate select de años (últimos 16 años)
(function populateAnios() {
  const sel = document.getElementById('mcot-anio');
  if (!sel) return;
  const currentYear = new Date().getFullYear();
  for (let y = currentYear + 1; y >= currentYear - 15; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    sel.appendChild(opt);
  }
})();

// Navegación entre pasos
function mcotGoStep(step) {
  // Ocultar todos los paneles
  document.querySelectorAll('.mcot-panel').forEach(p => p.classList.remove('active'));
  
  // Mostrar panel del paso indicado
  const panel = document.getElementById(`mcot-step-${step}`);
  if (panel) panel.classList.add('active');
  
  // Actualizar barra de progreso
  document.querySelectorAll('.mcot-step-dot').forEach(dot => {
    const dotStep = parseInt(dot.dataset.step);
    dot.classList.remove('active', 'completed');
    if (dotStep < step) dot.classList.add('completed');
    else if (dotStep === step) dot.classList.add('active');
  });
  
  // Actualizar líneas de progreso
  const lines = document.querySelectorAll('.mcot-step-line');
  lines.forEach((line, idx) => {
    line.classList.toggle('completed', idx < step - 1);
  });
  
  mcotCurrentStep = step;
  syncScrollIndicators();
}

// PASO 1: Formulario Vehículo → Paso 2
document.getElementById('mcot-form-vehiculo')?.addEventListener('submit', (e) => {
  e.preventDefault();
  
  // Obtener nombre legible de marca y modelo desde los options seleccionados
  const marcaSel = document.getElementById('mcot-marca');
  const modeloSel = document.getElementById('mcot-modelo');
  const versionSel = document.getElementById('mcot-version');
  
  const marcaName = marcaSel.options[marcaSel.selectedIndex]?.textContent || marcaSel.value;
  const modeloName = modeloSel.options[modeloSel.selectedIndex]?.textContent || modeloSel.value;
  const versionName = versionSel.options[versionSel.selectedIndex]?.textContent || '';
  
  mcotVehiculoData = {
    marca: marcaName,
    marca_id: marcaSel.value,
    modelo: modeloName,
    modelo_id: modeloSel.value,
    version: versionName !== 'Seleccioná una versión (opcional)' ? versionName : '',
    version_id: versionSel.value,
    anio: document.getElementById('mcot-anio').value,
    gnc: document.getElementById('mcot-gnc').value,
    cobertura: document.getElementById('mcot-cobertura').value,
    provincia: document.getElementById('mcot-provincia')?.options[document.getElementById('mcot-provincia').selectedIndex]?.textContent || '',
    localidad: document.getElementById('mcot-localidad')?.options[document.getElementById('mcot-localidad').selectedIndex]?.textContent || '',
    patente: document.getElementById('mcot-patente')?.value?.toUpperCase() || ''
  };
  
  mcotGoStep(2);
});

// PASO 2: Formulario Contacto → Buscar cotizaciones
document.getElementById('mcot-form-contacto')?.addEventListener('submit', (e) => {
  e.preventDefault();
  
  mcotContactoData = {
    nombre: document.getElementById('mcot-nombre').value,
    whatsapp: document.getElementById('mcot-whatsapp').value,
    email: document.getElementById('mcot-email').value || ''
  };
  
  mcotGoStep(3);
  mcotBuscarCotizaciones();
});

// Polling para obtener resultados (cada 5 segundos, máximo 3 minutos)
async function mcotPollResultados(idGestion) {
  const maxIntentos = 36; // 3 minutos / 5 segundos
  const intervaloMs = 5000;
  
  for (let intento = 1; intento <= maxIntentos; intento++) {
    console.log(`🔄 Polling intento ${intento}/${maxIntentos}...`);
    
    await new Promise(resolve => setTimeout(resolve, intervaloMs));
    
    try {
      const response = await fetchWithTimeout(
        `https://web-production-2584d.up.railway.app/api/cotizar-status/${idGestion}`,
        { timeout: 10000 }
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      // Si hay cotizaciones, retornarlas
      if (data.cotizaciones && data.cotizaciones.length > 0) {
        console.log('✅ Resultados obtenidos:', data.cotizaciones.length);
        return data.cotizaciones;
      }
      
      // Si el estado es "cotizado" o "error" pero sin resultados, salir del loop
      if (data.estado === 'cotizado' || data.estado === 'error') {
        console.log('⚠️ Proceso terminado sin resultados');
        return [];
      }
      
    } catch (e) {
      console.warn('⚠️ Error en polling:', e);
    }
  }
  
  console.log('⏱️ Timeout de polling alcanzado');
  return [];
}

// Buscar cotizaciones REALES via scraping 123Seguro
async function mcotBuscarCotizaciones() {
  const loader = document.getElementById('mcot-loader');
  const resumen = document.getElementById('mcot-resumen');
  
  // Mostrar loader
  loader.style.display = 'block';
  resumen.style.display = 'none';
  
  // Actualizar texto del loader con info real
  const versionText = mcotVehiculoData.version ? ` - ${mcotVehiculoData.version}` : '';
  document.getElementById('mcot-loader-vehiculo').textContent = 
    `${mcotVehiculoData.marca} ${mcotVehiculoData.modelo} ${mcotVehiculoData.anio}${versionText}`;
  
  // Actualizar mensaje del loader para scraping real (tarda más)
  const loaderMsg = loader.querySelector('.mcot-loader-text');
  if (loaderMsg) {
    loaderMsg.innerHTML = `
      <strong>Consultando aseguradoras en tiempo real...</strong><br>
      <small>Esto puede tomar entre 30 y 60 segundos</small>
    `;
  }
  
  // Reset animación del loader fill (más lenta para scraping real)
  const fill = loader.querySelector('.mcot-loader-fill');
  if (fill) {
    fill.style.animation = 'none';
    fill.offsetHeight;
    fill.style.animation = 'mcotLoaderProgress 45s ease-in-out forwards, mcotShimmer 1.5s linear infinite';
  }
  
  try {
    // Armar payload con datos del vehículo (REALES) + datos contacto del cliente (REALES para Airtable)
    const payload = {
      marca: mcotVehiculoData.marca,
      modelo: mcotVehiculoData.modelo,
      version: mcotVehiculoData.version || '',
      anio: parseInt(mcotVehiculoData.anio),
      gnc: mcotVehiculoData.gnc === 'si',
      provincia: mcotVehiculoData.provincia || 'Buenos Aires',
      localidad: mcotVehiculoData.localidad || 'Capital Federal',
      // Datos REALES del cliente (van a Airtable, NO a 123seguro)
      cliente_nombre: mcotContactoData.nombre || '',
      cliente_whatsapp: mcotContactoData.whatsapp || '',
      cliente_email: mcotContactoData.email || '',
      cliente_patente: mcotVehiculoData.patente || '',
    };
    
    const response = await fetchWithTimeout(
      'https://web-production-2584d.up.railway.app/api/cotizar-123seguro',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 120000 // 120 segundos timeout (scraping tarda)
      }
    );
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    // Guardar id_gestion para polling y selección
    mcotIdGestion = data.id_gestion;
    
    // Verificar si hay resultados inmediatos o si hay que hacer polling
    if (data.cotizaciones && data.cotizaciones.length > 0) {
      mcotResultados = data.cotizaciones;
    } else if (mcotIdGestion) {
      // Hacer polling cada 5 segundos (máx 3 minutos = 36 intentos)
      console.log('🔄 Iniciando polling para id:', mcotIdGestion);
      mcotResultados = await mcotPollResultados(mcotIdGestion);
    } else {
      mcotResultados = [];
    }
    
    // Si el backend devolvió 0 resultados reales
    if (mcotResultados.length === 0 && !data.exito) {
      console.info('Scraping no devolvió resultados:', data.error);
    }
    
  } catch (err) {
    console.warn('⚠️ Error en scraping:', err);
    mcotResultados = [];
  }
  
  // Ocultar loader y mostrar resultados
  loader.style.display = 'none';
  resumen.style.display = 'block';
  
  // Actualizar resumen del vehículo
  const resumenVersion = mcotVehiculoData.version ? ` - ${mcotVehiculoData.version}` : '';
  document.getElementById('mcot-resumen-vehiculo').textContent = 
    `${mcotVehiculoData.marca} ${mcotVehiculoData.modelo} (${mcotVehiculoData.anio})${resumenVersion}`;
  document.getElementById('mcot-resumen-cobertura').textContent = 
    mcotVehiculoData.provincia ? `${mcotVehiculoData.localidad}, ${mcotVehiculoData.provincia}` : 'Argentina';
  
  // Render de resultados
  mcotRenderResults();
}

// Ya no se usan datos demo/fallback — solo datos reales del scraping

// Render de cards de resultados con datos REALES del scraping
function mcotRenderResults() {
  const grid = document.getElementById('mcot-results-grid');
  const countEl = document.getElementById('mcot-results-count');
  
  if (!grid) return;
  
  // Si no hay resultados, mostrar mensaje honesto
  if (!mcotResultados || mcotResultados.length === 0) {
    countEl.textContent = '0';
    grid.innerHTML = `
      <div class="mcot-no-results">
        <i class="fas fa-exclamation-circle" style="font-size:2rem;color:var(--accent-primary);margin-bottom:1rem;"></i>
        <h4>No pudimos obtener cotizaciones en este momento</h4>
        <p>Un asesor te contactará a la brevedad con las mejores opciones para tu vehículo.</p>
        <button class="mcot-btn-elegir" onclick="mcotContactarAsesor()" style="margin-top:1rem;">
          <i class="fab fa-whatsapp"></i> Contactar asesor ahora
        </button>
      </div>
    `;
    return;
  }
  
  // Ordenar por precio (menor primero por default)
  mcotSortResults();
  
  countEl.textContent = mcotResultados.length;
}

// Sorting de resultados
function mcotSortResults() {
  const sortVal = document.getElementById('mcot-sort')?.value || 'precio-asc';
  
  const sorted = [...mcotResultados];
  if (sortVal === 'precio-asc') sorted.sort((a,b) => a.precio_mensual - b.precio_mensual);
  else if (sortVal === 'precio-desc') sorted.sort((a,b) => b.precio_mensual - a.precio_mensual);
  else if (sortVal === 'compania') sorted.sort((a,b) => a.compania.localeCompare(b.compania));
  
  const grid = document.getElementById('mcot-results-grid');
  if (!grid) return;
  
  const minPrice = Math.min(...sorted.map(c => c.precio_mensual));
  
  grid.innerHTML = sorted.map((cot, idx) => {
    const isBest = cot.precio_mensual === minPrice;
    // Adaptar a datos del scraping real
    const coberturas = cot.coberturas_incluidas || [];
    const tags = coberturas.map(t => 
      `<span class="mcot-tag"><i class="fas fa-check"></i> ${t}</span>`
    ).join('');
    
    const detalles = (cot.detalles || []).map(d => `<li>${d}</li>`).join('');
    const textoCompleto = cot.texto_completo ? `<li>${cot.texto_completo.substring(0, 200)}</li>` : '';
    
    const sumaFormatted = cot.suma_asegurada 
      ? `$ ${Number(cot.suma_asegurada).toLocaleString('es-AR')}` 
      : '-';
    
    const nombreAseg = cot.aseguradora || cot.compania || 'Aseguradora';
    const logoInicial = cot.logo_inicial || nombreAseg.substring(0,2).toUpperCase();
    const logoImg = cot.logo_url ? `<img src="${cot.logo_url}" alt="${nombreAseg}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
    
    return `
      <div class="mcot-card ${isBest ? 'mcot-best' : ''}" data-idx="${idx}">
        <div class="mcot-card-header">
          <div class="mcot-card-company">
            <div class="mcot-card-logo">
              ${logoImg}
              <span class="mcot-logo-fallback" ${logoImg ? 'style="display:none"' : ''}>${logoInicial}</span>
            </div>
            <div class="mcot-card-company-info">
              <h4>${nombreAseg}</h4>
              <p class="mcot-cobertura-name">${cot.tipo_cobertura || cot.cobertura || ''}</p>
            </div>
          </div>
          <div class="mcot-card-price">
            <div class="mcot-price-amount">${cot.precio_texto || '$ ' + Number(cot.precio_mensual).toLocaleString('es-AR')}</div>
            <div class="mcot-price-period">por mes</div>
          </div>
        </div>
        
        <div class="mcot-card-suma">
          <span class="mcot-suma-label">Suma asegurada</span>
          <span class="mcot-suma-value">${sumaFormatted}</span>
        </div>
        
        ${tags ? `<div class="mcot-card-tags">${tags}</div>` : ''}
        
        <div class="mcot-card-details" id="mcot-details-${idx}">
          <ul>${detalles || textoCompleto}</ul>
        </div>
        
        <div class="mcot-card-actions">
          <button class="mcot-btn-details" onclick="mcotToggleDetails(${idx})">
            <i class="fas fa-info-circle"></i> Detalles
          </button>
          <button class="mcot-btn-elegir" onclick="mcotElegirCotizacion(${idx})">
            <i class="fab fa-whatsapp"></i> Me interesa
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // Agregar disclaimer legal al final
  grid.innerHTML += `
    <div class="mcot-disclaimer">
      <i class="fas fa-info-circle"></i>
      Precios estimativos al momento de la consulta. Pueden tener variaciones al momento de la contratación.
    </div>
  `;
}

// Toggle detalles de una card
function mcotToggleDetails(idx) {
  const details = document.getElementById(`mcot-details-${idx}`);
  if (details) {
    details.classList.toggle('open');
  }
}

// Elegir cotización → Guardar en Airtable + mostrar éxito
async function mcotElegirCotizacion(idx) {
  const cot = mcotResultados.sort((a,b) => {
    const sortVal = document.getElementById('mcot-sort')?.value || 'precio-asc';
    if (sortVal === 'precio-asc') return a.precio_mensual - b.precio_mensual;
    if (sortVal === 'precio-desc') return b.precio_mensual - a.precio_mensual;
    return a.compania.localeCompare(b.compania);
  })[idx];
  
  if (!cot) return;
  
  // Si no hay id_gestion, fallback a WhatsApp
  if (!mcotIdGestion) {
    mcotElegirCotizacionWhatsapp(idx);
    return;
  }
  
  // Construir texto de cotización elegida
  const cotizacionTexto = `${cot.aseguradora || cot.compania} - ${cot.precio_texto || '$' + cot.precio_mensual}/mes - ${cot.tipo_cobertura || ''}`;
  
  try {
    const response = await fetchWithTimeout(
      'https://web-production-2584d.up.railway.app/api/cotizar-elegir',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_prospecto: mcotIdGestion,
          cotizacion_elegida: cotizacionTexto
        }),
        timeout: 15000
      }
    );
    
    if (!response.ok) throw new Error('Error en solicitud');
    
    const data = await response.json();
    
    // Mostrar modal de éxito
    mcotMostrarExito(data.mensaje || '¡Excelente elección! Un asesor se comunicará contigo pronto.');
    
  } catch (err) {
    console.warn('⚠️ Error guardando elección, fallback a WhatsApp:', err);
    mcotElegirCotizacionWhatsapp(idx);
  }
}

// Fallback: abrir WhatsApp si falla el guardado en Airtable
function mcotElegirCotizacionWhatsapp(idx) {
  const cot = mcotResultados.sort((a,b) => {
    const sortVal = document.getElementById('mcot-sort')?.value || 'precio-asc';
    if (sortVal === 'precio-asc') return a.precio_mensual - b.precio_mensual;
    if (sortVal === 'precio-desc') return b.precio_mensual - a.precio_mensual;
    return a.compania.localeCompare(b.compania);
  })[idx];
  
  if (!cot) return;
  
  const coberturaLabel = COBERTURA_NOMBRES[mcotVehiculoData.cobertura] || mcotVehiculoData.cobertura;
  
  const mensaje = `🚘 *COTIZACIÓN DE SEGURO*%0A%0A` +
    `*Vehículo:* ${mcotVehiculoData.marca} ${mcotVehiculoData.modelo} (${mcotVehiculoData.anio})%0A` +
    `*GNC:* ${mcotVehiculoData.gnc === 'si' ? 'Sí' : 'No'}%0A` +
    `*Cobertura:* ${coberturaLabel}%0A%0A` +
    `✅ *Me interesa la opción:*%0A` +
    `*Compañía:* ${cot.compania || cot.aseguradora}%0A` +
    `*Precio:* $${cot.precio_mensual.toLocaleString('es-AR')}/mes%0A%0A` +
    `*Contacto:* ${mcotContactoData.nombre}%0A` +
    `*WhatsApp:* ${mcotContactoData.whatsapp}%0A` +
    `${mcotContactoData.email ? `*Email:* ${mcotContactoData.email}%0A` : ''}` +
    `%0ASolicito cotización formal, gracias.`;
  
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`, '_blank');
}

// Mostrar modal de éxito
function mcotMostrarExito(mensaje) {
  const grid = document.getElementById('mcot-results-grid');
  if (!grid) return;
  
  grid.innerHTML = `
    <div class="mcot-success" style="grid-column: 1/-1; text-align: center; padding: 2rem;">
      <i class="fas fa-check-circle" style="font-size: 4rem; color: var(--success-color); margin-bottom: 1rem;"></i>
      <h3>${mensaje}</h3>
      <p style="margin-top: 1rem;"> Mientras tanto, puedes contactarnos directamente:</p>
      <button class="mcot-btn-elegir" onclick="window.open('https://wa.me/${WHATSAPP_NUMBER}', '_blank')" style="margin-top: 1rem;">
        <i class="fab fa-whatsapp"></i> Chatear con asesor
      </button>
    </div>
  `;
}

// Contactar asesor sin elegir opción
function mcotContactarAsesor() {
  const coberturaLabel = COBERTURA_NOMBRES[mcotVehiculoData.cobertura] || mcotVehiculoData.cobertura;
  
  const mensaje = `🚘 *CONSULTA MULTICOTIZACIÓN*%0A%0A` +
    `*Vehículo:* ${mcotVehiculoData.marca} ${mcotVehiculoData.modelo} (${mcotVehiculoData.anio})%0A` +
    `*GNC:* ${mcotVehiculoData.gnc === 'si' ? 'Sí' : 'No'}%0A` +
    `*Cobertura:* ${coberturaLabel}%0A%0A` +
    `*Contacto:* ${mcotContactoData.nombre}%0A` +
    `*WhatsApp:* ${mcotContactoData.whatsapp}%0A` +
    `${mcotContactoData.email ? `*Email:* ${mcotContactoData.email}%0A` : ''}` +
    `%0AQuiero que me asesoren sobre las opciones, gracias.`;
  
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${mensaje}`, '_blank');
}

// Reset del multicotizador al cerrar modal
const originalCloseModal = closeModal;
closeModal = function(modalId) {
  if (modalId === 'cotizador') {
    // Reset wizard al paso 1
    mcotGoStep(1);
    // Limpiar formularios
    document.getElementById('mcot-form-vehiculo')?.reset();
    document.getElementById('mcot-form-contacto')?.reset();
    // Ocultar loader y resultados
    const loader = document.getElementById('mcot-loader');
    const resumen = document.getElementById('mcot-resumen');
    if (loader) loader.style.display = 'none';
    if (resumen) resumen.style.display = 'none';
    // Reset datos
    mcotVehiculoData = {};
    mcotContactoData = {};
    mcotResultados = [];
  }
  originalCloseModal(modalId);
};

// Formulario Siniestro
// Auto-fill form data from URL parameters
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const dni = urlParams.get('dni');
    const patente = urlParams.get('patente');
    const nombre = urlParams.get('nombre');

    if (dni) {
        if(document.getElementById('dni')) document.getElementById('dni').value = dni;
        if(document.getElementById('dni-califica')) document.getElementById('dni-califica').value = dni;
    }
    if (patente && document.getElementById('patente')) {
        document.getElementById('patente').value = patente;
    }
    if (nombre && document.getElementById('nombre-califica')) {
        document.getElementById('nombre-califica').value = nombre;
    }

    // --- NUEVO: Manejo de sección Siniestro desde Agente IA ---
    const section = urlParams.get('section');
    const modalParam = urlParams.get('modal');
    const polizaId = urlParams.get('poliza_id');
    
    if (section === 'siniestro') {
        openModal('siniestro');
        if (dni && polizaId) {
            // Pre-cargar sesión para saltar validación
            sessionStorage.setItem('validacion_siniestro', JSON.stringify({
                dni: dni,
                polizaRecordId: polizaId,
                nombres: nombre || 'Cliente'
            }));
            
            // Pequeño delay para que el modal se inicialice
            setTimeout(() => {
                const stepValidation = document.getElementById('step-validation-siniestro');
                if (stepValidation) stepValidation.classList.remove('active');
                
                mostrarSeleccionSiniestro({
                    valid: true,
                    cliente: { nombres: nombre || 'Cliente', apellido: '' },
                    poliza: { record_id: polizaId, numero: 'Validada por IA' }
                });
            }, 600);
        }
    }

    // --- NUEVO: Manejo de Asesoría Online ---
    if (section === 'asesoria' || modalParam === 'asesoria') {
        setTimeout(() => openModal('asesoria'), 500);
    }
});

// Formulario Siniestro
// Formulario Siniestro
// [MOVIDO A FLUJO IFRAME AIRTABLE - VER SECCIÓN FINAL DEL ARCHIVO]

// Dynamic Siniestro File Logic
document.getElementById('tipo-siniestro')?.addEventListener('change', (e) => {
    updateFileRequirements(e.target.value);
});

function updateFileRequirements(tipo) {
    const groups = document.querySelectorAll('.file-group');
    const extraRuedas = document.getElementById('extra-ruedas');
    const extraParcial = document.getElementById('extra-robo-parcial');
    const usoVehiculo = document.getElementById('uso-vehiculo-container');
    
    // 1. Hide EVERYTHING first
    groups.forEach(g => g.classList.add('hidden'));
    if(extraRuedas) extraRuedas.classList.add('hidden');
    if(extraParcial) extraParcial.classList.add('hidden');
    if(usoVehiculo) usoVehiculo.classList.add('hidden');

    // 2. Helper to show specific groups
    const show = (names) => {
        names.forEach(n => {
            document.querySelectorAll(`.file-group[data-group="${n}"]`).forEach(el => el.classList.remove('hidden'));
        });
    };

    // 3. Logic by Type
    switch(tipo) {
        case 'choque':
            show(['identidad', 'carnet', 'daños', 'denuncia']);
            if(usoVehiculo) {
                usoVehiculo.classList.remove('hidden');
                usoVehiculo.style.display = ''; // Clear inline cleanup
            }
            break;
            
        case 'granizo':
            show(['identidad', 'daños']);
            break;

        case 'cristales':
            show(['identidad', 'daños']);
            if(extraParcial) {
                extraParcial.classList.remove('hidden');
                extraParcial.style.display = '';
            } 
            break;
            
        case 'robo': // ROBO TOTAL
            // Solo identidad y denuncia. El auto no está, no hay fotos de daño ni carnet necesario.
            show(['identidad', 'denuncia']);
            break;

        case 'robo-ruedas':
            show(['identidad', 'denuncia']);
            // Usuario especificó: NO fotos de daño.
            if(extraRuedas) {
                extraRuedas.classList.remove('hidden');
                extraRuedas.style.display = '';
            }
            break;

        case 'robo-bateria':
            show(['identidad', 'denuncia', 'bateria']);
            break;

        case 'robo-parcial':
            // Robo de espejo, auxiliar, etc.
            show(['identidad', 'denuncia', 'daños']);
            if(extraParcial) {
                extraParcial.classList.remove('hidden');
                extraParcial.style.display = '';
            }
            break;
            
        case 'incendio-total':
        case 'incendio-parcial':
            show(['identidad', 'denuncia', 'daños', 'bomberos']);
            break;

        case 'otro':
            show(['identidad', 'daños', 'denuncia']);
            break;
    }
}

function showGroup(groupName) {
    // Deprecated by new logic above, but kept if called elsewhere or alias
    const group = document.querySelector(`.file-group[data-group="${groupName}"]`);
    if(group) group.classList.remove('hidden');
}

// Formulario Calificación
// Toggle DNI field visibility based on ES_CLIENTE selection
document.querySelectorAll('input[name="es-cliente"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const dniGroup = document.getElementById('dni-group');
        const fotoGroup = document.getElementById('foto-group');
        const esCliente = e.target.value === 'Sí';
        
        if (dniGroup) {
            dniGroup.style.display = esCliente ? 'flex' : 'none';
        }
        if (fotoGroup) {
            fotoGroup.style.display = esCliente ? 'block' : 'none';
            // Reset checkbox si no es cliente
            if (!esCliente) {
                document.getElementById('usar-foto').checked = false;
            }
        }
    });
});

document.getElementById('form-calificar')?.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nombre = document.getElementById('nombre-califica').value;
    const esCliente = document.querySelector('input[name="es-cliente"]:checked')?.value || 'No';
    const dni = document.getElementById('dni-califica')?.value || '';
    const servicio = document.getElementById('servicio-califica').value;
    const comentario = document.getElementById('comentario').value;
    
    if (selectedRating === 0) {
        Swal.fire('Falta', 'Seleccioná una calificación antes de enviar tu opinión.', 'warning');
        return;
    }
    
    if (!servicio) {
        Swal.fire('Falta', 'Seleccioná qué servicio estás calificando.', 'warning');
        return;
    }
    
    // Datos para enviar al webhook de n8n
    const autorizaPublicar = document.getElementById('autoriza-publicar')?.checked || false;
    const usarFoto = document.getElementById('usar-foto')?.checked || false;
    
    const calificacionData = {
        estrellas: selectedRating,
        nombre: nombre,
        es_cliente: esCliente,
        dni: esCliente === 'Sí' && dni ? parseInt(dni) : null,
        servicio: servicio,
        comentario: comentario,
        modo: 'Online',
        autoriza_publicar: autorizaPublicar,
        usar_foto: usarFoto
    };
    
    console.log('📊 Datos de calificación:', calificacionData);
    
    // Enviar a webhook n8n
    const submitBtn = e.target.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="modern-spinner" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:8px; border-width:2px;"></div> Enviando...';
    submitBtn.disabled = true;
    
    fetchWithTimeout('https://web-production-2584d.up.railway.app/api/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(calificacionData)
    })
    .then(response => response.json())
    .then(async (data) => {
        console.log('✅ Calificación guardada:', data);
        const ratingSeleccionado = selectedRating;
        const nombreMostrado = (nombre || 'Cliente').trim() || 'Cliente';
        const estrellasHtml = Array.from({ length: 5 }, (_, index) => `
            <i class="fas fa-star" style="color:${index < ratingSeleccionado ? '#facc15' : '#cbd5e1'}; font-size: 1rem;"></i>
        `).join('');

        closeModal('calificar');
        
        // Reset form
        e.target.reset();
        selectedRating = 0;
        document.getElementById('dni-group').style.display = 'none';
        document.getElementById('foto-group').style.display = 'none';
        loadDynamicRating();

        await Swal.fire({
            icon: 'success',
            title: 'Calificación registrada',
            html: `
                <div style="font-size: 0.96rem; line-height: 1.42; color: #475569;">
                    Gracias <strong>${escapeHtml(nombreMostrado)}</strong>. Tu opinión quedó registrada correctamente y nos ayuda a seguir mejorando la atención.
                </div>
                <div style="margin-top: 14px; padding: 13px 15px; border-radius: 16px; text-align: left; background: linear-gradient(135deg, rgba(0,210,255,0.10), rgba(58,123,213,0.12)); border: 1px dashed rgba(58,123,213,0.35);">
                    <div style="font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: #1d4ed8; font-weight: 800;">Resumen de tu envío</div>
                    <div style="margin-top: 8px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; color: #334155; font-size: 0.9rem; line-height: 1.28;">
                        <div><strong>Servicio:</strong><br>${escapeHtml(servicio)}</div>
                        <div><strong>Calificación:</strong><br><span style="display:inline-flex; gap:4px; align-items:center;">${estrellasHtml}</span></div>
                        <div><strong>Modo:</strong><br>Online</div>
                        <div><strong>Estado:</strong><br>Opinión recibida</div>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            buttonsStyling: false,
            customClass: {
                popup: 'swal-asesoria-popup',
                title: 'swal-asesoria-title',
                htmlContainer: 'swal-asesoria-html',
                actions: 'swal-asesoria-actions',
                confirmButton: 'swal-asesoria-download'
            }
        });
    })
    .catch(error => {
        console.error('❌ Error:', error);
        Swal.fire('Error al enviar', 'Hubo un problema al registrar tu calificación. Intentá nuevamente.', 'error');
    })
    .finally(() => {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
});

// =====================================================
// RATING DINÁMICO
// =====================================================

function loadDynamicRating() {
    const ratingDisplay = document.getElementById('rating-display');
    if (!ratingDisplay) return;
    
    // URL del webhook n8n para obtener rating promedio
    const RATING_ENDPOINT = 'https://web-production-2584d.up.railway.app/api/rating';
    
    fetchWithTimeout(RATING_ENDPOINT)
        .then(response => response.json())
        .then(data => {
            console.log('⭐ Rating cargado:', data);
            
            const rating = data.rating || 0;
            const total = data.total || 0;
            
            // Generar estrellas visuales con Font Awesome
            let starsHTML = '';
            const fullStars = Math.floor(rating);
            const hasHalf = rating - fullStars >= 0.3 && rating - fullStars < 0.8;
            const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
            
            // Estrellas llenas
            for (let i = 0; i < fullStars; i++) {
                starsHTML += '<i class="fas fa-star"></i>';
            }
            
            // Media estrella si aplica
            if (hasHalf) {
                starsHTML += '<i class="fas fa-star-half-alt"></i>';
            }
            
            // Estrellas vacías
            for (let i = 0; i < emptyStars; i++) {
                starsHTML += '<i class="far fa-star"></i>';
            }
            
            // Actualizar display
            // Usamos una abreviatura o palabra completa según el espacio (aquí "Calificaciones")
            ratingDisplay.innerHTML = `
                ${starsHTML}
                <span>${rating}/5</span>
                <small class="rating-count">(${total} Calificaciones)</small>
            `;
        })
        .catch(error => {
            console.error('❌ Error cargando rating:', error);
            // Mostrar fallback
            ratingDisplay.innerHTML = `
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="fas fa-star"></i>
                <i class="far fa-star"></i>
                <span>4/5</span>
            `;
        });
}

// =====================================================
// TESTIMONIOS CARRUSEL
// =====================================================

let currentTestimonial = 0;
let testimonialInterval = null;

function loadTestimonials() {
    const carousel = document.getElementById('testimonials-carousel');
    const dotsContainer = document.getElementById('carousel-dots');
    if (!carousel) return;
    
    const TESTIMONIOS_ENDPOINT = 'https://web-production-2584d.up.railway.app/api/testimonios';
    
    fetchWithTimeout(TESTIMONIOS_ENDPOINT)
        .then(response => response.json())
        .then(data => {
            console.log('💬 Testimonios cargados:', data);
            
            const testimonios = data.testimonios || [];
            
            if (testimonios.length === 0) {
                carousel.innerHTML = '<div class="no-testimonials">Aún no hay opiniones publicadas</div>';
                return;
            }
            
            // Generar HTML del carrusel
            let trackHTML = '<div class="testimonials-track">';
            let dotsHTML = '';
            
            testimonios.forEach((t, index) => {
                // Generar estrellas
                let starsHTML = '';
                for (let i = 0; i < 5; i++) {
                    starsHTML += i < t.estrellas 
                        ? '<i class="fas fa-star"></i>' 
                        : '<i class="far fa-star"></i>';
                }
                
                // Avatar con foto o iniciales
                const avatarContent = t.fotoUrl 
                    ? `<img src="${t.fotoUrl}" alt="${t.nombre}" onerror="this.outerHTML='${t.iniciales}'">`
                    : t.iniciales;
                
                trackHTML += `
                    <div class="testimonial-bubble">
                        <div class="testimonial-card">
                            <div class="testimonial-header">
                                <div class="testimonial-avatar">${avatarContent}</div>
                                <div class="testimonial-info">
                                    <div class="testimonial-name">${t.nombre}</div>
                                    <div class="testimonial-stars">${starsHTML}</div>
                                </div>
                            </div>
                            <p class="testimonial-comment">"${t.comentario}"</p>
                            <div class="testimonial-date">${t.fecha}</div>
                        </div>
                    </div>
                `;
                
                dotsHTML += `<div class="carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></div>`;
            });
            
            trackHTML += '</div>';
            carousel.innerHTML = trackHTML;
            dotsContainer.innerHTML = dotsHTML;
            
            // Eventos de dots
            dotsContainer.querySelectorAll('.carousel-dot').forEach(dot => {
                dot.addEventListener('click', () => {
                    goToTestimonial(parseInt(dot.dataset.index));
                });
            });
            
            // Auto-rotación cada 5 segundos
            if (testimonios.length > 1) {
                testimonialInterval = setInterval(() => {
                    currentTestimonial = (currentTestimonial + 1) % testimonios.length;
                    goToTestimonial(currentTestimonial);
                }, 5000);
            }
        })
        .catch(error => {
            console.error('❌ Error cargando testimonios:', error);
            carousel.innerHTML = '<div class="no-testimonials">Error al cargar opiniones</div>';
        });
}

function goToTestimonial(index) {
    currentTestimonial = index;
    const track = document.querySelector('.testimonials-track');
    const dots = document.querySelectorAll('.carousel-dot');
    
    if (track) {
        track.style.transform = `translateX(-${index * 100}%)`;
    }
    
    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
    });
}

// =====================================================
// INICIALIZACIÓN
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🛡️ Rafael Allende & Asociados - Linktree Premium cargado');
    
    // Auto-open modal if URL param exists
    const urlParams = new URLSearchParams(window.location.search);
    const modalToOpen = urlParams.get('modal');
    if (modalToOpen) {
        setTimeout(() => {
            openModal(modalToOpen);
        }, 500);
    }

    // Cargar configuración de formularios
    loadFormConfig();
    
    // Cargar rating dinámico
    loadDynamicRating();
    
    // Cargar testimonios
    loadTestimonials();

    window.addEventListener('scroll', syncScrollIndicators, { passive: true });
    window.addEventListener('resize', syncScrollIndicators);
    window.requestAnimationFrame(syncScrollIndicators);
    setTimeout(syncScrollIndicators, 250);
});
// =====================================================
//  SINIESTROS - NUEVO FLUJO DE 3 PASOS
// =====================================================

// =====================================================
//  SINIESTROS - NUEVO FLUJO CUSTOM FORMS (NO IFRAME)
// =====================================================

const BACKEND_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:') ? 'http://localhost:8000' : 'https://web-production-2584d.up.railway.app';
const WEBHOOK_VALIDACION_SINIESTRO = `${BACKEND_URL}/api/validate-siniestro`;
// const BACKEND_CREATE_SINIESTRO = "http://localhost:8000/api/create-siniestro"; // DEV
const BACKEND_CREATE_SINIESTRO = `${BACKEND_URL}/api/create-siniestro`; // PROD

// Configuración de Formularios (Cargada dinámicamente)
let FORM_CONFIG = {};
let formConfigRequest = null;

function hasFormConfig() {
    return !!FORM_CONFIG && Object.keys(FORM_CONFIG).length > 0;
}

function renderFormConfigLoader(message = 'Cargando opciones...') {
    const container = document.getElementById('siniestros-menu-dynamic');
    if (!container) return;

    container.innerHTML = `
        <div style="text-align:center; padding: 20px; width: 100%;">
            <div class="loading-spinner">
                <span>${message}</span>
            </div>
        </div>
    `;
}

function applyFormConfig(config, source) {
    if (!config || typeof config !== 'object' || Array.isArray(config) || Object.keys(config).length === 0) {
        console.warn(`⚠️ Configuración de formularios vacía (${source})`);
        return false;
    }

    FORM_CONFIG = config;
    console.log(`📝 Configuración de formularios cargada (${source}):`, config);
    renderDynamicMenu();
    return true;
}

function loadFormConfig({ force = false, silent = false } = {}) {
    const primaryUrl = `${BACKEND_URL}/api/config-formularios`;
    const fallbackUrl = 'FORM_CONFIG.json';

    if (!force && hasFormConfig()) {
        renderDynamicMenu();
        return Promise.resolve(FORM_CONFIG);
    }

    if (formConfigRequest) {
        return formConfigRequest;
    }

    if (!silent) {
        renderFormConfigLoader('Cargando tipos de denuncia...');
    }

    formConfigRequest = fetchWithTimeout(primaryUrl, { timeout: 15000 })
        .then(response => {
            if (!response.ok) throw new Error(`Backend Status: ${response.status}`);
            return response.json();
        })
        .then(config => {
            if (!applyFormConfig(config, 'Backend')) {
                throw new Error('Backend returned empty form config');
            }
            return FORM_CONFIG;
        })
        .catch(errorBackend => {
            console.warn('⚠️ Fallo carga de Backend, intentando local...', errorBackend);
            
            // INTENTO DE FALLBACK
            return fetch(fallbackUrl)
                .then(response => {
                    if (!response.ok) throw new Error(`Fallback Status: ${response.status}`);
                    return response.json();
                })
                .then(config => {
                    if (!applyFormConfig(config, 'Local Fallback')) {
                        throw new Error('Fallback form config is empty');
                    }
                    return FORM_CONFIG;
                });
        })
        .catch(errorLocal => {
            console.error('❌ Error total cargando configuración:', errorLocal);
            FORM_CONFIG = {};
            renderDynamicMenu();
            throw errorLocal;
        })
        .finally(() => {
            formConfigRequest = null;
        });

    return formConfigRequest;
}

// NUEVO: Renderizado dinámico del menú de siniestros
function renderDynamicMenu() {
    const container = document.getElementById('siniestros-menu-dynamic');
    if (!container) return;

    if (Object.keys(FORM_CONFIG).length === 0) {
        container.innerHTML = '<p style="text-align:center;">No hay tipos de denuncia disponibles.</p>';
        return;
    }

    container.innerHTML = ''; // Limpiar loader

    Object.keys(FORM_CONFIG).forEach(key => {
        const config = FORM_CONFIG[key];
        const iconValue = typeof config.icono === 'string' && config.icono.trim()
            ? config.icono.trim()
            : 'fa-file';
        
        // Detectar si es FontAwesome o Emoji/Texto
        const iconHtml = iconValue.includes('fa-')
            ? `<i class="fas ${iconValue}" style="font-size: 2rem; color: ${config.color || 'var(--primary)'};"></i>`
            : `<span style="font-size: 2rem;">${iconValue}</span>`;

        const btn = document.createElement('button');
        btn.className = 'option-card-btn animate-fade-in';
        btn.onclick = () => seleccionarTipoSiniestro(key);
        btn.innerHTML = `
            ${iconHtml}
            <span>${config.titulo}</span>
        `;
        
        container.appendChild(btn);
    });
}

async function validarClienteSiniestro() {
    console.log('🚀 Iniciando validación...');
    const patente = document.getElementById('val-patente-siniestro').value.trim().toUpperCase();
    const dni = document.getElementById('val-dni-siniestro').value.trim();
    const btn = document.getElementById('btn-validar-siniestro'); 
    
    // Contenedor de Error
    const errorContainer = document.getElementById('msg-val-error-siniestro');
    if (errorContainer) {
        errorContainer.style.display = 'none';
    }

    if (patente.length < 6 || dni.length < 7) {
        mostrarErrorValidacion('Por favor revisá los datos ingresados (DNI o Patente incompletos).');
        return;
    }

    if(btn) {
        btn.innerHTML = '<div class="modern-spinner" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:8px; border-width:2px;"></div> Verificando...';
        btn.disabled = true;
    }

    const url = `${WEBHOOK_VALIDACION_SINIESTRO}?patente=${patente}&dni=${dni}`;
    
    try {
        const res = await fetchWithTimeout(url);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || 'Error en validación');
        }

        if (!data.valid) {
            mostrarErrorValidacion(data.message || 'No logramos validar tu cobertura.');
            return;
        }

        // Guardar datos
        sessionStorage.setItem('validacion_siniestro', JSON.stringify({
            nombres: data.cliente.nombres,
            apellido: data.cliente.apellido,
            dni: dni,
            patente: patente,
            polizaRecordId: data.poliza.record_id,
            polizaNumero: data.poliza.numero,
            polizaInfo: data.poliza
        }));

        if (!hasFormConfig()) {
            renderFormConfigLoader('Cargando tipos de denuncia...');
        }

        try {
            await loadFormConfig({ force: !hasFormConfig(), silent: true });
        } catch (configError) {
            console.warn('⚠️ No se pudo refrescar la configuración de formularios tras validar:', configError);
        }

        if (!hasFormConfig()) {
            mostrarErrorValidacion('Validamos tu cobertura, pero no pudimos cargar los tipos de denuncia. Intentá nuevamente en unos segundos.');
            return;
        }

        mostrarSeleccionSiniestro(data);
    } catch (err) {
        console.error(err);
        mostrarErrorValidacion('No pudimos verificar tu cobertura. Por favor intentá nuevamente.');
    } finally {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Verificar Cobertura';
            btn.disabled = false;
        }
    }
}

function mostrarErrorValidacion(msg) {
    const errorContainer = document.getElementById('msg-val-error-siniestro');
    if (errorContainer) {
        errorContainer.style.display = 'block';
        errorContainer.innerHTML = `<strong><i class="fas fa-exclamation-circle"></i></strong> ${msg}`;
    } else {
        Swal.fire('Atención', msg, 'warning');
    }
}

function mostrarSeleccionSiniestro(data) {
    document.getElementById('step-validation-siniestro').classList.remove('active');
    document.getElementById('step-selection-siniestro').classList.add('active');
    renderDynamicMenu();
    
    // Renderizar tarjeta de bienvenida
    const poliza = data.poliza;

    // Limpiar estado para evitar duplicados visuales
    let estadoLimpio = poliza.estado.replace(/🆘|AUX|INFINITY|❤️|VIDA|✅|⏰/g, '').trim();
    if (!estadoLimpio) estadoLimpio = "CONSULTAR";

    // Badges de Cobertura (Vida / Auxilio)
    let coverageBadges = '';
    
    if (poliza.vida || poliza.estado.includes('VIDA')) {
        coverageBadges += `<span class="info-pill vida"><i class="fas fa-heart"></i> VIDA</span>`;
    }
    
    // Detectar Auxilio por flag o texto
    if (poliza.auxilio || poliza.estado.includes('AUX')) {
        coverageBadges += `<span class="info-pill aux"><i class="fas fa-tools"></i> AUXILIO</span>`;
    }

    document.getElementById('msg-bienvenida-siniestro').innerHTML = `
        <div class="welcome-card">
            <h3>👋 Hola, ${data.cliente.nombres}</h3>
            
            <div class="policy-details-grid">
                <!-- Columna 1: Vehículo -->
                <div class="policy-column">
                    <span class="info-pill"><i class="fas fa-car"></i> ${poliza.tipo_vehiculo}</span>
                    <span class="info-pill"><i class="fas fa-id-card"></i> ${poliza.patente}</span>
                </div>
                
                <!-- Columna 2: Póliza -->
                <div class="policy-column">
                    <span class="info-pill"><i class="fas fa-shield-alt"></i> Póliza: ${poliza.numero}</span>
                    <span class="info-pill ${estadoLimpio.includes('VIGENTE') || estadoLimpio.includes('VENCE') ? 'vigente' : ''}">
                        <i class="fas fa-clock"></i> ${estadoLimpio}
                    </span>
                </div>
                
                <!-- Columna 3: Coberturas Extra (Si existen) -->
                ${coverageBadges ? `
                <div class="policy-column">
                    ${coverageBadges}
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function seleccionarTipoSiniestro(tipo) {
    const config = FORM_CONFIG[tipo];
    if (!config) return;

    // 1. Ocultar pasos anteriores
    document.getElementById('step-selection-siniestro').classList.remove('active');
    const stepForm = document.getElementById('step-form-siniestro');
    stepForm.classList.add('active');

    // 2. Renderizar Formulario dinámico
    const validationData = JSON.parse(sessionStorage.getItem('validacion_siniestro') || '{}');
    const container = document.getElementById('iframe-wrapper-siniestro'); // Reusamos este ID por conveniencia
    
    container.innerHTML = `
        <div class="custom-form-container">
            <div class="form-header" style="border-left: 4px solid ${config.color}">
                <h2>
                    ${config.icono.match(/fa-/) 
                        ? `<i class="fas ${config.icono}"></i>` 
                        : `<span style="font-style: normal;">${config.icono}</span>`
                    } 
                    ${config.titulo}
                </h2>
                <p>Completá los detalles de lo sucedido</p>
            </div>
            
            <form id="dynamic-siniestro-form" class="animate-fade-in">
                <!-- Campos ocultos de contexto -->
                <input type="hidden" name="tipo_formulario" value="${tipo}">
                <input type="hidden" name="poliza_record_id" value="${validationData.polizaRecordId || ''}">
                <input type="hidden" name="patente" value="${validationData.patente || ''}">
                <input type="hidden" name="dni" value="${validationData.dni || ''}">

                ${config.campos.map(campo => renderCampo(campo)).join('')}

                <div class="form-actions">
                    <button type="submit" class="btn-submit" style="background: ${config.color}">
                        Enviar Denuncia <i class="fas fa-paper-plane"></i>
                    </button>
                    <button type="button" class="btn-secondary" onclick="volverSeleccionSiniestro()">
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    `;

    // 3. Bindear evento submit
    document.getElementById('dynamic-siniestro-form').addEventListener('submit', handleSiniestroSubmit);
}

function renderCampo(campo) {
    let inputHtml = '';
    
    switch(campo.type) {
        case 'file':
            inputHtml = `
                <input type="file" id="${campo.id}" name="${campo.id}" 
                    ${campo.required ? 'required' : ''} 
                    class="form-input" accept="image/*" multiple 
                    data-max-files="5">
                <small style="color: #ccc; display: block; margin-top: 5px;">
                    📷 Podés seleccionar hasta 5 fotos por campo
                </small>
            `;
            break;
        case 'select':
            const options = campo.options || [];
            inputHtml = `
                <select id="${campo.id}" name="${campo.id}" 
                    ${campo.required ? 'required' : ''} 
                    class="form-input">
                    <option value="">-- Seleccioná --</option>
                    ${options.map(opt => `<option value="${opt.trim()}">${opt.trim()}</option>`).join('')}
                </select>
            `;
            break;
        case 'textarea':
            inputHtml = `
                <textarea id="${campo.id}" name="${campo.id}" 
                    ${campo.required ? 'required' : ''} 
                    class="form-input" rows="4" 
                    placeholder="${campo.placeholder || 'Describí lo sucedido con el mayor detalle posible...'}"></textarea>
            `;
            break;
        default: // text, date, number, time...
            inputHtml = `
                <input type="${campo.type}" id="${campo.id}" name="${campo.id}" 
                    ${campo.required ? 'required' : ''} 
                    class="form-input" placeholder="${campo.placeholder || ''}">
            `;
    }

    return `
        <div class="form-group-dynamic">
            <label for="${campo.id}">${campo.label} ${campo.required ? '<span class="req">*</span>' : ''}</label>
            ${inputHtml}
        </div>
    `;
}

/**
 * Comprime una imagen usando Canvas antes de subirla.
 * Reduce drasticamente el tamaño de fotos de cámara de celular.
 * @param {File} file - Archivo original
 * @param {number} maxPx - Máximo ancho/alto en píxeles (default 1200)
 * @param {number} quality - Calidad JPEG 0-1 (default 0.75)
 * @returns {Promise<File>} Archivo comprimido
 */
async function compressImage(file, maxPx = 1200, quality = 0.75) {
    // Solo comprimir formatos raster comunes. SVG o PDF se pasan directo.
    const RASTER = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!RASTER.includes(file.type.toLowerCase())) {
        console.log(`📎 Saltando compresión para tipo: ${file.type}`);
        return file;
    }

    return new Promise((resolve) => {
        // Timeout de 5s para evitar que el canvas se cuelgue infinitamente
        const timer = setTimeout(() => {
            console.warn(`🕒 Timeout compresión (5s) para "${file.name}". Usando original.`);
            resolve(file);
        }, 5000);

        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
            clearTimeout(timer);
            let { width, height } = img;
            if (width > maxPx || height > maxPx) {
                if (width > height) {
                    height = Math.round((height * maxPx) / width);
                    width = maxPx;
                } else {
                    width = Math.round((width * maxPx) / height);
                    height = maxPx;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            URL.revokeObjectURL(url);
            
            canvas.toBlob(
                (blob) => {
                    const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    if (compressed.size > file.size) {
                        // Si la compresión resultó más pesada, usar original
                        resolve(file);
                    } else {
                        const reduction = Math.round((1 - compressed.size / file.size) * 100);
                        console.log(`🗜️ Comprimida "${file.name}": ${(file.size/1024/1024).toFixed(1)}MB → ${(compressed.size/1024).toFixed(0)}KB (-${reduction}%)`);
                        resolve(compressed);
                    }
                },
                'image/jpeg',
                quality
            );
        };

        img.onerror = () => {
            clearTimeout(timer);
            URL.revokeObjectURL(url);
            console.error(`❌ Error cargando imagen para compresión: ${file.name}`);
            resolve(file);
        };

        img.src = url;
    });
}

async function handleSiniestroSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    
    // UI Loading
    const originalBtnContent = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="modern-spinner" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:8px; border-width:2px;"></div> Enviando...';

    // Recolectar datos
    const formData = new FormData(form);
    
    // Preparar Payload Multipart
    const payload = new FormData();
    const datos = {};
    const standardFields = ['tipo_formulario', 'poliza_record_id', 'dni', 'patente'];
    const fileFields = []; // Detectaremos cuales son archivos

    // Iteramos entradas una sola vez
    // Iterar entradas: campos standard al payload, archivos se comprimen, resto a datos
    // Primero mostrar estado de compresión si hay archivos
    let tieneArchivos = false;
    for (const [key, value] of formData.entries()) {
        // Verificación robusta de archivo
        const isFile = value instanceof File || (value && typeof value === 'object' && value.name && value.type);
        if (isFile && value.size > 0) { 
            tieneArchivos = true; 
            console.log(`📎 Detectado archivo: ${key} - ${value.name} (${value.size} bytes)`);
            break; 
        }
    }
    if (tieneArchivos) {
        btn.innerHTML = '<i class="fas fa-compress-arrows-alt fa-spin"></i> Comprimiendo fotos...';
    }

    for (const [key, value] of formData.entries()) {
        // Verificación robusta de archivo
        const isFile = value instanceof File || (value && typeof value === 'object' && value.name && value.type);
        
        if (standardFields.includes(key)) {
            payload.append(key, value);
        } else if (isFile) {
            if (value.size > 0) {
                // Comprimir imagen antes de subir
                const compressed = await compressImage(value);
                console.log(`🗜️ ${key}: ${(value.size/1024/1024).toFixed(1)}MB → ${(compressed.size/1024).toFixed(0)}KB`);
                payload.append(key, compressed, compressed.name);
            }
            // Si el archivo tiene size 0 (no seleccionado), lo ignoramos
        } else {
            datos[key] = value;
        }
    }
    
    // Adjuntar JSON de datos
    payload.append('datos', JSON.stringify(datos));

    btn.innerHTML = '<i class="fas fa-cloud-upload-alt fa-spin"></i> Subiendo...';
    console.log("📨 Enviando payload Multipart via fetch...");

    // Usamos fetch con AbortController para el timeout (más compatible con CORS que XHR)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 300 segundos (5 minutos)

    try {
        const response = await fetch(BACKEND_CREATE_SINIESTRO, {
            method: 'POST',
            body: payload,
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        console.log("📬 Respuesta del servidor:", response.status, response.ok);
        const data = await response.json();
        console.log("📬 Data recibida:", data);

        if (!response.ok) {
            throw new Error(data.detail || `Error del servidor (${response.status})`);
        }

        console.log("✅ Siniestro creado:", data);

        // Cerrar el modal del formulario primero
        const modalSiniestro = document.getElementById('modal-siniestro');
        if (modalSiniestro) {
            modalSiniestro.classList.remove('active');
        }

        // Construir mensaje detallado según el resultado
        const hayFallidos = data.archivos_fallidos && data.archivos_fallidos.length > 0;
        const archivosSubidos = data.archivos_subidos || 0;

        let htmlMsg = `<p>✅ <b>Envío exitoso</b> — La información fue registrada correctamente.</p>`;
        htmlMsg += `<br><b>Número de gestión: <span style="font-size:1.2em;color:#4ade80">${data.id || 'Asignado'}</span></b>`;

        if (archivosSubidos > 0 && !hayFallidos) {
            htmlMsg += `<br><br>📎 <span style="color:#4ade80">Carga exitosa — ${archivosSubidos} archivo(s) subido(s) correctamente.</span>`;
        } else if (hayFallidos) {
            htmlMsg += `<br><br>⚠️ <span style="color:#fbbf24">Algunos archivos no se pudieron cargar: ${data.archivos_fallidos.join(', ')}.<br>El resto de la información fue enviada correctamente.</span>`;
        }
        htmlMsg += `<br><br><small style="color:#aaa">Un asesor te contactará a la brevedad.</small>`;

        // Mostrar mensaje de éxito
        console.log("🎄 Intentando mostrar Swal...");
        
        if (typeof Swal !== 'undefined') {
            const numeroGestion = data.id || 'Asignado';
            
            Swal.fire({
                icon: hayFallidos ? 'warning' : 'success',
                title: hayFallidos ? '¡Denuncia Recibida con Advertencias!' : '¡Denuncia Recibida!',
                html: htmlMsg,
                showDenyButton: true,
                confirmButtonColor: '#4ade80',
                denyButtonColor: '#3b82f6',
                confirmButtonText: 'Aceptar',
                denyButtonText: '<i class="fas fa-download"></i> Guardar Comprobante',
                allowOutsideClick: false
            }).then((result) => {
                if (result.isDenied) {
                    // Generar y descargar el comprobante en texto simple
                    const fecha = new Date().toLocaleString();
                    const textoComprobante = `
COMPROBANTE DE DENUNCIA DE SINIESTRO
Rafael Allende & Asociados

Fecha: ${fecha}
Número de Gestión: ${numeroGestion}
Estado: Recibido correctamente.
Archivos adjuntos: ${archivosSubidos}
                    
Un asesor te contactará a la brevedad.
Gracias por confiar en nosotros.
`.trim();

                    // Intentar usar Web Share API si está en celular
                    if (navigator.share) {
                        navigator.share({
                            title: 'Comprobante de Siniestro',
                            text: textoComprobante
                        }).then(() => {
                            location.reload();
                        }).catch((err) => {
                            console.log('Error compartiendo:', err);
                            descargarTxt(textoComprobante, numeroGestion);
                            location.reload();
                        });
                    } else {
                        // Fallback: Descargar TXT
                        descargarTxt(textoComprobante, numeroGestion);
                        location.reload();
                    }
                } else {
                    location.reload();
                }
            }).catch((err) => {
                console.error("🎄 Error en Swal:", err);
                alert('¡Denuncia enviada correctamente!\n\nUn asesor te contactará a la brevedad.\n\nNúmero de gestión: ' + numeroGestion);
                location.reload();
            });
        } else {
            console.log("🎄 Swal no disponible, usando alert");
            alert('¡Denuncia enviada correctamente!\n\nUn asesor te contactará a la brevedad.\n\nNúmero de gestión: ' + (data.id || 'Asignado'));
            location.reload();
        }

        // Función auxiliar para descargar archivo de texto
        function descargarTxt(texto, numeroGestion) {
            const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `comprobante_siniestro_${numeroGestion.replace(/[/\\?%*:|"<>]/g, '-')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }


    } catch (error) {
        clearTimeout(timeoutId);
        console.error("❌ Error envio siniestro:", error);
        const msg = error.name === 'AbortError'
            ? 'Tiempo agotado (5 min). Las fotos son muy grandes o la conexión es lenta. Intentá nuevamente.'
            : (error.message || 'Error de conexión. Intentá nuevamente.');
        Swal.fire({ icon: 'error', title: 'Error al enviar', text: msg });
        btn.disabled = false;
        btn.innerHTML = originalBtnContent;
    }
}


function volverValidacionSiniestro() {
    document.getElementById('step-selection-siniestro').classList.remove('active');
    document.getElementById('step-validation-siniestro').classList.add('active');
}

function volverSeleccionSiniestro() {
    document.getElementById('step-form-siniestro').classList.remove('active');
    document.getElementById('iframe-wrapper-siniestro').innerHTML = ''; // Limpiar form
    document.getElementById('step-selection-siniestro').classList.add('active');
}

// =============================================================================
// CARGA DINÁMICA DE FAQ Y QUIÉNES SOMOS DESDE AIRTABLE
// =============================================================================

const FAQ_ENDPOINT = `${BACKEND_URL}/api/faqs`;
const QUIENES_SOMOS_ENDPOINT = `${BACKEND_URL}/api/quienes-somos`;

// Variable para cachear los datos
let faqsCache = null;
let quienesSomosCache = null;

// Cargar FAQs dinámicamente
async function loadFAQs() {
    const container = document.getElementById('faq-dynamic-content');
    if (!container) return;
    
    // Si ya están cargados, no volver a cargar
    if (faqsCache && container.querySelector('.accordion-item')) {
        return;
    }
    
    try {
        const response = await fetchWithTimeout(FAQ_ENDPOINT, { timeout: 10000 });
        const data = await response.json();
        
        if (!data.faqs || data.faqs.length === 0) {
            container.innerHTML = '<p style="text-align:center;">No hay preguntas frecuentes disponibles.</p>';
            return;
        }
        
        faqsCache = data.faqs;
        
        // Renderizar FAQs con soporte para FontAwesome y emojis
        container.innerHTML = data.faqs.map(faq => {
            // Detectar si es FontAwesome o emoji
            const icono = faq.icono || 'fa-question-circle';
            const iconoHtml = icono.match(/^fa-/) 
                ? `<i class="fas ${icono}"></i>` 
                : `<span>${icono}</span>`;
            
            return `<div class="accordion-item">
                <button class="accordion-header">
                    ${iconoHtml} ${faq.pregunta}
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="accordion-content">
                    <p>${faq.respuesta}</p>
                </div>
            </div>`;
        }).join('');
        
        // Re-inicializar los event listeners del accordion
        initAccordion();
        
    } catch (error) {
        console.error('❌ Error cargando FAQs:', error);
        container.innerHTML = '<p style="text-align:center;">Error al cargar preguntas frecuentes.</p>';
    }
}

// Cargar Quiénes Somos dinámicamente
async function loadQuienesSomos() {
    const container = document.getElementById('nosotros-dynamic-content');
    if (!container) return;
    
    // Si ya está cargado, no volver a cargar
    if (quienesSomosCache && container.querySelector('.about-hero')) {
        return;
    }
    
    try {
        const response = await fetchWithTimeout(QUIENES_SOMOS_ENDPOINT, { timeout: 10000 });
        const data = await response.json();
        
        if (!data.visible) {
            container.innerHTML = '<p style="text-align:center;">Sección no disponible.</p>';
            return;
        }
        
        quienesSomosCache = data;
        
        // Construir HTML dinámico - DISEÑO PREMIUM
        const statsHTML = data.estadisticas.mostrar ? `
            <div class="qs-stats-grid">
                ${data.estadisticas.anos_experiencia > 0 ? `
                <div class="qs-stat-card">
                    <div class="qs-stat-icon"><i class="fas fa-calendar-alt"></i></div>
                    <div class="qs-stat-info">
                        <span class="qs-stat-number" data-target="${data.estadisticas.anos_experiencia}">0</span>
                        <span class="qs-stat-label">Años de Experiencia</span>
                    </div>
                </div>` : ''}
                ${data.estadisticas.cantidad_clientes > 0 ? `
                <div class="qs-stat-card">
                    <div class="qs-stat-icon"><i class="fas fa-users"></i></div>
                    <div class="qs-stat-info">
                        <span class="qs-stat-number" data-target="${data.estadisticas.cantidad_clientes}">0</span>
                        <span class="qs-stat-label">Clientes Felices</span>
                    </div>
                </div>` : ''}
                ${data.estadisticas.cantidad_sucursales > 0 ? `
                <div class="qs-stat-card">
                    <div class="qs-stat-icon"><i class="fas fa-building"></i></div>
                    <div class="qs-stat-info">
                        <span class="qs-stat-number" data-target="${data.estadisticas.cantidad_sucursales}">0</span>
                        <span class="qs-stat-label">Sucursales</span>
                    </div>
                </div>` : ''}
                ${data.estadisticas.cantidad_polizas > 0 ? `
                <div class="qs-stat-card">
                    <div class="qs-stat-icon"><i class="fas fa-file-contract"></i></div>
                    <div class="qs-stat-info">
                        <span class="qs-stat-number" data-target="${data.estadisticas.cantidad_polizas}">0</span>
                        <span class="qs-stat-label">Pólizas Activas</span>
                    </div>
                </div>` : ''}
            </div>
        ` : '';
        
        const valoresHTML = data.valores && data.valores.length > 0 ? `
            <div class="qs-values-section">
                <h4 class="qs-section-title"><i class="fas fa-heart"></i> Nuestros Valores</h4>
                <div class="qs-values-grid">
                    ${data.valores.map(v => `<span class="qs-value-tag"><i class="fas fa-check-circle"></i> ${v}</span>`).join('')}
                </div>
            </div>
        ` : '';
        
        const fotoSrc = data.responsable.foto || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop';
        
        // Video presentation
        const videoHTML = data.video_presentacion ? `
            <div class="qs-video-section">
                <div class="qs-video-container">
                    <iframe 
                        src="${data.video_presentacion.replace('watch?v=', 'embed/')}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            </div>
        ` : '';
        
        // Imagen de fondo - aplicar al modal-content si existe imagen
        const modalContent = document.querySelector('#modal-nosotros .modal-content');
        if (modalContent && data.imagen_fondo) {
            modalContent.style.backgroundImage = `linear-gradient(rgba(10, 22, 61, 0.92), rgba(10, 22, 61, 0.98)), url('${data.imagen_fondo}')`;
            modalContent.style.backgroundSize = 'cover';
            modalContent.style.backgroundPosition = 'center';
        }
        
        // Usar colores dinámicos o defaults
        const colorPrincipal = data.colores?.principal || '#1e40af';
        const colorSecundario = data.colores?.secundario || '#f59e0b';
        
        container.innerHTML = `
            <div class="qs-modal-wrapper" style="--color-primary: ${colorPrincipal}; --color-secondary: ${colorSecundario};">
                <!-- Header Premium -->
                <div class="qs-header" style="background: linear-gradient(135deg, ${colorPrincipal} 0%, ${colorPrincipal} 100%);">
                    <div class="qs-header-shine"></div>
                    <div class="qs-header-content">
                        <div class="qs-avatar-wrapper">
                            <img src="${fotoSrc}" alt="${data.responsable.nombre || 'Empresa'}" class="qs-avatar" />
                            <div class="qs-avatar-badge"><i class="fas fa-shield-alt"></i></div>
                        </div>
                        <div class="qs-header-text">
                            <h2 class="qs-title">${data.titulo}</h2>
                            ${data.subtitulo ? `<p class="qs-subtitle">${data.subtitulo}</p>` : ''}
                            ${data.responsable.nombre ? `<p class="qs-responsable"><i class="fas fa-user-tie"></i> ${data.responsable.nombre} <span class="qs-cargo">${data.responsable.cargo || ''}</span></p>` : ''}
                        </div>
                    </div>
                </div>
                
                <!-- Contenido Principal -->
                <div class="qs-body">
                    ${data.texto_principal ? `
                    <div class="qs-description">
                        <p>${data.texto_principal}</p>
                    </div>
                    ` : ''}
                    
                    <!-- Video -->
                    ${videoHTML}
                    
                    <!-- Misión y Visión -->
                    <div class="qs-mv-grid">
                        ${data.mision ? `
                        <div class="qs-mv-card qs-mision">
                            <div class="qs-mv-icon"><i class="fas fa-bullseye"></i></div>
                            <h4>Misión</h4>
                            <p>${data.mision}</p>
                        </div>` : ''}
                        ${data.vision ? `
                        <div class="qs-mv-card qs-vision">
                            <div class="qs-mv-icon"><i class="fas fa-eye"></i></div>
                            <h4>Visión</h4>
                            <p>${data.vision}</p>
                        </div>` : ''}
                    </div>
                    
                    <!-- Valores -->
                    ${valoresHTML}
                    
                    <!-- Estadísticas -->
                    ${statsHTML}
                </div>
                
                <!-- Footer -->
                <div class="qs-footer">
                    <p><i class="fas fa-map-marker-alt"></i> Rosario, Argentina</p>
                </div>
            </div>
        `;
        
        // Inicializar animación de estadísticas después de cargar
        setTimeout(() => {
            animateStats();
        }, 100);
        
    } catch (error) {
        console.error('❌ Error cargando Quiénes Somos:', error);
        container.innerHTML = '<p style="text-align:center;">Error al cargar la información.</p>';
    }
}

// Modificar openModal para cargar datos dinámicamente
const originalOpenModal = openModal;
openModal = function(modalId) {
    originalOpenModal(modalId);
    
    // Cargar FAQ cuando se abre el modal
    if (modalId === 'faq') {
        loadFAQs();
    }
    
    // Cargar Quiénes Somos cuando se abre el modal
    if (modalId === 'nosotros') {
        loadQuienesSomos();
    }
    
    // Cargar calendario para Asesoría
    if (modalId === 'asesoria') {
        loadAsesoriaDisponibilidad();
    }
};

// --------------------------------------------------------------------
// LÓGICA DE ASESORÍA ONLINE (CALENDARIO INLINE - ESTILO CALENDLY)
// --------------------------------------------------------------------
let asesoriaDisponibilidad = {};
let flatpickrInstance = null;
let asesoriaEsCliente = false;         // toggle actual
let asesoriaClienteVerificado = false; // true = credenciales válidas
let asesoriaClienteRecordId = '';      // record_id de Airtable
const DEFAULT_ASESORIA_PLATFORMS = [
    { label: 'Videollamada WhatsApp', value: 'WhatsApp' },
    { label: 'Zoom', value: 'Zoom' },
    { label: 'Google Meet', value: 'Meet' }
];
const DEFAULT_ASESORIA_MOTIVOS = [
    { label: 'Dudas sobre Póliza', value: 'Dudas sobre Póliza' },
    { label: 'Consulta de Siniestro', value: 'Consulta de Siniestro' },
    { label: 'Asesoramiento Comercial', value: 'Asesoramiento Comercial' },
    { label: 'Problemas de Ingreso', value: 'Problemas de Ingreso' },
    { label: 'Otros', value: 'Otros' }
];

function normalizeAsesoriaOptions(options, fallbackOptions) {
    const source = Array.isArray(options) && options.length > 0 ? options : fallbackOptions;
    return source
        .map((item) => {
            if (!item) return null;
            const label = String(item.label || item.etiqueta || item.name || '').trim();
            const value = String(item.value || item.valor || item.valor_interno || label).trim();
            if (!label || !value) return null;
            return { label, value };
        })
        .filter(Boolean);
}

function populateAsesoriaSelect(selectId, options, placeholderText) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const previousValue = select.value;
    const normalizedOptions = normalizeAsesoriaOptions(options, []);

    select.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholderText;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    select.appendChild(placeholderOption);

    normalizedOptions.forEach((optionData) => {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.textContent = optionData.label;
        select.appendChild(option);
    });

    if (previousValue && normalizedOptions.some((optionData) => optionData.value === previousValue)) {
        select.value = previousValue;
    } else {
        select.value = '';
    }
}

function applyAsesoriaFrontendConfig(data = {}) {
    const platforms = normalizeAsesoriaOptions(data.plataformas, DEFAULT_ASESORIA_PLATFORMS);
    const motivos = normalizeAsesoriaOptions(data.motivos, DEFAULT_ASESORIA_MOTIVOS);

    populateAsesoriaSelect('asesoria-plataforma', platforms, 'Elegí una opción');
    populateAsesoriaSelect('asesoria-motivo', motivos, 'Seleccioná el motivo...');
}

// --- Toggle cliente / no-cliente ---
window.setAsesoriaCliente = function(esCliente) {
    asesoriaEsCliente = esCliente;
    asesoriaClienteVerificado = false;
    asesoriaClienteRecordId = '';

    // Limpiar campos para evitar conflictos de autocompletado "agrupados"
    const dniInput = document.getElementById('asesoria-dni');
    const passInput = document.getElementById('asesoria-password');
    const badge = document.getElementById('asesoria-cliente-badge');
    const inputHiddenId = document.getElementById('asesoria-cliente-record-id');

    if (dniInput) dniInput.value = '';
    if (passInput) passInput.value = '';
    if (inputHiddenId) inputHiddenId.value = '';
    if (badge) badge.style.display = 'none';

    // Botones toggle UI
    const btnSi = document.getElementById('btn-toggle-cliente');
    const btnNo = document.getElementById('btn-toggle-no-cliente');
    if (btnSi && btnNo) {
        if (esCliente) {
            btnSi.style.background = '#1e3a8a';
            btnSi.style.color = '#fff';
            btnSi.style.borderColor = '#1e3a8a';
            btnNo.style.background = 'transparent';
            btnNo.style.color = '#555';
            btnNo.style.borderColor = '#cbd5e1';
        } else {
            btnNo.style.background = '#1e3a8a';
            btnNo.style.color = '#fff';
            btnNo.style.borderColor = '#1e3a8a';
            btnSi.style.background = 'transparent';
            btnSi.style.color = '#555';
            btnSi.style.borderColor = '#cbd5e1';
        }
    }

    // Mostrar/ocultar contenedores de campos
    const fieldsCliente = document.getElementById('asesoria-fields-cliente');
    const fieldsNoCliente = document.getElementById('asesoria-fields-no-cliente');
    if (fieldsCliente) fieldsCliente.style.display = esCliente ? 'block' : 'none';
    if (fieldsNoCliente) fieldsNoCliente.style.display = esCliente ? 'none' : 'block';

    const hiddenCliente = document.getElementById('asesoria-es-cliente');
    if (hiddenCliente) hiddenCliente.value = esCliente ? 'true' : 'false';
};

// --- Verificar cliente con DNI + contraseña ---
window.verificarClienteAsesoria = async function() {
    const dniVal = (document.getElementById('asesoria-dni') || {}).value?.trim();
    const passVal = (document.getElementById('asesoria-password') || {}).value?.trim();

    if (!dniVal || !passVal) {
        Swal.fire('Falta', 'Ingresá tu DNI y contraseña para verificar.', 'warning');
        return;
    }

    const btnVerificar = document.getElementById('btn-verificar-cliente');
    const originalText = btnVerificar ? btnVerificar.innerHTML : '';
    if (btnVerificar) {
        btnVerificar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
        btnVerificar.disabled = true;
    }

    try {
        const res = await fetch(`${BACKEND_URL}/api/chat/agendar/validar-cliente`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni: dniVal, password: passVal })
        });
        const data = await res.json();

        if (data.valid) {
            asesoriaClienteVerificado = true;
            asesoriaClienteRecordId = data.cliente_record_id || '';

            // Guardar en el input oculto para el envío
            const hiddenId = document.getElementById('asesoria-cliente-record-id');
            if (hiddenId) hiddenId.value = asesoriaClienteRecordId;

            const badge = document.getElementById('asesoria-cliente-badge');
            const nombreSpan = document.getElementById('asesoria-cliente-nombre');
            if (badge) badge.style.display = 'inline-flex';
            if (nombreSpan) nombreSpan.textContent = data.nombre || 'Cliente verificado';

            Swal.fire({ icon: 'success', title: '¡Verificado!', text: `Bienvenido/a ${data.nombre || ''}. Ya podés elegir tu turno.`, timer: 2500, showConfirmButton: false });
        } else {
            asesoriaClienteVerificado = false;
            Swal.fire('Error', data.message || 'Credenciales inválidas.', 'error');
        }
    } catch (err) {
        console.error('Error verificando cliente asesoria:', err);
        Swal.fire('Error de conexión', 'No se pudo conectar al servidor. Intentá de nuevo.', 'error');
    } finally {
        if (btnVerificar) {
            btnVerificar.innerHTML = originalText;
            btnVerificar.disabled = false;
        }
    }
};

// =====================================================
//  CALENDARIO TIPO CALENDLY - Variables globales
// =====================================================
let calViewYear  = new Date().getFullYear();
let calViewMonth = new Date().getMonth(); // 0-indexed
let calSelectedDateStr = '';  // 'YYYY-MM-DD'

// Mapa día-de-semana (JS) → nombre en Airtable
const CAL_JS_DAY_TO_AIRTABLE = {
    1: 'LUNES', 2: 'MARTES', 3: 'MIERCOLES', 4: 'JUEVES',
    5: 'VIERNES', 6: 'SABADO', 0: 'DOMINGO'
};

function loadAsesoriaDisponibilidad() {
    const loader = document.getElementById('asesoria-loader');
    if (loader) loader.style.display = 'block';

    fetchWithTimeout(`${BACKEND_URL}/api/chat/agendar/disponibilidad`, { timeout: 15000 })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'success') {
                asesoriaDisponibilidad = data.disponibilidad || {};
                applyAsesoriaFrontendConfig(data);
            } else {
                console.warn('Disponibilidad sin éxito:', data);
                asesoriaDisponibilidad = {};
                applyAsesoriaFrontendConfig();
            }
        })
        .catch(err => {
            console.error("Error al obtener disponibilidad:", err);
            asesoriaDisponibilidad = {};
            applyAsesoriaFrontendConfig();
        })
        .finally(() => {
            if (loader) loader.style.display = 'none';
            // Inicializar el calendario tipo Calendly
            calViewYear  = new Date().getFullYear();
            calViewMonth = new Date().getMonth();
            calSelectedDateStr = '';
            renderCalendlyGrid();
        });
}

// Genera un string YYYY-MM-DD local (sin desfase por UTC)
function calToDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Nombre del día en Airtable para la fecha dada
function calDayName(date) {
    const jsDay = date.getDay();  // 0=D, 1=L, ..., 6=S
    return CAL_JS_DAY_TO_AIRTABLE[jsDay] || '';
}

// ¿La fecha está en asesoriaDisponibilidad con al menos 1 slot libre?
function calDateHasSlots(dateStr) {
    if (!asesoriaDisponibilidad) return false;
    const slots = asesoriaDisponibilidad[dateStr];
    return Array.isArray(slots) && slots.length > 0;
}

// ¿La fecha corresponde a un día activo según la configuración?
function calDateIsWorkday(date) {
    const dayName = calDayName(date);
    // Con disponibilidad cargada: fiamos en el objeto
    if (asesoriaDisponibilidad && Object.keys(asesoriaDisponibilidad).length > 0) {
        return true; // el backend ya filtra días activos
    }
    return true;
}

// Renderiza el mes actual en el grid
function renderCalendlyGrid() {
    const grid    = document.getElementById('cal-grid');
    const label   = document.getElementById('cal-mes-label');
    if (!grid || !label) return;

    const today     = new Date();
    today.setHours(0,0,0,0);
    const firstDay  = new Date(calViewYear, calViewMonth, 1);
    const lastDay   = new Date(calViewYear, calViewMonth + 1, 0);

    // JS: 0=Dom, 1=Lun ... convertir a Lun=0 para la grilla
    let startDow = firstDay.getDay(); // 0=Dom
    let offsetLunes = (startDow === 0) ? 6 : startDow - 1; // Lun=0, Dom=6

    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    label.textContent = `${MESES[calViewMonth]} ${calViewYear}`;

    grid.innerHTML = '';

    // Celdas vacías antes del primer día
    for (let i = 0; i < offsetLunes; i++) {
        const empty = document.createElement('div');
        grid.appendChild(empty);
    }

    // Días del mes
    for (let d = 1; d <= lastDay.getDate(); d++) {
        const date    = new Date(calViewYear, calViewMonth, d);
        const dateStr = calToDateStr(date);
        const isPast  = date < today;
        const hasSlots = calDateHasSlots(dateStr);
        const isSelected = dateStr === calSelectedDateStr;
        const isToday = dateStr === calToDateStr(today);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = d;
        btn.dataset.date = dateStr;

        // Estilos
        let bg = 'transparent', color = '#374151', border = 'none', cursor = 'default', fontWeight = '400';
        let opacity = '1';

        if (isPast) {
            color = '#d1d5db'; opacity = '0.5';
        } else if (hasSlots) {
            bg = isSelected ? '#1e3a8a' : '#e8eeff';
            color = isSelected ? '#fff' : '#1e3a8a';
            border = `1.5px solid ${isSelected ? '#1e3a8a' : '#a5b4fc'}`;
            cursor = 'pointer';
            fontWeight = '700';
        } else {
            color = '#9ca3af'; border = '1px solid #f3f4f6';
        }

        if (isToday && !isSelected) {
            border = '2px solid #1e3a8a';
        }

        btn.style.cssText = `
            width: 100%; aspect-ratio: 1; border-radius: 6px;
            background: ${bg}; color: ${color}; border: ${border};
            cursor: ${cursor}; font-size: 0.72rem; font-weight: ${fontWeight};
            opacity: ${opacity}; line-height: 1; padding: 0;
            transition: all 0.15s;
        `;

        if (!isPast && hasSlots) {
            btn.onclick = () => calSelectDate(dateStr, d);
            btn.onmouseenter = () => {
                if (dateStr !== calSelectedDateStr) {
                    btn.style.background = '#c7d2fe';
                }
            };
            btn.onmouseleave = () => {
                if (dateStr !== calSelectedDateStr) {
                    btn.style.background = '#e8eeff';
                }
            };
        }

        grid.appendChild(btn);
    }
}

// Selecciona una fecha y muestra sus slots
function calSelectDate(dateStr, dayNum) {
    calSelectedDateStr = dateStr;
    renderCalendlyGrid(); // Re-renderizar para marcar selección

    // Actualizar campo oculto de fecha
    const hiddenFecha = document.getElementById('asesoria-fecha');
    if (hiddenFecha) hiddenFecha.value = dateStr;

    // Resetear hora seleccionada
    const hiddenHora = document.getElementById('asesoria-hora-seleccionada');
    if (hiddenHora) hiddenHora.value = '';

    renderCalSlots(dateStr);
}

// Navegar mes anterior / siguiente
window.calNavegarMes = function(delta) {
    calViewMonth += delta;
    if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
    if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }
    // No permitir ir al pasado
    const now = new Date();
    if (calViewYear < now.getFullYear() ||
        (calViewYear === now.getFullYear() && calViewMonth < now.getMonth())) {
        calViewMonth -= delta;
        if (calViewMonth < 0)  { calViewMonth = 11; calViewYear--; }
        if (calViewMonth > 11) { calViewMonth = 0;  calViewYear++; }
        return;
    }
    renderCalendlyGrid();
};

// Renderiza los slots del lado derecho
function renderCalSlots(dateStr) {
    const header  = document.getElementById('cal-slots-header');
    const grid    = document.getElementById('cal-slots-grid');
    if (!header || !grid) return;

    // Formato fecha legible
    const [y, m, d] = dateStr.split('-');
    const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const MESES_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const dateObj = new Date(Number(y), Number(m)-1, Number(d));
    header.textContent = `${DIAS[dateObj.getDay()]} ${d} de ${MESES_SHORT[Number(m)-1]}`;

    const horasLibres = asesoriaDisponibilidad[dateStr] || [];

    if (horasLibres.length === 0) {
        grid.innerHTML = `<div style="color:#ef4444;font-size:0.85rem;grid-column:1/-1;padding:16px 0;text-align:center;">
            <i class="fas fa-calendar-times" style="display:block;font-size:1.5rem;margin-bottom:8px;"></i>
            No hay horarios disponibles para este día
        </div>`;
        return;
    }

    grid.innerHTML = horasLibres.map(hora => `
        <button type="button"
            onclick="calSelectHora('${hora}', this)"
            style="padding: 9px 4px; border: 1.5px solid #a5b4fc; border-radius: 8px;
                   background: #f0f4ff; cursor: pointer; font-size: 0.82rem; font-weight: 600;
                   color: #1e3a8a; transition: all 0.15s; text-align: center;">
            ${hora}
        </button>
    `).join('');
}

window.calSelectHora = function(hora, btnEl) {
    const hiddenHora = document.getElementById('asesoria-hora-seleccionada');

    // Resetear estilos de todos los slots
    document.querySelectorAll('#cal-slots-grid button').forEach(btn => {
        btn.style.background = '#f0f4ff';
        btn.style.color = '#1e3a8a';
        btn.style.borderColor = '#a5b4fc';
    });

    // Marcar el seleccionado
    btnEl.style.background = '#1e3a8a';
    btnEl.style.color = '#ffffff';
    btnEl.style.borderColor = '#1e3a8a';

    if (hiddenHora) hiddenHora.value = hora;
};

// Mantener compatibilidad con código heredado
window.selectAsesoriaHora = window.calSelectHora;

function renderHorasPanel(dateStr) {
    renderCalSlots(dateStr);
}




function resetAsesoriaModal() {
    if (flatpickrInstance) flatpickrInstance.clear();

    asesoriaEsCliente = false;
    asesoriaClienteVerificado = false;
    asesoriaClienteRecordId = '';

    // Reset toggle UI a "No cliente" por defecto
    setAsesoriaCliente(false);

    const hiddenFecha = document.getElementById('asesoria-fecha');
    if (hiddenFecha) hiddenFecha.value = '';
    const hiddenHora = document.getElementById('asesoria-hora-seleccionada');
    if (hiddenHora) hiddenHora.value = '';
    const infoBox = document.getElementById('asesoria-horas-info');
    if (infoBox) infoBox.style.display = 'flex';
    const grid = document.getElementById('asesoria-horas-grid');
    if (grid) { grid.style.display = 'none'; grid.innerHTML = ''; }
    const badge = document.getElementById('asesoria-cliente-badge');
    if (badge) badge.style.display = 'none';
    const form = document.getElementById('form-asesoria');
    if (form) form.reset();

    // Limpieza manual adicional para campos específicos si es necesario
    const hiddenRecordId = document.getElementById('asesoria-cliente-record-id');
    if (hiddenRecordId) hiddenRecordId.value = '';
    
    // El form.reset() ya debería limpiar inputs y textareas, pero aseguramos variables globales
    asesoriaClienteRecordId = '';
}

// --- Submit del formulario ---
document.addEventListener('DOMContentLoaded', () => {
    applyAsesoriaFrontendConfig();

    // Inicializar en modo "No cliente" al cargar
    setAsesoriaCliente(false);

    const formAsesoria = document.getElementById('form-asesoria');
    if (formAsesoria) {
        formAsesoria.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 1. Obtener valores básicos
            const fechaVal = (document.getElementById('asesoria-fecha') || {}).value;
            const horaVal = (document.getElementById('asesoria-hora-seleccionada') || {}).value;
            const motivoVal = (document.getElementById('asesoria-motivo') || {}).value?.trim();
            const plataformaVal = (document.getElementById('asesoria-plataforma') || {}).value;

            // 2. Validaciones rápidas antes de bloquear el botón
            if (!fechaVal || !horaVal) {
                Swal.fire('Seleccioná fecha y hora', 'Por favor elegí un día en el calendario y un horario disponible.', 'warning');
                return;
            }
            if (!motivoVal || !plataformaVal) {
                Swal.fire('Faltan campos', 'Por favor selecciona el motivo y la plataforma de la asesoría.', 'warning');
                return;
            }

            // 3. Feedback visual inmediato
            const btnSubmit = formAsesoria.querySelector('button[type="submit"]');
            const originalText = btnSubmit ? btnSubmit.innerHTML : 'Confirmar Reserva';
            
            if (btnSubmit) {
                btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> PROCESANDO...';
                btnSubmit.disabled = true;
            }

            try {
                const notasVal = (document.getElementById('asesoria-notas') || {}).value?.trim();
                const plataformaNormalizada = plataformaVal === 'Google Meet' ? 'Meet' : plataformaVal;

                let requestData = {
                    fecha: fechaVal,
                    hora_inicio: horaVal,
                    motivo: motivoVal,
                    plataforma: plataformaNormalizada,
                    notas: notasVal || "",
                    es_cliente: asesoriaEsCliente,
                    no_es_cliente: !asesoriaEsCliente
                };

                if (asesoriaEsCliente) {
                    if (!asesoriaClienteVerificado) {
                        Swal.fire('Verificación pendiente', 'Por favor verificá tu DNI y contraseña antes de confirmar.', 'warning');
                        if (btnSubmit) { btnSubmit.innerHTML = originalText; btnSubmit.disabled = false; }
                        return;
                    }
                    const clienteRecordIdVal = (document.getElementById('asesoria-cliente-record-id') || {}).value?.trim() || asesoriaClienteRecordId;
                    if (!clienteRecordIdVal) {
                        Swal.fire('Sesión expirada', 'No pudimos recuperar tu ID de cliente. Por favor verificá de nuevo.', 'error');
                        if (btnSubmit) { btnSubmit.innerHTML = originalText; btnSubmit.disabled = false; }
                        return;
                    }
                    requestData.cliente_record_id = clienteRecordIdVal;
                    // IMPORTANTE: NO enviamos el DNI aquí porque el backend intentaría escribirlo 
                    // en un campo calculado de Airtable, causando el error 422.
                    // El backend ya tiene el RecordID para vincular al cliente.
                } else {
                    const nombreVal = (document.getElementById('asesoria-nombre') || {}).value?.trim();
                    const emailVal = (document.getElementById('asesoria-email') || {}).value?.trim();
                    const dniNewVal = (document.getElementById('asesoria-dni-no-cliente') || {}).value?.trim();
                    const telVal = (document.getElementById('asesoria-telefono') || {}).value?.trim();
                    const paisVal = (document.getElementById('asesoria-pais') || {}).value || '+54';

                    if (!nombreVal || !emailVal || !dniNewVal || !telVal) {
                        Swal.fire('Campos obligatorios', 'Para nuevos clientes, necesitamos nombre, email, DNI y teléfono.', 'warning');
                        if (btnSubmit) { btnSubmit.innerHTML = originalText; btnSubmit.disabled = false; }
                        return;
                    }
                    requestData.nombre_no_cliente = nombreVal;
                    requestData.email_no_cliente = emailVal;
                    requestData.dni_no_cliente = dniNewVal;
                    requestData.telefono_no_cliente = `${paisVal} ${telVal}`;
                }

                // Mostrar Loading indicator de Swal
                Swal.showLoading();
                const response = await fetch(`${BACKEND_URL}/api/chat/agendar`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestData)
                });
                const responseData = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(responseData.detail || 'Error en el servidor (' + response.status + ')');
                }

                const receiptData = buildAsesoriaReceiptData({
                    reserva: responseData.reserva,
                    fecha: fechaVal,
                    horaInicio: horaVal,
                    motivo: motivoVal,
                    plataforma: plataformaVal,
                    notas: notasVal,
                    esCliente: asesoriaEsCliente,
                    nombreFallback: asesoriaEsCliente
                        ? (document.getElementById('asesoria-cliente-nombre') || {}).textContent?.trim()
                        : requestData.nombre_no_cliente,
                    emailFallback: asesoriaEsCliente ? '' : requestData.email_no_cliente,
                    telefonoFallback: asesoriaEsCliente ? '' : requestData.telefono_no_cliente
                });

                closeModal('asesoria');
                resetAsesoriaModal();

                const swalResult = await Swal.fire({
                    icon: 'success',
                    title: 'Solicitud registrada',
                    html: `
                        <div style="font-size: 0.96rem; line-height: 1.42; color: #475569;">
                            Registramos tu solicitud para el <strong>${escapeHtml(receiptData.fechaLegible || fechaVal)}</strong> a las <strong>${escapeHtml(receiptData.horaInicio || horaVal)}</strong>.
                            <br>El equipo se comunicará con vos para confirmarla.
                        </div>
                        <div style="margin-top: 14px; padding: 13px 15px; border-radius: 16px; text-align: left; background: linear-gradient(135deg, rgba(0,210,255,0.10), rgba(58,123,213,0.12)); border: 1px dashed rgba(58,123,213,0.35);">
                            <div style="font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: #1d4ed8; font-weight: 800;">Comprobante</div>
                            <div style="margin-top: 8px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; color: #334155; font-size: 0.9rem; line-height: 1.28;">
                                <div><strong>Solicitante:</strong><br>${escapeHtml(receiptData.nombre)}</div>
                                <div><strong>Plataforma:</strong><br>${escapeHtml(receiptData.plataforma)}</div>
                                <div><strong>Motivo:</strong><br>${escapeHtml(receiptData.motivo)}</div>
                                <div><strong>Estado:</strong><br>Pendiente de confirmación</div>
                                <div style="grid-column: 1 / -1;"><strong>Código:</strong> ${escapeHtml(receiptData.codigo)}</div>
                            </div>
                        </div>
                    `,
                    showDenyButton: true,
                    denyButtonText: '<i class="fas fa-download"></i> Descargar PDF',
                    confirmButtonText: 'Cerrar',
                    buttonsStyling: false,
                    customClass: {
                        popup: 'swal-asesoria-popup',
                        title: 'swal-asesoria-title',
                        htmlContainer: 'swal-asesoria-html',
                        actions: 'swal-asesoria-actions',
                        confirmButton: 'swal-asesoria-close',
                        denyButton: 'swal-asesoria-download'
                    }
                });

                if (swalResult.isDenied) {
                    try {
                        downloadAsesoriaReceipt(receiptData);
                        Swal.fire({
                            icon: 'success',
                            title: 'PDF descargado',
                            text: 'Guardamos un comprobante PDF de tu reserva para que lo tengas a mano.',
                            timer: 2200,
                            showConfirmButton: false
                        });
                    } catch (downloadError) {
                        console.error('Error generando PDF de asesoria:', downloadError);
                        Swal.fire('No pudimos descargar el PDF', downloadError.message || 'Intentá nuevamente.', 'error');
                    }
                }

            } catch (error) {
                console.error("Error al enviar reserva:", error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error al reservar',
                    text: error.message || 'Hubo un problema al procesar la reserva. Intentá de nuevo.',
                    confirmButtonColor: '#ef4444'
                });
            } finally {
                if (btnSubmit) {
                    btnSubmit.innerHTML = originalText;
                    btnSubmit.disabled = false;
                }
            }
        });
    }
});





// Función para inicializar accordion después de cargar FAQs dinámicamente



// Función para inicializar accordion después de cargar FAQs dinámicamente
function initAccordion() {
    document.querySelectorAll('.accordion-header').forEach(button => {
        button.addEventListener('click', () => {
            const item = button.parentElement;
            const isActive = item.classList.contains('active');
            
            // Cerrar todos
            document.querySelectorAll('.accordion-item').forEach(i => {
                i.classList.remove('active');
            });
            
            // Abrir el seleccionado si no estaba activo
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
}

// Función global para abrir el chat de seguros (Redirigido a YCloud si fuera necesario)
window.openInsuranceChat = function() {
    // YCloud maneja su propia burbuja, por lo que esta función puede quedar vacía o disparar un log
    console.log('Chat de seguros solicitado (YCloud activo)');
};
