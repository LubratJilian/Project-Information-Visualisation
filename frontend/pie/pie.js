// Use the d3 instance injected on window by pie.html (loaded from CDN)
const d3 = window.d3;

const CSV_PATH = '../data/youtube.csv';

const width = 700;
const height = 500;
const radius = Math.min(width, height) / 2 - 20;

// svg will be created lazily when #chart exists
let svg = null;
function ensureSvg() {
  const container = d3.select('#chart');
  if (container.empty()) return false;
  // if we already have an svg selection, verify its node is still in the DOM
  if (svg) {
    const node = svg.node && svg.node();
    if (!node || !document.contains(node)) {
      svg = null; // was removed, recreate below
    }
  }
  if (!svg) {
    // compute size from the container to allow the pie to grow responsively
    const node = container.node();
    const rect = node.getBoundingClientRect();
    const w = Math.max(300, rect.width || width);
    // prefer a landscape feel but cap by viewport to avoid overflow
    const h = Math.max(300, Math.min(window.innerHeight * 0.65, w * 0.7));
    const r = Math.min(w, h) / 2 - 20;
    // update the outer arc radius used by transitions
    arc = d3.arc().innerRadius(0).outerRadius(r);

    svg = container.append('svg')
      .attr('width', w)
      .attr('height', h)
      .append('g')
      .attr('transform', `translate(${w/2},${h/2})`);
  }
  return true;
}

// populate the country <select> from current aggregates; called on each render so
// recreated DOM receives options even if aggregates were already built
function populateCountrySelect() {
  const countries = Array.from(dataByCountry.keys()).sort();
  const select = d3.select('#countrySelect');
  if (select.empty()) return;
  select.selectAll('option').remove();
  const allCountries = [WORLD_KEY].concat(countries);
  select.selectAll('option')
    .data(allCountries)
    .enter().append('option')
    .attr('value', d => d)
    .text(d => d);
}

// We'll build a palette dynamically per render depending on number of slices
let color = d3.scaleOrdinal(d3.schemeTableau10);

const pie = d3.pie().value(d => d.value).sort(null);
let arc = d3.arc().innerRadius(0).outerRadius(radius);

let dataByCountry = new Map();
// For drilldown: country -> category -> Map(channelName -> totalViews)
let dataByCountryCategoryChannels = new Map();

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

// store grouped categories per country so 'Autres' drill can fetch their channels
const groupedCategoriesByCountry = new Map();

// Aggregate category map across all countries (for Monde)
function aggregateAllCountriesCatMap() {
  const agg = new Map();
  for (const [, catMap] of dataByCountry.entries()) {
    for (const [cat, v] of catMap.entries()) {
      agg.set(cat, (agg.get(cat) || 0) + v);
    }
  }
  return agg;
}

