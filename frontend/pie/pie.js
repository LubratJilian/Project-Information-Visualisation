// Inject pie chart CSS styles dynamically
function injectPieStyles() {
  if (document.getElementById('pie-style')) return;
  const style = document.createElement('style');
  style.id = 'pie-style';
  style.textContent = `
body{font-family: Arial, Helvetica, sans-serif; margin:20px}
header{margin-bottom:12px}
#chart{display:inline-block;vertical-align:top}
#legend{display:inline-block; width:260px; margin-left:18px; vertical-align:top}
.item{display:flex;align-items:center;margin:6px 0}
.swatch{width:18px;height:18px;margin-right:8px;border-radius:3px}
.label{font-size:14px}
.pie-tooltip{position:absolute;background:#fff;border:1px solid rgba(0,0,0,0.12);padding:8px;border-radius:4px;box-shadow:0 4px 12px rgba(0,0,0,0.08);pointer-events:none;font-size:13px}
.chart-title{font-size:18px;margin:6px 0 10px 0;font-weight:700;text-align:center;width:100%}
@media (max-width:800px){
  #chart svg{width:100%;height:auto}
  #legend{display:block;width:100%;margin-left:0;margin-top:12px}
}
`;
  document.head.appendChild(style);
}

// Use the d3 instance injected on window by pie.html (loaded from CDN)
const d3 = window.d3;

const CSV_PATH = '../data/youtube.csv';

// (width, height, radius are declared as let below)

// Use the shared #svg container and SVG element
let svg = null;
let width = 700;
let height = 500;
let radius = Math.min(width, height) / 2 - 20;
function ensureSvg() {
  const container = d3.select('#svg');
  if (container.empty()) return false;
  container.selectAll('svg').remove();
  const rect = container.node().getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  // Fill as much as possible, with a small margin
  radius = Math.min(width, height) / 2 - 8;
  // Place the pie at the top (with margin)
  const marginTop = 32;
  const svgElem = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%')
    .style('font-family', 'Arial, sans-serif');
  svgElem.append('text')
    .attr('class', 'pie-title')
    .attr('x', width / 2)
    .attr('y', 24)
    .attr('text-anchor', 'middle')
    .attr('font-size', '22px')
    .attr('font-weight', 'bold')
    .attr('fill', '#2d3748')
    .text('Monde');
  svg = svgElem.append('g')
    .attr('transform', `translate(${width/2},${radius + marginTop})`);
  return true;
}

// No-op: country selection UI is not handled in pie.js anymore
function populateCountrySelect() {}

// We'll build a palette dynamically per render depending on number of slices
let color = d3.scaleOrdinal(d3.schemeTableau10);

const pie = d3.pie().value(d => d.value).sort(null);
let arc = d3.arc().innerRadius(0).outerRadius(radius);



let currentCountry = null;
let currentDrillCategory = null;
let resizeTimer = null;
// don't capture breadcrumb at module load (DOM may not exist); select it lazily
function getBreadcrumbEl() { return d3.select('#breadcrumb'); }
const WORLD_KEY = 'Monde';

