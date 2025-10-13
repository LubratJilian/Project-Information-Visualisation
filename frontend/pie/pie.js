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

const color = d3.scaleOrdinal(d3.schemeTableau10);

const pie = d3.pie().value(d => d.value).sort(null);
const arc = d3.arc().innerRadius(0).outerRadius(radius);

let dataByCountry = new Map();
// For drilldown: country -> category -> Map(channelName -> totalViews)
let dataByCountryCategoryChannels = new Map();

let currentCountry = null;
let currentDrillCategory = null;
const breadcrumbEl = d3.select('#breadcrumb');

function updateBreadcrumb() {
  breadcrumbEl.html('');
  const parts = [];
  if (currentCountry) parts.push({label: currentCountry, type: 'country'});
  if (currentDrillCategory) parts.push({label: currentDrillCategory, type: 'category'});

  if (parts.length === 0) return;

  // build breadcrumb
  const container = breadcrumbEl.append('div').attr('class', 'crumbs');
  parts.forEach((p, i) => {
    if (i > 0) container.append('span').attr('class','sep').text('›');
    if (p.type === 'country') {
      container.append('button').attr('class','crumb country').text(p.label).on('click', () => {
        // clicking country resets drill
        currentDrillCategory = null;
        renderForCountry(currentCountry);
      });
    } else {
      container.append('button').attr('class','crumb category').text(p.label).on('click', () => {
        // clicking category returns to category view if already in drill, otherwise drill
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

  // (no explicit back button; user can click the country or category in the breadcrumb to navigate)
}

function parseNumber(v) {
  const n = +v;
  return Number.isFinite(n) ? n : 0;
}

d3.csv(CSV_PATH, d => ({
  channel_name: d.channel_name || '',
  category: d.category || 'Unknown',
  country: (d.country || 'Unknown').trim(),
  view_count: parseNumber(d.view_count)
})).then(rows => {
  // Build aggregated map: country -> Map(category -> totalViews)
  rows.forEach(r => {
    const country = (r.country || 'Unknown').trim() || 'Unknown';
    const channelName = (r.channel_name || '').trim() || 'Unknown channel';
    // A channel can list multiple categories separated by commas. We count the
    // channel's view_count into each category independently so a channel with
    // 2 categories contributes to both categories.
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
  select.selectAll('option')
    .data(countries)
    .enter().append('option')
    .attr('value', d => d)
    .text(d => d);

  // initial render with first country
  if (countries.length) renderForCountry(countries[0]);

  select.on('change', function() {
    const c = this.value;
    // switching country resets any drilldown
    currentDrillCategory = null;
    renderForCountry(c);
  });
});

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

function renderForCountry(country) {
  currentCountry = country;
  currentDrillCategory = null;
  const catMap = dataByCountry.get(country) || new Map();
  const grouping = getCategoryGrouping(catMap, 12);
  const dataset = grouping.dataset;
  groupedCategoriesByCountry.set(country, grouping.groupedCategories || []);

  color.domain(dataset.map(d => d.category));

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
      // drill into category
      const cat = d.data.category;
      // toggle: if already drilled into this category, go back
      if (currentDrillCategory === cat) {
        currentDrillCategory = null;
        renderForCountry(currentCountry);
      } else {
        currentDrillCategory = cat;
        renderDrillForCategory(currentCountry, cat);
      }
    });

  // UPDATE + ENTER
  enter.merge(paths)
    .transition().duration(600)
    .attrTween('d', arcTween);

  renderLegend(dataset);
  updateBreadcrumb();
}

function renderDrillForCategory(country, category) {
  const byCountry = dataByCountryCategoryChannels.get(country) || new Map();
  let chMap = new Map();

  if (category === 'Autres') {
    // aggregate channels from grouped categories for this country
    const grouped = groupedCategoriesByCountry.get(country) || [];
    grouped.forEach(cat => {
      const m = byCountry.get(cat) || new Map();
      m.forEach((v,k) => chMap.set(k, (chMap.get(k)||0) + v));
    });
  } else {
    chMap = byCountry.get(category) || new Map();
  }

  // build dataset from channel map
  const arr = Array.from(chMap.entries()).map(([k,v]) => ({category: k, value: v})).filter(d => d.value > 0).sort((a,b)=>b.value - a.value);
  // group small channels into 'Autres' if too many
  let dataset;
  if (arr.length > 20) {
    const top = arr.slice(0, 19);
    const others = arr.slice(19).reduce((s,x)=>s+x.value,0);
    top.push({category: 'Autres', value: others});
    dataset = top;
  } else {
    dataset = arr;
  }

  color.domain(dataset.map(d => d.category));

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
    // clicking a channel does nothing special for now; could drill further
    .on('click', (event, d) => {
      // clicking the drill slice toggles back to category view
      currentDrillCategory = null;
      renderForCountry(currentCountry);
    });

  enter.merge(paths)
    .transition().duration(600)
    .attrTween('d', arcTween);

  // update legend to show channels
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
  // dataset may be array of {category, value}
  const legend = d3.select('#legend');
  legend.html('');
  // optional options: {isDrill:boolean, title:string}
  let opts = {};
  if (arguments.length > 1) opts = arguments[1] || {};
  if (opts.title) legend.append('div').attr('class','legend-title').text(opts.title);
  const total = d3.sum(dataset, d => d.value) || 0;
  const list = legend.selectAll('.item').data(dataset).enter().append('div').attr('class', 'item');
  list.append('span').attr('class', 'swatch').style('background', d => color(d.category));
  list.append('span').attr('class', 'label').text(d => {
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
    return `${d.category} — ${pct}% — ${d3.format(',')(d.value)} vues`;
  });
}

// tooltip
const tooltip = d3.select('body').append('div').attr('class', 'pie-tooltip').style('display','none');
function showTooltip(event, d) {
  // compute total from currently bound path data (categories or drill items)
  const bound = svg.selectAll('path').data();
  const total = d3.sum(bound, x => x && x.data ? x.data.value : 0) || 0;
  const pct = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : '0.0';
  tooltip.style('display','block')
    .html(`<strong>${d.data.category}</strong><br>${pct}% — ${d3.format(',')(d.data.value)} vues`);
  const [mx, my] = d3.pointer(event);
  tooltip.style('left', (event.pageX + 10) + 'px').style('top', (event.pageY + 10) + 'px');
}
function hideTooltip() { tooltip.style('display','none'); }

// expose for testing
export { renderForCountry };