// Aggregate channels for a given category across all countries
function aggregateCategoryChannelsAllCountries(category) {
  const agg = new Map();
  for (const [, byCountry] of dataByCountryCategoryChannels.entries()) {
    const chMap = byCountry.get(category);
    if (!chMap) continue;
    for (const [ch, v] of chMap.entries()) {
      agg.set(ch, (agg.get(ch) || 0) + v);
    }
  }
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
    // collect observed 2-letter country tokens for later reporting
    const rawToken = (r0.country || '').trim();
    const upToken = String(rawToken).toUpperCase();
    if (/^[A-Z]{2}$/.test(upToken)) observedCountryCodes.add(upToken);
    const r = {
      channel_name: r0.channel_name || '',
      category: r0.category || 'Unknown',
      country: (r0.country || 'Unknown').trim(),
      view_count: parseNumber(r0.view_count)
    };

    // normalize country for display within pie view (map codes to full names)
    const country = normalizeCountryForPie(r.country) || 'Unknown';
    const channelName = (r.channel_name || '').trim() || 'Unknown channel';
    const rawCats = (r.category || 'Unknown');
    const cats = rawCats.split(/\s*,\s*/).map(c => c.trim()).filter(c => c.length > 0);
    if (cats.length === 0) cats.push('Unknown');

    if (!dataByCountry.has(country)) dataByCountry.set(country, new Map());
    const catMap = dataByCountry.get(country);
    cats.forEach(cat => {
      const key = cat || 'Unknown';
      catMap.set(key, (catMap.get(key) || 0) + r.view_count);
      // store per-channel breakdown for drilldown
      if (!dataByCountryCategoryChannels.has(country)) dataByCountryCategoryChannels.set(country, new Map());
      const byCat = dataByCountryCategoryChannels.get(country);
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
  const rows = window.pipeline && window.pipeline.data;
  if (rows && rows.length > 0) {
    buildAggregatesFromRows(rows);
    if (done) done();
    return;
  }
  // retry soon
  setTimeout(() => buildAggregatesIfNeeded(done), 100);
}

function renderForCountry(country) {
  // Ensure SVG container exists and data aggregates are ready before rendering.
  // If not yet available, retry shortly.
  if (!ensureSvg()) {
    // DOM not ready; try again after a short delay
    setTimeout(() => renderForCountry(country), 100);
    return;
  }

  buildAggregatesIfNeeded(() => {
    // actual render logic moved here to run after data/dom readiness
    currentCountry = country;
    currentDrillCategory = null;
    const catMap = country === WORLD_KEY ? aggregateAllCountriesCatMap() : (dataByCountry.get(country) || new Map());

    // default grouping: top 9 + Autres => 10 items; if Autres > 50% then expand to 20
    let grouping = getCategoryGrouping(catMap, 10);
    const total = d3.sum(prepareDataset(catMap), d => d.value) || 0;
    const autres = grouping.dataset.find(d => d.category === 'Autres');
    let extendedMode = false;
    if (autres && total > 0 && (autres.value / total) > 0.5) {
      // switch to extended view showing more items
      grouping = getCategoryGrouping(catMap, 20);
      extendedMode = true;
    }

    const dataset = grouping.dataset;
    groupedCategoriesByCountry.set(country, grouping.groupedCategories || []);

    // reflect the active country in the selector
  // ensure the country select is populated (handles DOM recreation)
  populateCountrySelect();
  const select = d3.select('#countrySelect');
  if (!select.empty()) select.property('value', country);

    // rebuild color scale for the dataset size
    const palette = makeColorPalette(dataset.length || 1);
    color = d3.scaleOrdinal().domain(dataset.map(d => d.category)).range(palette);

    const arcs = pie(dataset);

    // DATA JOIN
    const paths = svg.selectAll('path').data(arcs, d => d.data.category);

    // EXIT
    paths.exit().transition().duration(400).attrTween('d', arcTweenExit).remove();

    // ENTER
    const enter = paths.enter().append('path')
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#000')
      .attr('stroke-width', 0.6)
      .attr('stroke-linejoin', 'round')
      .each(function(d) { this._current = d; })
      .on('mouseover', (event, d) => showTooltip(event, d))
      .on('mouseout', hideTooltip)
      .on('click', (event, d) => {
        const cat = d.data.category;
        if (currentDrillCategory === cat) {
          currentDrillCategory = null;
          renderForCountry(currentCountry);
        } else {
          currentDrillCategory = cat;
          renderDrillForCategory(currentCountry, cat);
        }
      });

    // UPDATE + ENTER: ensure fill is updated for both entering and updating arcs
    enter.merge(paths)
      .attr('fill', d => color(d.data.category))
      .attr('stroke', '#000')
      .attr('stroke-width', 0.6)
      .attr('stroke-linejoin', 'round')
      .transition().duration(600)
      .attrTween('d', arcTween);

    // show chart title, add small badge if extended
    const titleEl = d3.select('#chartTitle');
    const titleParts = [country];
    titleEl.text(titleParts.join(' › ') + (extendedMode ? '  (Mode étendu — 20)' : ''));

    renderLegend(dataset);
    updateBreadcrumb();
  });
}

function renderDrillForCategory(country, category) {
  let chMap = new Map();
  if (country === WORLD_KEY) {
    if (category === 'Autres') {
      const grouped = groupedCategoriesByCountry.get(WORLD_KEY) || [];
      grouped.forEach(cat => {
        const m = aggregateCategoryChannelsAllCountries(cat) || new Map();
        m.forEach((v,k) => chMap.set(k, (chMap.get(k)||0) + v));
      });
    } else {
      chMap = aggregateCategoryChannelsAllCountries(category) || new Map();
    }
  } else {
    const byCountry = dataByCountryCategoryChannels.get(country) || new Map();
    if (category === 'Autres') {
      const grouped = groupedCategoriesByCountry.get(country) || [];
      grouped.forEach(cat => {
        const m = byCountry.get(cat) || new Map();
        m.forEach((v,k) => chMap.set(k, (chMap.get(k)||0) + v));
      });
    } else {
      chMap = byCountry.get(category) || new Map();
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
const tooltip = d3.select('body').append('div').attr('class', 'pie-tooltip').style('display','none');
function showTooltip(event, d) {
  const bound = svg.selectAll('path').data();
  const total = d3.sum(bound, x => x && x.data ? x.data.value : 0) || 0;
  const pct = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : '0.0';
  const fmt3 = d3.format('.3s');
  tooltip.style('display','block')
    .html(`<strong>${d.data.category}</strong><br>${pct}% — ${fmt3(d.data.value)} vues`);
  tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
}
function hideTooltip() { tooltip.style('display','none'); }

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

// gestion des boutons
document.getElementById('box-btn').addEventListener('click', () => {
  // suppression du pie si affiché
  const pieContainer = document.getElementById('pie-container');
  if (pieContainer) pieContainer.remove();

  // affichage du treemap
  const svgDiv = document.getElementById('svg');
  svgDiv.style.display = '';
  const filter = document.getElementById('filter-panel');
  if (filter) filter.style.display = '';
  renderTreemap();
});

document.getElementById('pie-btn').addEventListener('click', () => {
  // cacher le treemap
  const svgDiv = document.getElementById('svg');
  if (svgDiv) {
    svgDiv.innerHTML = '';
    svgDiv.style.display = 'none';
  }
  // afficher le pie
  showPie();
  renderForCountry('Monde');
});

// expose for testing
export { renderForCountry };
// Create/show pie DOM and prepare the view; exported so index.js can call it.
function showPie() {
  // hide filter panel while pie is visible to avoid layout shifting
  const filter = document.getElementById('filter-panel');
  if (filter) filter.style.display = 'none';

  // ensure pie UI elements are present in a dedicated container; create if missing
  let pieContainer = document.getElementById('pie-container');
  if (!pieContainer) {
    const main = document.querySelector('main');
    pieContainer = document.createElement('div');
    pieContainer.id = 'pie-container';
    pieContainer.style.width = '100%';
    pieContainer.style.boxSizing = 'border-box';
    // layout: controls on top, chart + legend in a row below
    pieContainer.innerHTML = `
      <div id="pie-controls">
        <label for="countrySelect">Pays :</label>
        <select id="countrySelect"></select>
      </div>
      <div id="pie-main" style="display:flex;align-items:flex-start;gap:18px;">
        <div id="chartWrapper" style="flex:1;display:flex;flex-direction:column;align-items:center;">
          <div id="chartTitle" class="chart-title"></div>
          <div id="chart" tabindex="0" style="width:100%;"></div>
        </div>
        <aside id="legend" style="width:260px;flex:0 0 260px;"></aside>
      </div>
    `;
    main.appendChild(pieContainer);
  }

  // If aggregates already exist, populate selects immediately
  if (dataByCountry.size > 0) populateCountrySelect();

  // attach a resize handler to recompute svg size and re-render
  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // drop old svg so ensureSvg will recreate using new container size
      if (svg) {
        const node = svg.node && svg.node();
        if (node && node.parentNode) node.parentNode.removeChild(node);
        svg = null;
      }
      // re-render current view
      if (currentCountry) renderForCountry(currentCountry);
    }, 150);
  }
  window.removeEventListener('resize', onResize);
  window.addEventListener('resize', onResize);
}

export { showPie };