// small mapping for common ISO alpha-2 codes -> full country name (used only in pie view)
const countryCodeMap = { AE: 'United Arab Emirates', AF: 'Afghanistan', AG: 'Antigua and Barbuda', AL: 'Albania', AQ:'Antarctica', AR: 'Argentina', AT: 'Austria', AU: 'Australia', BA: 'Bosnia and Herzegovina', BD: 'Bangladesh', BE: 'Belgium', BG: 'Bulgaria', BH: 'Bahrain', BM: 'Bermuda', BR: 'Brazil', BY: 'Belarus', CA: 'Canada', CH: 'Switzerland', CL: 'Chile', CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CZ: 'Czech Republic', CX: 'Christmas Island', CY: 'Cyprus', DE: 'Germany', DK: 'Denmark', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador', EE: 'Estonia', EG: 'Egypt', ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GE: 'Georgia', GH: 'Ghana', GM: 'Gambia', GR: 'Greece', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IN: 'India', IQ: 'Iraq', IS: 'Iceland', IT: 'Italy', JM: 'Jamaica', JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KH: 'Cambodia', KR: 'South Korea', KZ: 'Kazakhstan', LA: 'Laos', LB: 'Lebanon', LK: 'Sri Lanka', LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', LY: 'Libya', MA: 'Morocco', MC: 'Monaco', MD: 'Moldova', ME: 'Montenegro', MK: 'North Macedonia', MT: 'Malta', MX: 'Mexico', MY: 'Malaysia', NG: 'Nigeria', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal', NZ: 'New Zealand', OM: 'Oman', PE: 'Peru', PH: 'Philippines', PK: 'Pakistan', PL: 'Poland', PR: 'Puerto Rico', PT: 'Portugal', PY: 'Paraguay', QA: 'Qatar', RO: 'Romania', RS: 'Serbia', RU: 'Russia', SA: 'Saudi Arabia', SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', SK: 'Slovakia', SV: 'El Salvador', TH: 'Thailand', TN: 'Tunisia', TR: 'Turkey', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine', UG: 'Uganda', UM: 'Minor Outlying Islands', US: 'United States', UY: 'Uruguay', VI: 'Virgin Islands', VN: 'Vietnam', ZA: 'South Africa', ZW: 'Zimbabwe', UK: 'United Kingdom' };

// track observed 2-letter country tokens from the dataset so we can ask user to expand map
const observedCountryCodes = new Set();

function toTitleCase(s) {
  if (!s) return s;
  return String(s).toLowerCase().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function normalizeCountryForPie(rawCountry) {
  if (!rawCountry) return 'Unknown';
  const str = String(rawCountry).trim();
  if (str === '') return 'Unknown';
  const up = str.toUpperCase();
  if (/^[A-Z]{2}$/.test(up)) return countryCodeMap[up] || up;
  if (str === str.toUpperCase()) return toTitleCase(str);
  return str;
}

function updateBreadcrumb() {
  const breadcrumbEl = getBreadcrumbEl();
  breadcrumbEl.html('');
  const parts = [];
  parts.push({label: WORLD_KEY, type: 'world'});
  if (currentCountry && currentCountry !== WORLD_KEY) parts.push({label: currentCountry, type: 'country'});
  if (currentDrillCategory) parts.push({label: currentDrillCategory, type: 'category'});

  const container = breadcrumbEl.append('div').attr('class', 'crumbs');
  parts.forEach((p, i) => {
    if (i > 0) container.append('span').attr('class','sep').text('›');
    if (p.type === 'world') {
      container.append('button').attr('class','crumb world').text(p.label).on('click', () => {
        currentDrillCategory = null;
        renderForCountry(WORLD_KEY);
      });
    } else if (p.type === 'country') {
      container.append('button').attr('class','crumb country').text(p.label).on('click', () => {
        currentDrillCategory = null;
        renderForCountry(p.label);
      });
    } else {
      container.append('button').attr('class','crumb category').text(p.label).on('click', () => {
        if (currentDrillCategory === p.label) {
          currentDrillCategory = null;
          renderForCountry(currentCountry);
        } else {
          currentDrillCategory = p.label;
          renderDrillForCategory(currentCountry, p.label);
        }
      });
    }
  });

  // highlight the active (last) crumb
  const crumbs = breadcrumbEl.selectAll('.crumb');
  crumbs.classed('active', false);
  const last = crumbs.nodes()[crumbs.size() - 1];
  if (last) d3.select(last).classed('active', true);

  // update chart title showing the current path
  const titleEl = d3.select('#chartTitle');
  const titleParts = parts.map(p => p.label);
  titleEl.text(titleParts.join(' › '));
}

function parseNumber(v) {
  const n = +v;
  return Number.isFinite(n) ? n : 0;
}

// Helper: prepare dataset array from a Map(category->value)
function prepareDataset(catMap) {
  const arr = Array.from(catMap.entries())
    .map(([k, v]) => ({category: k, value: v}))
    .filter(d => d.value > 0)
    .sort((a,b) => b.value - a.value);
  return arr;
}

// Return dataset and list of categories that were grouped into 'Autres'
function getCategoryGrouping(catMap, maxCategories = 12) {
  const arr = prepareDataset(catMap);
  if (arr.length <= maxCategories) return {dataset: arr, groupedCategories: []};
  const top = arr.slice(0, maxCategories - 1);
  const othersList = arr.slice(maxCategories - 1);
  const othersValue = othersList.reduce((s, x) => s + x.value, 0);
  top.push({category: 'Autres', value: othersValue});
  const othersCategories = othersList.map(d => d.category);
  return {dataset: top, groupedCategories: othersCategories};
}



// Aggregate category map across all countries (for Monde)
function aggregateAllCountriesCatMap() {
  // Agrège les catégories sur toutes les données filtrées
  const rows = window.pipeline && typeof window.pipeline.run === 'function' ? window.pipeline.run() : [];
  const agg = new Map();
  rows.forEach(r => {
    const rawCats = (r.category || 'Unknown');
    const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
    const v = parseNumber(r.view_count);
    cats.forEach(cat => {
      agg.set(cat, (agg.get(cat) || 0) + v);
    });
  });
  return agg;
}

// Aggregate channels for a given category across all countries
function aggregateCategoryChannelsAllCountries(category) {
  // Agrège les chaînes pour une catégorie sur toutes les données filtrées
  const rows = window.pipeline && typeof window.pipeline.run === 'function' ? window.pipeline.run() : [];
  const agg = new Map();
  rows.forEach(r => {
    const rawCats = (r.category || 'Unknown');
    const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
    if (cats.includes(category)) {
      const ch = (r.channel_name || '').trim() || 'Unknown channel';
      const v = parseNumber(r.view_count);
      agg.set(ch, (agg.get(ch) || 0) + v);
    }
  });
  return agg;
}

// Create a palette of n colors using an interpolator (vivid turbo by default)
function makeColorPalette(n) {
  if (!n || n <= 0) return [];
  // use d3.interpolateTurbo and quantize to n steps
  return d3.quantize(d3.interpolateTurbo, n);
}

// Build aggregated maps from an array of rows (same normalization as previous CSV loader)
function buildAggregatesFromRows(rows) {
  rows.forEach(r0 => {
    // On garde le code pays brut (ex: 'AE') comme clé
    const code = (r0.country || '').trim().toUpperCase();
    const r = {
      channel_name: r0.channel_name || '',
      category: r0.category || 'Unknown',
      country: code || 'Unknown',
      view_count: parseNumber(r0.view_count)
    };
    const channelName = (r.channel_name || '').trim() || 'Unknown channel';
    const rawCats = (r.category || 'Unknown');
    const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
    if (cats.length === 0) cats.push('Unknown');
    if (!dataByCountry.has(code)) dataByCountry.set(code, new Map());
    const catMap = dataByCountry.get(code);
    cats.forEach(cat => {
      const key = cat || 'Unknown';
      catMap.set(key, (catMap.get(key) || 0) + r.view_count);
      if (!dataByCountryCategoryChannels.has(code)) dataByCountryCategoryChannels.set(code, new Map());
      const byCat = dataByCountryCategoryChannels.get(code);
      if (!byCat.has(key)) byCat.set(key, new Map());
      const chMap = byCat.get(key);
      chMap.set(channelName, (chMap.get(channelName) || 0) + r.view_count);
    });
  });

  const countries = Array.from(dataByCountry.keys()).sort();

  const select = d3.select('#countrySelect');
  select.selectAll('option').remove();
  const allCountries = [WORLD_KEY].concat(countries);
  select.selectAll('option')
    .data(allCountries)
    .enter().append('option')
    .attr('value', d => d)
    .text(d => d);

  select.on('change', function() {
    const c = this.value;
    currentDrillCategory = null;
    renderForCountry(c);
  });
}

function buildAggregatesIfNeeded(done) {
  if (dataByCountry.size > 0) {
    if (done) done();
    return;
  }
  // Utilise toujours les données filtrées du pipeline
  const rows = window.pipeline && typeof window.pipeline.run === 'function' ? window.pipeline.run() : [];
  if (rows && rows.length > 0) {
    buildAggregatesFromRows(rows);
    if (done) done();
    return;
  }
  // retry soon
  setTimeout(() => buildAggregatesIfNeeded(done), 100);
}


function renderDrillForCategory(country, category) {
  // Met à jour le titre dans le SVG
  d3.select('#svg svg .pie-title').text(country + ' > ' + category);
  // Agrégation drilldown uniquement à partir des données filtrées
  const rows = window.pipeline && typeof window.pipeline.run === 'function' ? window.pipeline.run() : [];
  let chMap = new Map();
  if (country === WORLD_KEY) {
    if (category === 'Autres') {
      // Regroupe les chaînes des catégories "Autres" (top 10/20)
      // On doit recalculer les catégories "Autres" sur toutes les données filtrées
      let catMap = aggregateAllCountriesCatMap();
      let grouping = getCategoryGrouping(catMap, 10);
      const total = d3.sum(prepareDataset(catMap), d => d.value) || 0;
      const autres = grouping.dataset.find(d => d.category === 'Autres');
      if (autres && total > 0 && (autres.value / total) > 0.5) {
        grouping = getCategoryGrouping(catMap, 20);
      }
      const grouped = grouping.groupedCategories || [];
      rows.forEach(r => {
        const rawCats = (r.category || 'Unknown');
        const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
        if (cats.some(cat => grouped.includes(cat))) {
          const ch = (r.channel_name || '').trim() || 'Unknown channel';
          const v = parseNumber(r.view_count);
          chMap.set(ch, (chMap.get(ch) || 0) + v);
        }
      });
    } else {
      // Drilldown sur une catégorie précise (tous pays)
      rows.forEach(r => {
        const rawCats = (r.category || 'Unknown');
        const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
        if (cats.includes(category)) {
          const ch = (r.channel_name || '').trim() || 'Unknown channel';
          const v = parseNumber(r.view_count);
          chMap.set(ch, (chMap.get(ch) || 0) + v);
        }
      });
    }
  } else {
    if (category === 'Autres') {
      // Regroupe les chaînes des catégories "Autres" pour le pays sélectionné
      // On doit recalculer les catégories "Autres" sur les données filtrées du pays
      let catMap = new Map();
      rows.filter(r => (r.country || '').trim().toUpperCase() === country).forEach(r => {
        const rawCats = (r.category || 'Unknown');
        const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
        const v = parseNumber(r.view_count);
        cats.forEach(cat => {
          catMap.set(cat, (catMap.get(cat) || 0) + v);
        });
      });
      let grouping = getCategoryGrouping(catMap, 10);
      const total = d3.sum(prepareDataset(catMap), d => d.value) || 0;
      const autres = grouping.dataset.find(d => d.category === 'Autres');
      if (autres && total > 0 && (autres.value / total) > 0.5) {
        grouping = getCategoryGrouping(catMap, 20);
      }
      const grouped = grouping.groupedCategories || [];
      rows.filter(r => (r.country || '').trim().toUpperCase() === country).forEach(r => {
        const rawCats = (r.category || 'Unknown');
        const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
        if (cats.some(cat => grouped.includes(cat))) {
          const ch = (r.channel_name || '').trim() || 'Unknown channel';
          const v = parseNumber(r.view_count);
          chMap.set(ch, (chMap.get(ch) || 0) + v);
        }
      });
    } else {
      // Drilldown sur une catégorie précise pour le pays sélectionné
      rows.filter(r => (r.country || '').trim().toUpperCase() === country).forEach(r => {
        const rawCats = (r.category || 'Unknown');
        const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
        if (cats.includes(category)) {
          const ch = (r.channel_name || '').trim() || 'Unknown channel';
          const v = parseNumber(r.view_count);
          chMap.set(ch, (chMap.get(ch) || 0) + v);
        }
      });
    }
  }

  // build dataset from channel map
  const arr = Array.from(chMap.entries()).map(([k,v]) => ({category: k, value: v})).filter(d => d.value > 0).sort((a,b)=>b.value - a.value);

  // default grouping for drill: top 9 + Autres => 10 items; allow extension if Autres dominant
  let datasetObj = {dataset: arr, groupedCategories: []};
  if (arr.length > 10) {
    datasetObj = getCategoryGrouping(new Map(arr.map(d => [d.category, d.value])), 10);
    const total = d3.sum(arr, d => d.value) || 0;
    const autres = datasetObj.dataset.find(d => d.category === 'Autres');
    if (autres && total > 0 && (autres.value / total) > 0.5) {
      datasetObj = getCategoryGrouping(new Map(arr.map(d => [d.category, d.value])), 20);
    }
  }

  const dataset = datasetObj.dataset;

  // rebuild palette for channels
  const palette = makeColorPalette(dataset.length || 1);
  color = d3.scaleOrdinal().domain(dataset.map(d => d.category)).range(palette);

  // Remove previous arcs
  svg.selectAll('path').remove();

  const arcs = pie(dataset);

  const paths = svg.selectAll('path').data(arcs, d => d.data.category);
  paths.exit().transition().duration(400).attrTween('d', arcTweenExit).remove();

  const enter = paths.enter().append('path')
    .attr('fill', d => color(d.data.category))
    .attr('stroke', '#000')
    .attr('stroke-width', 0.6)
    .attr('stroke-linejoin', 'round')
    .each(function(d) { this._current = d; })
    .on('mouseover', (event, d) => showTooltip(event, d))
    .on('mouseout', hideTooltip)
    .on('click', (event, d) => {
      // clicking the drill slice toggles back to category view
      currentDrillCategory = null;
      renderForCountry(currentCountry);
    });

  enter.merge(paths)
    .attr('fill', d => color(d.data.category))
    .attr('stroke', '#000')
    .attr('stroke-width', 0.6)
    .attr('stroke-linejoin', 'round')
    .transition().duration(600)
    .attrTween('d', arcTween);

  renderLegend(dataset, {isDrill: true, title: `Chaînes — ${category} (${country})`});
  updateBreadcrumb();
}

function arcTween(a) {
  const i = d3.interpolate(this._current, a);
  this._current = i(1);
  return function(t) { return arc(i(t)); };
}

function arcTweenExit(a) {
  const start = this._current;
  const end = {startAngle: start.endAngle, endAngle: start.endAngle};
  const i = d3.interpolate(start, end);
  return function(t) { return arc(i(t)); };
}

function renderLegend(dataset) {
  const legend = d3.select('#legend');
  legend.html('');
  let opts = {};
  if (arguments.length > 1) opts = arguments[1] || {};
  if (opts.title) legend.append('div').attr('class','legend-title').text(opts.title);
  const total = d3.sum(dataset, d => d.value) || 0;
  const list = legend.selectAll('.item').data(dataset).enter().append('div').attr('class', 'item');
  list.append('span').attr('class', 'swatch').style('background', d => color(d.category));
  list.append('span').attr('class', 'label').text(d => {
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
    return `${d.category} — ${pct}%`;
  });
}

// tooltip
let tooltip = d3.select('body').select('.pie-tooltip');
if (tooltip.empty()) {
  tooltip = d3.select('body').append('div')
    .attr('class', 'pie-tooltip')
    .style('display','none')
    .style('position', 'fixed')
    .style('z-index', '9999')
    .style('pointer-events', 'none')
    .style('background', '#fff')
    .style('color', '#222')
    .style('border', '1px solid #ddd')
    .style('border-radius', '5px')
    .style('box-shadow', '0 4px 12px rgba(0,0,0,0.10)')
    .style('padding', '10px')
    .style('font-size', '13px');
}
function showTooltip(event, d) {
  const bound = svg.selectAll('path').data();
  const total = d3.sum(bound, x => x && x.data ? x.data.value : 0) || 0;
  const pct = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : '0.0';
  const fmt3 = d3.format('.3s');
  tooltip.style('display','block')
    .html(`<strong>${d.data.category}</strong><br>${pct}% — ${fmt3(d.data.value)} vues`);
  // Use clientX/clientY for fixed positioning
  tooltip.style('left', (event.clientX + 16) + 'px')
    .style('top', (event.clientY + 12) + 'px');
}
function hideTooltip() { tooltip.style('display','none'); }
// --- Filter synchronization logic (like box.js/bubble.js) ---
function getSelectedCountryFromFilter() {
  // Récupère la liste des pays sélectionnés dans les filtres globaux (state.filters)
  let selected = [];
  if (window.state && window.state.filters && Array.isArray(window.state.filters.selectedCountries)) {
    selected = window.state.filters.selectedCountries;
  } else {
    // fallback DOM (rare)
    const items = document.querySelectorAll('#countryDropdown .multi-select-items input[type="checkbox"]');
    selected = Array.from(items).filter(cb => cb.checked).map(cb => cb.value);
  }
  console.log('[pie.js][getSelectedCountryFromFilter] Codes pays sélectionnés:', selected);
  if (selected.length === 1) return selected[0];
  if (selected.length > 1) return 'Monde';
  return null;
}

function onFilterApplyPie() {
  console.log('[pie.js][onFilterApplyPie] Application des filtres...');
  // Log l'état global des filtres reçus
  if (window.state && window.state.filters) {
    console.log('[pie.js][onFilterApplyPie] Filtres reçus dans pie.js :', JSON.stringify(window.state.filters, null, 2));
  }
  const selectedCountry = getSelectedCountryFromFilter();
  console.log('[pie.js][onFilterApplyPie] Code pays filtré reçu:', selectedCountry);
  if (selectedCountry) {
    currentCountry = selectedCountry;
    currentDrillCategory = null;
    console.log('[pie.js][onFilterApplyPie] Appel renderForCountry avec:', selectedCountry);
    renderForCountry(selectedCountry);
  } else {
    currentCountry = 'Monde';
    currentDrillCategory = null;
    console.log('[pie.js][onFilterApplyPie] Aucun pays sélectionné, appel renderForCountry avec: Monde');
    renderForCountry('Monde');
  }
}

// Listen for filter apply events (assume filter apply button has id 'applyFiltersBtn')
function setupPieFilterSync() {
  const btn = document.getElementById('applyFiltersBtn');
  if (btn && !btn._pieSyncAttached) {
    btn.addEventListener('click', onFilterApplyPie);
    btn._pieSyncAttached = true;
  }
}

// Call setupPieFilterSync on pie chart show/init

import DataPipeline from "../pipeline.js";
import { renderTreemap } from "../box/box.js";

// création du pipeline global
const pipeline = new DataPipeline();
// expose globalement pour être lisible depuis d'autres modules
window.pipeline = pipeline;

// fonction d'initialisation
window.initPipeline = function () {
  pipeline.load("data/youtube.csv", "csv").then();
};

// gestion des boutons : handled in index.js

// expose for testing
// Nouvelle version : accepte un tableau de catégories sélectionnées
export function renderForCountry(country, categories) {
  // Ajout : log complet de l'état du pipeline et des filtres reçus
  if (window && window.pipeline && typeof window.pipeline.run === 'function') {
    try {
      const lastRows = window.pipeline.run();
      if (window.state && window.state.filters) {
        console.log('[pie.js][renderForCountry] Filtres reçus (window.state.filters) :', JSON.stringify(window.state.filters, null, 2));
      }
      console.log('[pie.js][renderForCountry] Données filtrées (pipeline.run) :', lastRows);
    } catch (e) {
      console.warn('[pie.js][renderForCountry] Impossible d\'afficher les filtres ou données filtrées', e);
    }
  }
  // Correction : fallback sur 'Monde' si country est undefined ou vide
  if (!country) {
    console.warn('[pie.js][renderForCountry] Pays reçu indéfini, fallback sur Monde');
    country = 'Monde';
  }
  // Calculer dynamiquement la liste des pays connus à partir des données filtrées
  const rowsCountries = window.pipeline && typeof window.pipeline.run === 'function' ? window.pipeline.run() : [];
  const knownCountries = Array.from(new Set(rowsCountries.map(r => (r.country || '').trim().toUpperCase()))).filter(c => c);
  if (country !== 'Monde' && !knownCountries.includes(country)) {
    console.warn('[pie.js][renderForCountry] Code pays non trouvé dans les données filtrées, fallback sur Monde:', country);
    country = 'Monde';
  }
  // Gestion des catégories sélectionnées
  const filtered = window.pipeline && typeof window.pipeline.run === 'function' ? window.pipeline.run() : [];
  let filteredByCountry = country === 'Monde' ? filtered : filtered.filter(d => (d.country || '').trim().toUpperCase() === country);
  let filteredByCat = categories && categories.length > 0
    ? filteredByCountry.filter(d => {
        if (!d.category) return false;
        const channelCategories = new Set(d.category.split(',').map(cat => cat.trim()));
        return categories.some(selected => channelCategories.has(selected));
      })
    : filteredByCountry;

  // Met à jour le texte du titre en haut du diagramme
  let countryLabel = country === 'Monde' ? 'Monde' : (countryCodeMap[country] || country);
  console.log("countryLabel:", countryLabel);
  const title = document.getElementById('chartTitle');
  if (filteredByCat.length === 0) {
    if (title) title.textContent = '';
    const svgContainer = document.getElementById('svg');
    if (svgContainer) svgContainer.innerHTML = '<div style="text-align:center;padding:2em;font-size:1.3em;color:#b00">Pas de résultat pour ces filtres</div>';
    const legend = document.getElementById('legend');
    if (legend) legend.innerHTML = '';
    return;
  } else {
    // Si on a des résultats, on efface le message d'erreur éventuel
    const svgContainer = document.getElementById('svg');
    if (svgContainer && svgContainer.innerHTML.includes('Pas de résultat pour ces filtres')) {
      svgContainer.innerHTML = '';
    }
  }
  // Toujours mettre à jour le titre selon le contexte
  if (categories && categories.length === 1) {
    if (title) title.textContent = countryLabel + ' > ' + categories[0];
    _renderPieBase(country);
    setTimeout(() => {
      renderDrillForCategory(country, categories[0]);
    }, 100);
    return;
  }
  if (categories && categories.length > 1) {
    if (title) title.textContent = countryLabel + ' > ' + categories.join(', ');
    _renderPieBase(country);
    setTimeout(() => {
      categories.forEach(cat => renderDrillForCategory(country, cat));
    }, 100);
    return;
  }
  // Sinon, camembert classique (pays seul)
  if (title) title.textContent = countryLabel;
  _renderPieBase(country);
}

// Sépare la logique de rendu du camembert de base (catégories globales)
function _renderPieBase(country) {
  // Met à jour le titre dans le SVG (affiche le nom complet du pays si code)
  let countryLabel = 'Monde';
  if (country && country !== 'Monde') {
    countryLabel = countryCodeMap[country] || country;
  }
  if (!ensureSvg()) {
    setTimeout(() => _renderPieBase(country), 100);
    return;
  }
  // Toujours mettre à jour le titre après création du SVG
  d3.select('#svg svg .pie-title').text(countryLabel);
  currentCountry = country;
  currentDrillCategory = null;
  const rows = window.pipeline && typeof window.pipeline.run === 'function' ? window.pipeline.run() : [];
  let catMap = new Map();
  if (country === WORLD_KEY) {
    catMap = aggregateAllCountriesCatMap();
  } else {
    rows.filter(r => (r.country || '').trim().toUpperCase() === country).forEach(r => {
      const rawCats = (r.category || 'Unknown');
      const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
      const v = parseNumber(r.view_count);
      cats.forEach(cat => {
        catMap.set(cat, (catMap.get(cat) || 0) + v);
      });
    });
  }
  let grouping = getCategoryGrouping(catMap, 10);
  const total = d3.sum(prepareDataset(catMap), d => d.value) || 0;
  const autres = grouping.dataset.find(d => d.category === 'Autres');
  let extendedMode = false;
  if (autres && total > 0 && (autres.value / total) > 0.5) {
    grouping = getCategoryGrouping(catMap, 20);
    extendedMode = true;
  }
  const dataset = grouping.dataset;
  const palette = makeColorPalette(dataset.length || 1);
  color = d3.scaleOrdinal().domain(dataset.map(d => d.category)).range(palette);
  const arcs = pie(dataset);
  const paths = svg.selectAll('path').data(arcs, d => d.data.category);
  paths.exit().transition().duration(400).attrTween('d', arcTweenExit).remove();
  const enter = paths.enter().append('path')
    .attr('fill', d => color(d.data.category))
    .attr('stroke', '#000')
    .attr('stroke-width', 0.6)
    .attr('stroke-linejoin', 'round')
    .each(function(d) { this._current = d; })
    .on('pointerenter', function(event, d) { showTooltip(event, d); })
    .on('pointermove', function(event, d) { showTooltip(event, d); })
    .on('pointerleave', function() { hideTooltip(); })
    .on('click', (event, d) => {
      const cat = d.data.category;
      if (currentDrillCategory === cat) {
        currentDrillCategory = null;
        _renderPieBase(currentCountry);
      } else {
        currentDrillCategory = cat;
        renderDrillForCategory(currentCountry, cat);
      }
    });
  enter.merge(paths)
    .attr('fill', d => color(d.data.category))
    .attr('stroke', '#000')
    .attr('stroke-width', 0.6)
    .attr('stroke-linejoin', 'round')
    .transition().duration(600)
    .attrTween('d', arcTween);
  renderLegend(dataset);
  updateBreadcrumb();
}
// Create/show pie DOM and prepare the view; exported so index.js can call it.
function showPie() {
  injectPieStyles();
  // hide filter panel while pie is visible to avoid layout shifting
  const filter = document.getElementById('filter-panel');
  if (filter) filter.style.display = 'none';
  const container = d3.select('#svg');
  container.html('');
  // ensure world data is loaded
  buildAggregatesIfNeeded(() => {
    renderForCountry(WORLD_KEY);
  });
}

// Call showPie on page load or pie chart tab activation
window.showPie = showPie;
