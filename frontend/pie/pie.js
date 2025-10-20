// Use the d3 instance injected on window by pie.html (loaded from CDN)
const d3 = window.d3;

const CSV_PATH = '/youtube_channel_info_v2.csv';

const width = 700;
const height = 500;
const radius = Math.min(width, height) / 2 - 20;

const svg = d3.select('#chart')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .append('g')
  .attr('transform', `translate(${width/2},${height/2})`);

// We'll build a palette dynamically per render depending on number of slices
let color = d3.scaleOrdinal(d3.schemeTableau10);

const pie = d3.pie().value(d => d.value).sort(null);
const arc = d3.arc().innerRadius(0).outerRadius(radius);

let dataByCountry = new Map();
// For drilldown: country -> category -> Map(channelName -> totalViews)
let dataByCountryCategoryChannels = new Map();

let currentCountry = null;
let currentDrillCategory = null;
const breadcrumbEl = d3.select('#breadcrumb');
const WORLD_KEY = 'Monde';

function updateBreadcrumb() {
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

// load CSV and build aggregated maps
d3.csv(CSV_PATH, d => ({
  channel_name: d.channel_name || '',
  category: d.category || 'Unknown',
  country: (d.country || 'Unknown').trim(),
  view_count: parseNumber(d.view_count)
})).then(rows => {
  rows.forEach(r => {
    const country = (r.country || 'Unknown').trim() || 'Unknown';
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

  // initial render: Monde (world aggregated)
  renderForCountry(WORLD_KEY);

  select.on('change', function() {
    const c = this.value;
    currentDrillCategory = null;
    renderForCountry(c);
  });
});

function renderForCountry(country) {
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

// expose for testing
export { renderForCountry };
