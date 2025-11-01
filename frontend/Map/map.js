import pipeline from "../index.js";
import DataPipeline from "../pipeline.js";

// CONSTANTS
const ZOOM_THRESHOLD = 5;
const COLOR_SCALE = [
  '#ffffff', '#fee5d9', '#fcbba1', '#fc9272', '#fb6a4a',
  '#ef3b2c', '#cb181d', '#a50f15', '#67000d'
];
const COLOR_THRESHOLDS = [0, 0.02, 0.05, 0.09, 0.15, 0.25, 0.40, 0.60, 0.80, 1.0];
const LEGEND_LABELS = ['0–2%', '2–5%', '5–9%', '9–15%', '15–25%', '25–40%', '40–60%', '60–80%', '80–100%'];

const METRIC_LABELS = {
  avgSubscribers: 'Abonnés moyens par chaînes',
  totalSubscribers: 'Total d\'abonnés',
  avgVideos: 'Vidéos moyennes par chaînes',
  maxSubscribers: 'Abonnés maximum (plus grosse chaîne)',
  totalVideos: 'Total de vidéos',
  channelCount: 'Nombre de chaînes'
};


// STATE
let state = {
  map: null,
  geoLayer: null,
  previousCountry: undefined,
  currentMetric: 'maxSubscribers',
  globalStatsCountry: null,
  currentMaxValue: 0,
  currentMinValue: 0,
  legendControl: null,
  countryNameMap: new Map(),
  markersCluster: null,
  isMapMoving: false,
  visibleRanges: new Set(),  
};

// INITIALIZATION
function initState() {
  state.geoLayer = null;
  state.previousCountry = undefined;
  state.currentMetric = 'maxSubscribers';
  state.globalStatsCountry = null;
  state.currentMaxValue = 0;
  state.currentMinValue = 0;
  state.legendControl = null;
  state.countryNameMap = new Map();
  state.markersCluster = null;
  state.worldStats = null;
  state.isMapMoving = false;
  state.visibleRanges = new Set(COLOR_THRESHOLDS.map((_, i) => i));

  const metricSelector = document.getElementById("metric-selector");
  metricSelector?.classList.remove("hidden");
  const country_selector = document.getElementById("country-selector");
  country_selector?.classList.add("hidden");
}

// DATA FETCHING
async function getStatsCountry() {
  const data =  pipeline
    .groupBy('groupby_country', 'country')
    .aggregate("channels_data", channels => ({
      channelCount: channels.length,
      avgSubscribers: d3.mean(channels, d => +d.subscriber_count),
      totalSubscribers: d3.sum(channels, d => +d.subscriber_count),
      maxSubscribers: d3.max(channels, d => +d.subscriber_count),
      avgVideos: d3.mean(channels, d => +d.video_count),
      totalVideos: d3.sum(channels, d => +d.video_count),
    }), true)
    .run(["convert_map"]);
  pipeline.removeOperation('groupby_country');
  pipeline.removeOperation("channels_data");
  return data
}

async function getStatsWorld() {
  const res =  pipeline.addOperation("calculateStats", data => ({
    totalChannels: data.length,
    avgSubscribers: d3.mean(data, d => +d.subscriber_count),
    totalSubscribers: d3.sum(data, d => +d.subscriber_count),
    avgVideos: d3.mean(data, d => +d.video_count),
    totalVideos: d3.sum(data, d => +d.video_count),
    countries: new Set(data.map(d => d.country)).size
  })).run(["convert_map"]);
  pipeline.removeOperation("calculateStats");
  return res
}

// METRICS UTILITIES
function getMetricValue(stats, metric) {
  if (!stats) return 0;
  
  const metrics = {
    avgSubscribers: () => stats.avgSubscribers || 0,
    totalSubscribers: () => (stats.channelCount * stats.avgSubscribers) || 0,
    avgVideos: () => stats.avgVideos || 0,
    maxSubscribers: () => stats.maxSubscribers || 0,
    totalVideos: () => (stats.channelCount * stats.avgVideos) || 0,
    channelCount: () => stats.channelCount || 0
  };
  
  return metrics[metric] ? metrics[metric]() : 0;
}

