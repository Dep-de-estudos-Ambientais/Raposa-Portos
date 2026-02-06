
const URLS = {
  portos: './assets/Portos.geojson',
  raposa: './assets/Raposa.geojson'
};

// ======================
// 0) LIGHTBOX (AMPLIAR)
// ======================
const lb = document.getElementById('lightbox');
const lbBody = document.getElementById('lightbox-body');

function openLightbox(html) {
  if (!lb || !lbBody) return;
  lbBody.innerHTML = html;
  lb.classList.remove('hidden');
  lb.setAttribute('aria-hidden', 'false');
}

function closeLightbox() {
  if (!lb || !lbBody) return;
  lb.classList.add('hidden');
  lb.setAttribute('aria-hidden', 'true');
  lbBody.innerHTML = '';
}

document.addEventListener('click', (e) => {
  const t = e.target;
  if (t && t.getAttribute && t.getAttribute('data-close') === '1') closeLightbox();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && lb && !lb.classList.contains('hidden')) closeLightbox();
});

// ======================
// 1) FILTRO DE COLUNAS
// ======================
const HIDE_KEYS = new Set([
  'ele',
  'porto da raposa',
  'cod',
  'endereço/bairro'
]);

function shouldHideKey(key) {
  return HIDE_KEYS.has(String(key ?? '').trim().toLowerCase());
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function propsToTable(props) {
  const entries = Object.entries(props || {}).filter(([k]) => !shouldHideKey(k));
  if (!entries.length) return '<div class="hint">Sem atributos para exibir.</div>';

  return `
    <table class="attr-table">
      ${entries.map(([k, v]) => `
        <tr>
          <td class="key">${esc(k)}</td>
          <td>${esc(v)}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

// ======================
// 2) MAPA + BASEMAPS
// ======================
const map = L.map('map', { zoomControl: true }).setView([-2.425, -44.10], 12);

// OpenStreetMap
const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// Satélite (ESRI)
const esriSat = L.tileLayer(
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
);

L.control.layers(
  { 'Mapa (OSM)': osm, 'Satélite (Esri)': esriSat },
  {},
  { collapsed: false }
).addTo(map);

// ======================
// 3) LEGENDA + AJUDA
// ======================
const legend = L.control({ position: 'bottomright' });
legend.onAdd = function () {
  const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar');
  div.style.background = 'rgba(255,255,255,.95)';
  div.style.padding = '10px 12px';
  div.style.borderRadius = '12px';
  div.style.border = '1px solid #e6e6e6';
  div.style.boxShadow = '0 2px 10px rgba(0,0,0,.08)';

  div.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div style="font-weight:700;">Legenda</div>
      <div class="help">
        <span class="help-btn">?</span>
        <div class="help-balloon">
          <div style="font-weight:700;margin-bottom:6px;">Como usar</div>
          <div>• Use o zoom e arraste o mapa.</div>
          <div>• Clique em um porto para ver atributos e fotos.</div>
          <div>• Clique na foto/vídeo para ampliar.</div>
        </div>
      </div>
    </div>

    <div style="display:flex; gap:8px; align-items:center; font-size:13px; margin-top:8px;">
      <span style="width:18px;height:10px;border:2px solid #444;border-radius:3px;display:inline-block;background:rgba(68,68,68,.06)"></span>
      <span>Limite territorial — Raposa</span>
    </div>

    <div style="display:flex; gap:8px; align-items:center; font-size:13px; margin-top:6px;">
      <span style="font-size:18px;">⛵</span>
      <span>Portos</span>
    </div>
  `;

  return div;
};
legend.addTo(map);

// ======================
// 4) LOGO 1 NO MAPA
// ======================
const logoControl = L.control({ position: 'bottomleft' });
logoControl.onAdd = function () {
  const div = L.DomUtil.create('div', 'map-logo-btn');
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  

  div.innerHTML = `
    <button class="logo-btn" type="button" title="IMESC">
      <img src="./logos/logo1.png" alt="Logo 1" />
    </button>
  `;
div.querySelector('button').addEventListener('click', () => {
  window.open('https://imesc.ma.gov.br/estudos-ambientais/', '_blank');
});

  // Se quiser abrir um link ao clicar:
  // div.querySelector('button').addEventListener('click', () => window.open('https://...', '_blank'));

  return div;
};
logoControl.addTo(map);

// ======================
// 5) ÍCONE BARQUINHO
// ======================
const boatIcon = L.divIcon({
  className: 'boat-icon',
  html: `<span style="font-size:22px; line-height:22px;">⛵</span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
  tooltipAnchor: [0, -14]
});

const styleBoatShadow = true;

// ======================
// 6) CORREÇÃO COORDS
// ======================
function firstPointCoord(geo) {
  const f = geo?.features?.find(ft => ft?.geometry?.type === 'Point' && Array.isArray(ft.geometry.coordinates));
  return f?.geometry?.coordinates ?? null;
}

function looksLikeLonLat(x, y) { return Math.abs(x) <= 180 && Math.abs(y) <= 90; }
function looksLikeUTM(x, y) { return Math.abs(x) > 1000 && Math.abs(y) > 1000; }

function utm23SToLonLat(e, n) {
  const src = '+proj=utm +zone=23 +south +datum=SIRGAS2000 +units=m +no_defs';
  const dst = '+proj=longlat +datum=WGS84 +no_defs';
  return proj4(src, dst, [e, n]);
}

function normalizeAndFixPortos(raw) {
  const test = firstPointCoord(raw);
  if (!test) return { geo: raw, mode: 'no-point-found' };

  const x = test[0], y = test[1];
  console.log('📌 primeira coordenada (bruta) =', test);

  if (looksLikeLonLat(x, y)) {
    const geo = structuredClone(raw);
    geo.features.forEach(ft => {
      if (ft?.geometry?.type === 'Point') {
        const c = ft.geometry.coordinates;
        ft.geometry.coordinates = [c[0], c[1]];
      }
    });
    return { geo, mode: 'lonlat-ok' };
  }

  if (looksLikeLonLat(y, x)) {
    const geo = structuredClone(raw);
    geo.features.forEach(ft => {
      if (ft?.geometry?.type === 'Point') {
        const c = ft.geometry.coordinates;
        ft.geometry.coordinates = [c[1], c[0]];
      }
    });
    return { geo, mode: 'swapped-latlon->lonlat' };
  }

  if (looksLikeUTM(x, y)) {
    const geo = structuredClone(raw);
    geo.features.forEach(ft => {
      if (ft?.geometry?.type === 'Point') {
        const c = ft.geometry.coordinates;
        const [lon, lat] = utm23SToLonLat(c[0], c[1]);
        ft.geometry.coordinates = [lon, lat];
      }
    });
    return { geo, mode: 'utm23s->wgs84' };
  }

  const geo = structuredClone(raw);
  geo.features.forEach(ft => {
    if (ft?.geometry?.type === 'Point') {
      const c = ft.geometry.coordinates;
      ft.geometry.coordinates = [c[0], c[1]];
    }
  });
  return { geo, mode: 'fallback-cut-z-only' };
}

// ======================
// 7) GALERIA MÍDIA
// ======================
const IMG_EXTS = ['JPG','jpg','JPEG','jpeg','PNG','png','WEBP','webp'];
const VID_EXTS = ['MP4','mp4','WEBM','webm'];

function buildMediaUrl(dir, filename) {
  return `fotos/${encodeURIComponent(dir)}/${encodeURIComponent(filename)}`;
}

function imageExists(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function videoExists(url) {
  return new Promise(resolve => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(true);
    v.onerror = () => resolve(false);
    v.src = url;
  });
}

async function findMediaForDir(dir, maxPhotos = 30, maxVideos = 10) {
  const photos = [];
  const videos = [];

  for (let i = 1; i <= maxPhotos; i++) {
    for (const ext of IMG_EXTS) {
      const filename = `Foto (${i}).${ext}`;
      const url = buildMediaUrl(dir, filename);
      // eslint-disable-next-line no-await-in-loop
      if (await imageExists(url)) { photos.push(url); break; }
    }
  }

  for (let i = 1; i <= maxVideos; i++) {
    for (const ext of VID_EXTS) {
      const filename = `Video (${i}).${ext}`;
      const url = buildMediaUrl(dir, filename);
      // eslint-disable-next-line no-await-in-loop
      if (await videoExists(url)) { videos.push(url); break; }
    }
  }

  return { photos, videos };
}

function galleryHtml({ photos, videos }) {
  const parts = [];

  if (photos.length) {
    const main = photos[0];
    parts.push(`
      <div class="gallery">
        <img class="main" src="${main}" alt="foto principal" title="Clique para ampliar" />
        <div class="thumbs">
          ${photos.map(u => `<img src="${u}" data-full="${u}" alt="miniatura" />`).join('')}
        </div>
        <div class="muted" style="margin-top:6px;font-size:12px;">
          Clique nas miniaturas para trocar. Clique na foto para ampliar.
        </div>
      </div>
    `);
  } else {
    parts.push(`<div class="hint" style="margin-top:10px;">Sem fotos encontradas.</div>`);
  }

  if (videos.length) {
    parts.push(`
      <div style="margin-top:10px;">
        <div style="font-weight:700; margin-bottom:6px;">Vídeos</div>
        ${videos.map(u => `
          <video controls style="width:100%; border-radius:12px; border:1px solid #eee; background:#000;" title="Clique para ampliar">
            <source src="${u}" />
            Seu navegador não suporta vídeo.
          </video>
        `).join('')}
        <div class="muted" style="margin-top:6px;font-size:12px;">
          Dica: clique no vídeo para abrir em tamanho maior.
        </div>
      </div>
    `);
  }

  return parts.join('');
}

function wireGalleryInteractions(popupEl) {
  const mainImg = popupEl.querySelector('.gallery .main');

  // miniaturas
  popupEl.querySelectorAll('.thumbs img').forEach(t => {
    t.addEventListener('click', () => {
      if (mainImg) mainImg.src = t.dataset.full;
    });
  });

  // ampliar imagem principal
  if (mainImg) {
    mainImg.style.cursor = 'zoom-in';
    mainImg.addEventListener('click', () => {
      openLightbox(`<img src="${mainImg.src}" alt="Foto ampliada">`);
    });
  }

  // ampliar vídeos (ao clicar)
  popupEl.querySelectorAll('video').forEach(v => {
    v.style.cursor = 'zoom-in';
    v.addEventListener('click', () => {
      const src = v.querySelector('source')?.src || v.currentSrc;
      openLightbox(`
        <video controls autoplay style="width:100%;height:100%;background:#000;border-radius:12px;">
          <source src="${src}">
        </video>
      `);
    });
  });
}

// ======================
// 8) CARREGAR RAPOSA
// ======================
fetch(URLS.raposa)
  .then(r => r.ok ? r.json() : null)
  .then(geo => {
    if (!geo) return;

    const layer = L.geoJSON(geo, {
      style: { color: '#444', weight: 2, fillOpacity: 0.05 }
    }).addTo(map);

    // sempre centraliza no município
    try { map.fitBounds(layer.getBounds(), { padding: [20, 20] }); } catch {}
  })
  .catch(() => {});

// ======================
// 9) CARREGAR PORTOS
// ======================
fetch(URLS.portos)
  .then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status} em ${URLS.portos}`);
    return r.json();
  })
  .then(raw => {
    console.log('✅ Portos carregados. features =', raw?.features?.length ?? 0);

    const { geo, mode } = normalizeAndFixPortos(raw);
    console.log('🛠️ modo de correção =', mode);

    const portosLayer = L.geoJSON(geo, {
      pointToLayer: (_feature, latlng) => L.marker(latlng, { icon: boatIcon }),

      onEachFeature: (feature, layer) => {
        const props = feature.properties || {};
        const nome = props.name || 'Sem nome';
        const midiaDir = props.midia_dir || nome;

        layer.bindTooltip(esc(nome), {
          permanent: true,
          direction: 'top',
          offset: [0, -10],
          className: 'port-label'
        });

        const placeholder = `
          <div class="popup-wrap">
            <h3 style="margin:0 0 6px;font-size:14px;">${esc(nome)}</h3>
            ${propsToTable(props)}
            <div class="hint" style="margin-top:10px;">Abra o popup para carregar fotos/vídeos.</div>
          </div>
        `;
        layer.bindPopup(placeholder, { maxWidth: 420 });

        layer.on('popupopen', async () => {
          if (layer.__mediaLoaded) return;

          layer.setPopupContent(`
            <div class="popup-wrap">
              <h3 style="margin:0 0 6px;font-size:14px;">${esc(nome)}</h3>
              ${propsToTable(props)}
              <div class="hint" style="margin-top:10px;">Carregando fotos/vídeos...</div>
            </div>
          `);

          const media = await findMediaForDir(midiaDir, 60, 10);
          layer.__mediaLoaded = true;

          layer.setPopupContent(`
            <div class="popup-wrap">
              <h3 style="margin:0 0 6px;font-size:14px;">${esc(nome)}</h3>
              ${propsToTable(props)}
              ${galleryHtml(media)}
            </div>
          `);

          setTimeout(() => {
            const el = layer.getPopup()?.getElement();
            if (el) wireGalleryInteractions(el);
          }, 0);
        });
      }
    }).addTo(map);

    // sombra no ícone (opcional)
    if (styleBoatShadow) {
      setTimeout(() => {
        document.querySelectorAll('.boat-icon').forEach(el => {
          el.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,.25))';
        });
      }, 0);
    }

    // Não dá fit nos portos para manter sempre centralizado em Raposa
  })
  .catch(err => {
    console.error('❌ Erro ao carregar Portos.geojson:', err);
    alert('Falha ao carregar Portos.geojson. Veja o Console (F12).');
  });