function getMetricLabel(metric) {
  return METRIC_LABELS[metric] || metric;
}

function calculateMinMaxValues(statsCountry, metric) {
  let max = 0;
  let min = Infinity;
  
  statsCountry.forEach(stats => {
    const value = getMetricValue(stats, metric);
    if (stats && stats.channelCount > 0) { 
      if (value > max) max = value;
      if (value < min) min = value;
    }
  });
  
  return { min: min === Infinity ? 0 : min, max };
}

function filterMapFields(map, ...fields) {
  return new Map(
    Array.from(map, ([key, value]) => [
      key,
      fields.reduce((obj, field) => {
        obj[field] = value[field];
        return obj;
      }, {})
    ])
  );
}

// COLOR SCALE
function getColorScale(value, min, max) {
  if (value === 0 || max === 0) return COLOR_SCALE[0];
  
  const percentage = (value - min) / (max - min);
  
  for (let i = 0; i < COLOR_THRESHOLDS.length - 1; i++) {
    if (percentage >= COLOR_THRESHOLDS[i] && percentage < COLOR_THRESHOLDS[i + 1]) {
      return COLOR_SCALE[i];
    }
  }
  
  return COLOR_SCALE[COLOR_SCALE.length - 1];
}

// TOOLTIPS
function createCountryTooltips(statsCountry, feature) {
  const countryCode = feature.properties['ISO3166-1-Alpha-2'];
  const stats = statsCountry.get(countryCode);
  const countryName = feature.properties.name === "unknown" 
    ? "Non définis" 
    : feature.properties.name;
  
  const format = d3.format(".2s");
  const getValue = (field) => stats ? format(stats[field]) : 0;
  
  return `
    <b>${countryName}</b>
    <br>📊 Nombre total chaînes : ${getValue('channelCount')}
    <br>👥 Abonnés moyens par chaîne : ${getValue('avgSubscribers')}
    <br>👥 Nombre total d'abonnés : ${getValue('totalSubscribers')}
    <br>⭐ Plus grosse chaîne : ${getValue('maxSubscribers')} abonnés
    <br>🎥 Vidéos moyennes par chaîne : ${getValue('avgVideos')}
    <br>🎥 Nombre total de vidéos : ${getValue('totalVideos')}
  `;
}

function createWorldTooltips(statsWorld) {
  const format = d3.format(".2s");
  
  return `
    <b>Statistiques Mondiales</b>
    <br>📊 Nombre total chaînes : ${format(statsWorld.totalChannels)}
    <br>👥 Abonnés moyens par chaîne : ${format(Math.round(statsWorld.avgSubscribers))}
    <br>👥 Nombre total d'abonnés : ${format(Math.round(statsWorld.totalSubscribers))}
    <br>🎥 Vidéos moyennes par chaîne : ${format(Math.round(statsWorld.avgVideos))}
    <br>🎥 Nombre total de vidéos : ${format(Math.round(statsWorld.totalVideos))}
    <br>🌎 Nombre de pays avec des chaînes Youtube : ${format(statsWorld.countries)}
  `;
}

function createGraphTooltips(channel) {
  const createdDate = new Date(channel.created_date);
  const dateFormatee = createdDate.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const format = d3.format(".2s");
  
  return `
    <b>${channel.channel_name}</b>
    <br>👥 Abonnés : ${format(channel.subscriber_count)}
    <br>🎥 Vidéos : ${format(channel.video_count)}
    <br>📅 Créée le : ${dateFormatee}
    <br>📂 Catégories : ${channel.category || 'Non spécifiée'}
    <br>🌍 Pays : ${state.countryNameMap.get(channel.country) || 'Non spécifié'}
  `;
}

// MARKERS
function initializeMarkers(channelsData) {
  state.markersCluster = L.layerGroup();
  const allData = pipeline.convertMap("convert_map", "channel_id").run(["countryFilter"]);
  pipeline.removeOperation("convert_map")
  channelsData.forEach(channel => {
    if (!channel.latitude || !channel.longitude) return;
    
    const lat = parseFloat(channel.latitude);
    const lon = parseFloat(channel.longitude);
    
    if (isNaN(lat) || isNaN(lon)) return;
    
    const marker = L.circleMarker([lat, lon], {
      radius: 6,
      fillColor: "#ff0000",
      color: "#fff",
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8
    });

    marker.bindTooltip(
      createGraphTooltips(allData.get(channel.channel_id)), 
      { permanent: false, sticky: true, direction: "auto",interactive: false }
    );

    marker.off('mouseover');
    marker.off('mouseout');

    marker.on('mouseover', function(e) {
      if (!state.isMapMoving) {
        this.openTooltip();
      }
    });
    
    marker.on('mouseout', function(e) {
      this.closeTooltip();
    });
    
    marker.addTo(state.markersCluster);
  });
  
  updateMarkersVisibility();
  state.map.on('zoomend', updateMarkersVisibility);
}

function updateMarkersVisibility() {
  const currentZoom = state.map.getZoom();
  const shouldShow = currentZoom >= ZOOM_THRESHOLD;
  
  if (shouldShow && !state.map.hasLayer(state.markersCluster)) {
    state.map.addLayer(state.markersCluster);
  } else if (!shouldShow && state.map.hasLayer(state.markersCluster)) {
    state.map.removeLayer(state.markersCluster);
  }
}

// SVG PATTERN
function createDiagonalHatchPattern() {
  state.map.whenReady(() => {
    const mapSvg = document.querySelector('#svg svg');
    if (!mapSvg) return;
    
    let defs = mapSvg.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      mapSvg.insertBefore(defs, mapSvg.firstChild);
    }
    
    const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
    pattern.setAttribute('id', 'diagonalHatch');
    pattern.setAttribute('patternUnits', 'userSpaceOnUse');
    pattern.setAttribute('width', '8');
    pattern.setAttribute('height', '8');
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4');
    path.setAttribute('stroke', '#666');
    path.setAttribute('stroke-width', '1.5');
    
    pattern.appendChild(path);
    defs.appendChild(pattern);
  });
}

// GEOJSON LAYER
function getCountryStyle(feature) {
  const countryCode = feature.properties["ISO3166-1-Alpha-2"];
  const stats = state.globalStatsCountry.get(countryCode);
  const value = getMetricValue(stats, state.currentMetric);
  
  if (!stats || stats.channelCount === 0) {
    return {
      color: "#333333",
      weight: 1,
      fillColor: "#f0f0f0",
      fillOpacity: 1,
      className: 'country-no-data'
    };
  }
  
  return {
    color: "#333333",
    weight: 1,
    fillColor: getColorScale(value, state.currentMinValue, state.currentMaxValue),
    fillOpacity: 0.7
  };
}

function onEachFeature(feature, layer) {
  if (!feature.properties?.name) return;
  
  layer.bindTooltip(
    createCountryTooltips(state.globalStatsCountry, feature),
    { permanent: false, sticky: true, direction: "auto", interactive: false }
  );

  layer.off('mouseover');
  layer.off('mouseout');

  layer.on('mouseover', function(e) {
    if (!state.isMapMoving) {
      this.openTooltip();
    }
  });
  
  layer.on('mouseout', function(e) {
    this.closeTooltip();
  });
  
  layer.on('click', () => {
    const countryCode = feature.properties["ISO3166-1-Alpha-2"];
    const countryName = feature.properties.name;
    showCountryPanel(countryCode, countryName);
  });
}

function applyHatchPattern() {
  state.geoLayer.eachLayer(layer => {
    const countryCode = layer.feature.properties["ISO3166-1-Alpha-2"];
    const stats = state.globalStatsCountry.get(countryCode);
    
    if (!stats || stats.channelCount === 0) {
      const path = layer.getElement();
      if (path) path.style.fill = 'url(#diagonalHatch)';
    }
  });
}

async function loadGeoJSON() {
  const response = await fetch("./Map/countries.geojson");
  const data = await response.json();
  
  data.features.forEach(feature => {
    const code = feature.properties["ISO3166-1-Alpha-2"];
    const name = feature.properties.name;
    if (code && name) {
      state.countryNameMap.set(code, name);
    }
  });
  
  state.geoLayer = L.geoJSON(data, {
    style: getCountryStyle,
    onEachFeature: onEachFeature
  }).addTo(state.map);
  
  applyHatchPattern();
  addLegend(state.currentMinValue, state.currentMaxValue, state.currentMetric);
  
  document.getElementById('metric-choice')?.addEventListener('change', (e) => {
    updateMapColors(e.target.value);
  });
}

// LEGEND
function addLegend(minValue, maxValue, metric) {
  if (state.legendControl) {
    state.map.removeControl(state.legendControl);
  }
  
  state.legendControl = L.control({ position: 'bottomright' });
  
  state.legendControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'info legend clickable-legend');
    const format = d3.format(".2s");
    
    div.innerHTML = `<h4>${getMetricLabel(metric)}</h4>`;
    div.innerHTML += `
      <div class="" data-range="no-data" style="cursor: pointer; opacity: '1'};">
        <i style="background: repeating-linear-gradient(-45deg, #f0f0f0, #f0f0f0 3px, #999 3px, #999 4px); width: 18px; height: 18px; display: inline-block; margin-right: 5px; border: 1px solid #999;"></i>
        Pas de données
      </div>
    `;
    
    const range = maxValue - minValue;
    
    for (let i = 0; i < COLOR_THRESHOLDS.length - 1; i++) {
      const minVal = minValue + (COLOR_THRESHOLDS[i] * range);
      const maxVal = minValue + (COLOR_THRESHOLDS[i + 1] * range);
      const isVisible = state.visibleRanges.has(i);
      
      div.innerHTML += `
        <div class="legend-item" data-range="${i}" style="cursor: pointer; opacity: ${isVisible ? '1' : '0.3'};">
          <i style="background:${getColorScale(minVal + 1, minValue, maxValue)}; width: 18px; height: 18px; display: inline-block; margin-right: 5px; border: 1px solid #999;"></i>
          ${format(minVal)} – ${format(maxVal)}
        </div>
      `;
    }

    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    div.style.pointerEvents = 'auto';
    L.DomEvent.on(div, 'mouseenter', L.DomEvent.stopPropagation);
    L.DomEvent.on(div, 'mousemove', L.DomEvent.stopPropagation);

    L.DomEvent.on(div, 'mouseover', e => {
      L.DomEvent.stopPropagation(e);

      // 🔥 Ferme toutes les tooltips actives
      state.geoLayer.eachLayer(layer => {
        if (layer.closeTooltip) {
          layer.closeTooltip();
        }
      });
    });
    
    setTimeout(() => {
      div.querySelectorAll('.legend-item').forEach(item => {
        item.addEventListener('click', function() {
          const rangeValue = this.dataset.range;
          const rangeIndex = parseInt(rangeValue);
          
          if (state.visibleRanges.has(rangeIndex)) {
            state.visibleRanges.delete(rangeIndex);
            this.style.opacity = '0.3';
          } else {
            state.visibleRanges.add(rangeIndex);
            this.style.opacity = '1';
          }
          
          updateMapVisibility(minValue, maxValue, metric);
        });
      });
    }, 100);
    
    return div;
  };
  
  state.legendControl.addTo(state.map);
}

function updateMapVisibility(minValue, maxValue, metric) {
  const range = maxValue - minValue;
  
  state.geoLayer.eachLayer(layer => {
    const countryCode = layer.feature.properties["ISO3166-1-Alpha-2"];
    const stats = state.globalStatsCountry.get(countryCode);
    const value = getMetricValue(stats, metric);
    const path = layer.getElement();
    
    if (!stats || stats.channelCount === 0) {
      layer.setStyle({ fillColor: "#f0f0f0", fillOpacity: 1 });
      if (path) path.style.fill = 'url(#diagonalHatch)';
      return;
    }
    
    const percentage = (value - minValue) / range;
    let rangeIndex = -1;
    for (let i = 0; i < COLOR_THRESHOLDS.length - 1; i++) {
      if (percentage >= COLOR_THRESHOLDS[i] && percentage <= COLOR_THRESHOLDS[i + 1]) {
        rangeIndex = i;
        break;
      }
    }
    
    if (state.visibleRanges.has(rangeIndex)) {
      layer.setStyle({
        fillColor: getColorScale(value, minValue, maxValue),
        fillOpacity: 0.7
      });
      if (path) path.style.fill = '';
    } else {
      layer.setStyle({ 
        fillColor: "#f0f0f0", 
        fillOpacity: 1 
      });
      if (path) path.style.fill = 'url(#diagonalHatch)';
    }
  });
}

function updateMapColors(metric) {
  state.currentMetric = metric;
  const { min, max } = calculateMinMaxValues(state.globalStatsCountry, metric); 
  state.currentMinValue = min;
  state.currentMaxValue = max;
  
  state.geoLayer.eachLayer(layer => {
    const countryCode = layer.feature.properties["ISO3166-1-Alpha-2"];
    const stats = state.globalStatsCountry.get(countryCode);
    const value = getMetricValue(stats, metric);
    const path = layer.getElement();
    
    if (!stats || stats.channelCount === 0) {
      layer.setStyle({ fillColor: "#f0f0f0", fillOpacity: 1 });
      if (path) path.style.fill = 'url(#diagonalHatch)';
    } else {
      layer.setStyle({
        fillColor: getColorScale(value, state.currentMinValue, state.currentMaxValue),
        fillOpacity: 0.7
      });
      if (path) path.style.fill = '';
    }
  });
  
  addLegend(state.currentMinValue, state.currentMaxValue, metric);
}

// MAP TOOLTIPS
function setupMapTooltips() {
  const mapTooltip = L.tooltip({
    permanent: false,
    direction: 'auto',
    offset: [0, -10]
  });
  
  getStatsWorld().then(data => {
    state.worldStats = data;
    mapTooltip.setContent(createWorldTooltips(data));
  });
  
  state.map.on('mousemove', (e) => {
    if (state.isMapMoving) {
      state.map.removeLayer(mapTooltip); 
      return;
    }

    if (!e.originalEvent.target.closest('.leaflet-interactive')) {
      if (state.worldStats) {
        mapTooltip.setContent(createWorldTooltips(state.worldStats));
      }
      mapTooltip.setLatLng(e.latlng).addTo(state.map);
    } else {
      state.map.removeLayer(mapTooltip);
    }
  });
  
  state.map.on('mouseout', () => {
    state.map.removeLayer(mapTooltip);
  });
  
  state.map.on('click', (e) => {
    if (!e.originalEvent.target.closest('.leaflet-interactive')) {
      showCountryPanel("", "World");
    }
  });
}

// MAP CREATION
async function createMap() {
  state.globalStatsCountry = await getStatsCountry();
  state.currentMetric = document.getElementById("metric-choice")?.value || 'maxSubscribers';
  const { min, max } = calculateMinMaxValues(state.globalStatsCountry, state.currentMetric);
  state.currentMinValue = min;
  state.currentMaxValue = max
  
  createDiagonalHatchPattern();
  await loadGeoJSON();
  setupMapTooltips();
}

// SIDE PANEL
function showCountryPanel(countryCode, countryName) {
  const panel = document.getElementById("side-panel");
  
  if (state.previousCountry === countryCode && !panel.classList.contains("hidden")) {
    panel.classList.add("hidden");
    pipeline.removeOperation("countryFilter");
    return;
  }
  
  state.previousCountry = countryCode;
  
  const title = document.getElementById("panel-title");
  const content = document.getElementById("panel-content");
  
  const displayName = countryName === "unknown" ? "Non définis" : countryName;
  title.textContent = `Classement des chaînes — ${displayName}`;
  content.innerText = "Chargement...";
  
  panel.classList.remove("hidden");
  
  setTimeout(() => {
    pipeline.removeOperation("convert_map");
    
    if (countryName !== "World") {
      pipeline.filter("countryFilter", d => d.country === countryCode);
    }

    else{
          pipeline.removeOperation("countryFilter");
    }
    
    const topChannels = pipeline.sortBy("sortby", "subscriber_count", false).run();
    
    if (topChannels.length === 0) {
      content.innerText = "Aucune chaîne disponible pour ce pays.";
      return;
    }
    
    content.innerText = "";
    drawBarChart(topChannels);
    pipeline.removeOperation("countryFilter");
  }, 0);
}

// BAR CHART
function drawBarChart(data) {
  const scrollContainer = document.getElementById("panel-content");
  const computedStyle = window.getComputedStyle(scrollContainer);
  const fontSize = parseFloat(computedStyle.fontSize);
  
  const leftMargin = 5 * fontSize;
  const rightMargin = 4 * fontSize;
  const width = scrollContainer.clientWidth;
  const height = data.length * 25;
  
  const tooltip = d3.select("body")
    .append("div")
    .attr("id", "map-tooltip");
  
  const x = d3.scaleLinear()
    .domain([0, d3.max(data, d => +d.subscriber_count)])
    .range([leftMargin, width - rightMargin]);
  
  const y = d3.scaleBand()
    .domain(data.map(d => d.channel_name))
    .range([0, height])
    .padding(0.1);
  
  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("style", "font: 12px sans-serif;");
  
  const channelGroups = svg.selectAll("g.channel-group")
    .data(data)
    .join("g")
    .attr("class", "channel-group")
    .on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible").html(createGraphTooltips(d));
    })
    .on("mousemove", (event) => {
      tooltip
        .style("top", (event.pageY + 10) + "px")
        .style("left", (event.pageX + 10) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("visibility", "hidden");
    });
  
  channelGroups.append("rect")
    .attr("x", leftMargin)
    .attr("y", d => y(d.channel_name))
    .attr("width", d => x(+d.subscriber_count) - leftMargin)
    .attr("height", y.bandwidth())
    .attr("fill", "#3182bd");
  
  channelGroups.append("text")
    .attr("class", "channel-name")
    .attr("y", d => y(d.channel_name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(d => d.channel_name.length > 7 
      ? d.channel_name.substring(0, 7) + "..." 
      : d.channel_name);
  
  channelGroups.append("text")
    .attr("class", "channel-value")
    .attr("x", d => x(+d.subscriber_count) + 5)
    .attr("y", d => y(d.channel_name) + y.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "start")
    .text(d => d3.format(".2s")(d.subscriber_count))
    .style("fill", "#333");
  
  scrollContainer.appendChild(svg.node());
}

// MAP UPDATE
async function updateMap() {
  if (!state.map) {
    renderMap();
    return;
  }

  state.globalStatsCountry = await getStatsCountry();
  state.currentMetric = document.getElementById("metric-choice")?.value || 'avgSubscribers';
  const { min, max } = calculateMinMaxValues(state.globalStatsCountry, state.currentMetric);
  state.currentMinValue = min;
  state.currentMaxValue = max;

  if (state.geoLayer) {
    state.geoLayer.eachLayer(layer => {
      const countryCode = layer.feature.properties["ISO3166-1-Alpha-2"];
      const stats = state.globalStatsCountry.get(countryCode);
      const value = getMetricValue(stats, state.currentMetric);
      const path = layer.getElement();

      if (!stats || stats.channelCount === 0) {
        layer.setStyle({ 
          fillColor: "#f0f0f0", 
          fillOpacity: 1 
        });
        if (path) path.style.fill = 'url(#diagonalHatch)';
      } else {
        layer.setStyle({
          fillColor: getColorScale(value, state.currentMinValue, state.currentMaxValue),
          fillOpacity: 0.7
        });
        if (path) path.style.fill = '';
      }

      layer.unbindTooltip();
      layer.bindTooltip(
        createCountryTooltips(state.globalStatsCountry, layer.feature),
        { permanent: false, sticky: true, direction: "auto" }
      );
    });
  }
  
  addLegend(state.currentMinValue, state.currentMaxValue, state.currentMetric);

  if (state.markersCluster) {
    state.map.removeLayer(state.markersCluster);
    state.markersCluster.clearLayers();
  }

  const allData = pipeline.convertMap("convert_map", "channel_id").run(["countryFilter"]);
  pipeline.removeOperation("convert_map")
  
  d3.csv("./Map/channels_with_coordinates.csv").then(channelsData => {
    state.markersCluster = L.layerGroup();
    
    channelsData.forEach(channel => {
      if (!allData.has(channel.channel_id)) return;
      
      if (!channel.latitude || !channel.longitude) return;
      
      const lat = parseFloat(channel.latitude);
      const lon = parseFloat(channel.longitude);
      
      if (isNaN(lat) || isNaN(lon)) return;
      
      const marker = L.circleMarker([lat, lon], {
        radius: 6,
        fillColor: "#ff0000",
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      });
      
      marker.bindTooltip(
        createGraphTooltips(allData.get(channel.channel_id)), 
        { permanent: false, sticky: true, direction: "auto" }
      );
      
      marker.addTo(state.markersCluster);
    });
    
    updateMarkersVisibility();
  });

  getStatsWorld().then(statsWorld => {
    state.worldStats = statsWorld;
  });

  const panel = document.getElementById("side-panel");
  if (!panel.classList.contains("hidden") && state.previousCountry) {
    const countryName = state.countryNameMap.get(state.previousCountry) || "Unknown";
    showCountryPanel(state.previousCountry, countryName);
  }

  state.map.invalidateSize();
}

// PUBLIC API
function renderMap() {
  if (state.map){
    updateMap().then()
    return
  }

  const container = document.getElementById('svg');
  container.innerHTML = '';
  
  initState();
  
  state.map = L.map('svg', {
    maxBounds: [[-90, -250], [90, 250]],
    maxBoundsViscosity: 1.0,
    worldCopyJump: true,
    minZoom: 1,
    inertia: false
  }).setView([20, 0], 2);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(state.map);
  
  state.map.on('movestart dragstart zoomstart', () => {
    state.isMapMoving = true;
    state.map.eachLayer(layer => {
      if (layer.closeTooltip) {
        layer.closeTooltip();
      }
    });
  });

  state.map.on('moveend dragend zoomend', () => {
    setTimeout(() => {
      state.isMapMoving = false;
    }, 150);
  });

  state.map.on('zoomstart', () => {
    state.isMapMoving = true;
    state.map.eachLayer(layer => {
      if (layer.getTooltip && layer.getTooltip()) {
        layer.closeTooltip();
      }
    });
  });

  state.map.on('zoomend', () => {
    setTimeout(() => {
      state.isMapMoving = false;
    }, 100);
  });

  pipeline.load("../data/youtube.csv", "csv").then(() => {
    pipeline.run();
    
    createMap().then(() => {
      d3.csv("./Map/channels_with_coordinates.csv").then(data => {
        initializeMarkers(data);
      });
    });
  });
}

function clearMap() {
  const metricSelector = document.getElementById("metric-selector");
  const sidePanel = document.getElementById("side-panel");
  const country_selector = document.getElementById("country-selector");
  
  metricSelector?.classList.add("hidden");
  sidePanel?.classList.add("hidden");
  country_selector?.classList.remove("hidden");
  
  if (state.map) {
    state.map.remove();
    state.map = null;
  }

  pipeline.removeOperation("convert_map");
}

function getGlobalStatsCountry(columns){
  let data;
  if(columns)
    data = filterMapFields(state.globalStatsCountry,columns)
  else
    data =  state.globalStatsCountry;
  return Array.from(data, ([key, value]) => ({
    country: key,
    ...value
  }));
}

export { renderMap, clearMap, getGlobalStatsCountry };