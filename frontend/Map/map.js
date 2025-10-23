import pipeline from "../index.js";

let geoLayer;
let previousCountry;
let imageLoadTimeouts;
let currentMetric;
let globalStatsCountry;
let currentMaxValue;
let legendControl;
let countryNameMap;
let markersCluster;
const ZOOM_THRESHOLD = 5;
let map; 

function init(){
  geoLayer=null;
  previousCountry = undefined;
  imageLoadTimeouts = [];

  currentMetric = 'avgSubscribers';
  globalStatsCountry=null;
  currentMaxValue = 0;
  legendControl=null;
  countryNameMap = new Map();

  markersCluster=null;
  const ZOOM_THRESHOLD = 5; 


  let metricSelector = document.getElementById("metric-selector");
  metricSelector.classList.remove("hidden")
}

function renderMap(){
  const container = document.getElementById('svg');
  container.innerHTML = '';

  init()  

  map = L.map('svg', {
    maxBounds: [[-90, -250], [90, 250]],
    maxBoundsViscosity: 1.0,
    worldCopyJump: true,
    minZoom: 1
  }).setView([20, 0], 2); // [lat, lon], zoom

  // Ajouter un fond de carte OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  pipeline.load("../data/youtube.csv","csv").then(_ =>{
    let data = pipeline.run()

    createMap();

    d3.csv("./Map/channels_with_coordinates.csv").then(data => {
      initializeMarkers(data);
    })
  })
}

function getMetricValue(stats, metric) {
  if (!stats) return 0;
  
  switch(metric) {
    case 'avgSubscribers':
      return stats.avgSubscribers || 0;
    case 'totalSubscribers':
      return stats.channelCount * stats.avgSubscribers || 0;
    case 'avgVideos':
      return stats.avgVideos || 0;
    case 'totalVideos':
      return stats.channelCount * stats.avgVideos || 0;
    case 'channelCount':
      return stats.channelCount || 0;
    default:
      return 0;
  }
}

function getMetricLabel(metric) {
  const labels = {
    'avgSubscribers': 'Abonnés moyens par chaînes',
    'totalSubscribers': 'Total d\'abonnés',
    'avgVideos': 'Vidéos moyennes par chaînes',
    'totalVideos': 'Total de vidéos',
    'channelCount': 'Nombre de chaînes'
  };
  return labels[metric] || metric;
}

function calculateMaxValue(globalStatsCountry, metric) {
  let max = 0;
  globalStatsCountry.forEach(stats => {
    const value = getMetricValue(stats, metric);
    if (value > max) max = value;
  });
  return max;
}

function getStatsCountry(){
     return pipeline
    .groupBy('country')
    .aggregate(channels => ({
      channelCount: channels.length,
      avgSubscribers: d3.mean(channels, d => +d.subscriber_count),
      totalSubscribers: d3.sum(channels, d => +d.subscriber_count),
      avgVideos: d3.mean(channels, d => +d.video_count),
      totalVideos: d3.sum(channels, d => +d.video_count),
    }), true)
    .run();
}

function initializeMarkers(data) {
  markersCluster = L.layerGroup();
  pipeline.resetPipeline();
  let allData = pipeline.convertMap("channel_id").run();
  
  data.forEach(channel => {
    if (channel.latitude && channel.longitude) {
      const lat = parseFloat(channel.latitude);
      const lon = parseFloat(channel.longitude);
      
      // Vérifier que les coordonnées sont valides
      if (!isNaN(lat) && !isNaN(lon)) {
        const marker = L.circleMarker([lat, lon], {
          radius: 6,
          fillColor: "#ff0000",
          color: "#fff",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });
        marker.bindTooltip(createGraphTooltips(allData.get(channel.channel_id)), {
            permanent: false, 
            sticky: true,    
            direction: "auto"
        });

        marker.addTo(markersCluster);
      }
    }
  });
  updateMarkersVisibility()
  map.on('zoomend', updateMarkersVisibility);
}

function updateMarkersVisibility() {
  const currentZoom = map.getZoom();
  if (currentZoom >= ZOOM_THRESHOLD) {
    // Afficher les marqueurs
    if (!map.hasLayer(markersCluster)) {
      map.addLayer(markersCluster);
    }
  } else {
    // Cacher les marqueurs
    if (map.hasLayer(markersCluster)) {
      map.removeLayer(markersCluster);
    }
  }
}

function getStatsWorld(){
    const savedOps = pipeline.getPipeline();
    
    const result = pipeline
        .resetPipeline()
        .groupBy()
        .aggregate(channels => ({
            totalChannels: channels.length,
            avgSubscribers: d3.mean(channels, d => +d.subscriber_count),
            totalSubscribers: d3.sum(channels, d => +d.subscriber_count),
            avgVideos: d3.mean(channels, d => +d.video_count),
            totalVideos: d3.sum(channels, d => +d.video_count),
            countries: new Set(channels.map(d => d.country)).size
        }), true)
        .run()
    
    pipeline.setPipeline(savedOps);
    
    return result;
}

function createCountryTooltips(globalStatsCountry,feature){
  let tooltipContent = "";
  if(feature.properties.name === "unknown")
    tooltipContent += `<b>Non définis</b>`;
  else 
    tooltipContent += `<b>${feature.properties.name}</b>`;
  tooltipContent += `
      <br>📊 Nombre total chaînes : ${globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']) ? d3.format(".2s")(globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']).channelCount) : 0}
      <br>👥 Abonnés moyens par chaîne : ${globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']) ? d3.format(".2s")(globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']).avgSubscribers) : 0}
      <br>👥 Nombre total d'abonnés : ${globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']) ? d3.format(".2s")(globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']).totalSubscribers) : 0}    
      <br>🎥 Vidéos moyennes par chaîne : ${globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']) ? d3.format(".2s")(globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']).avgVideos) : 0}
      <br>🎥 Nombre total de vidéos :  ${globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']) ? d3.format(".2s")(globalStatsCountry.get(feature.properties['ISO3166-1-Alpha-2']).totalVideos) : 0}
      `;
  return tooltipContent
}

function createWorldTooltips(globalStatsWorld){
  let tooltipContent = `<b>Statistiques Mondiales</b>`;
  tooltipContent += `
      <br>📊 Nombre total chaînes : ${d3.format(".2s")(globalStatsWorld.totalChannels)}
      <br>👥 Abonnés moyens par chaîne : ${d3.format(".2s")(Math.round(globalStatsWorld.avgSubscribers))}
      <br>👥 Nombre total d'abonnés : ${d3.format(".2s")(Math.round(globalStatsWorld.totalSubscribers))}
      <br>🎥 Vidéos moyennes par chaîne : ${d3.format(".2s")(Math.round(globalStatsWorld.avgVideos))}
      <br>🎥 Nombre total de vidéos : ${d3.format(".2s")(Math.round(globalStatsWorld.totalVideos))}
      <br>🌎 Nombre de pays avec des chaînes Youtube : ${d3.format(".2s")(globalStatsWorld.countries)}
  `;
  return tooltipContent;
}

function createGraphTooltips(d){
    const createdDate = new Date(d.created_date);
    const dateFormatee = createdDate.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  let tooltipContent= `<b>${d.channel_name}</b>`;
  tooltipContent += `
        <br>👥 Abonnés : ${d3.format(".2s")(d.subscriber_count)}
        <br>🎥 Vidéos : ${d3.format(".2s")(d.video_count)}
        <br>📅 Créée le : ${dateFormatee}
        <br>📂 Catégories : ${d.category || 'Non spécifiée'}
        <br>🌍 Pays : ${countryNameMap.get(d.country) || 'Non spécifié'}
      `;
  return tooltipContent;
}

function getColorScale(value, max) {
  // Échelle de couleurs
  const colors = [
    '#ffffff', // 0-2%
    '#fee5d9', // 2-5%
    '#fcbba1', // 5-9%
    '#fc9272', // 9-15%
    '#fb6a4a', // 15-25%
    '#ef3b2c', // 25-40%
    '#cb181d', // 40-60%
    '#a50f15', // 60-80%
    '#67000d'  // 80-100%
  ];
  
  // Seuils personnalisés (en pourcentage)
  const thresholds = [0, 0.02, 0.05, 0.09, 0.15, 0.25, 0.40, 0.60, 0.80, 1.0];
  
  if (value === 0 || max === 0) return colors[0];
  
  const percentage = value / max;
  
  // Trouver l'index de couleur approprié
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (percentage >= thresholds[i] && percentage < thresholds[i + 1]) {
      return colors[i];
    }
  }
  
  return colors[colors.length - 1]; // Pour 100%
}

function createMap(){
    globalStatsCountry = getStatsCountry();
    currentMetric = document.getElementById("metric-choice").value
    currentMaxValue = calculateMaxValue(globalStatsCountry, currentMetric);

    // Attendre que le SVG de Leaflet soit prêt
    map.whenReady(function() {
      // Trouver le SVG de Leaflet
      const mapSvg = document.querySelector('#svg svg');
      if (mapSvg) {
        // Créer un élément defs s'il n'existe pas
        let defs = mapSvg.querySelector('defs');
        if (!defs) {
          defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
          mapSvg.insertBefore(defs, mapSvg.firstChild);
        }
        
        // Créer le pattern
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
      }
    });
    
    // Charger et afficher ton GeoJSON
    fetch("./Map/countries.geojson")
        .then(response => response.json())
        .then(data => {

        data.features.forEach(feature => {
            const code = feature.properties["ISO3166-1-Alpha-2"];
            const name = feature.properties.name;
            if (code && name) {
                countryNameMap.set(code, name);
            }
        });
        
        geoLayer = L.geoJSON(data, {
            style: function(feature) {
              const countryCode = feature.properties["ISO3166-1-Alpha-2"];
              const stats = globalStatsCountry.get(countryCode);
              const value = getMetricValue(stats, currentMetric);

              console.log(stats)
              if (!stats || stats.channelCount === 0) {
                return {
                  color: "#333333",
                  weight: 1,
                  fillColor: "#f0f0f0",
                  fillOpacity: 1,
                  className: 'country-no-data' // Pour appliquer le pattern après
                };
              }
              
              return {
                color: "#333333",
                weight: 1,
                fillColor: getColorScale(value, currentMaxValue),
                fillOpacity: 0.7
              };
            },
            onEachFeature: function (feature, layer) {
              if (feature.properties && feature.properties.name) {

                layer.bindTooltip(createCountryTooltips(globalStatsCountry,feature), {
                    permanent: false, 
                    sticky: true,    
                    direction: "auto"
                });

                layer.on('click', function () {
                  const countryCode = feature.properties["ISO3166-1-Alpha-2"];
                  const countryName = feature.properties.name;
                  showCountryPanel(countryCode, countryName);
                });
              } 
            }
        }).addTo(map);

        geoLayer.eachLayer(function(layer) {
          const countryCode = layer.feature.properties["ISO3166-1-Alpha-2"];
          const stats = globalStatsCountry.get(countryCode);
          
          if (!stats || stats.channelCount === 0) {
            const path = layer.getElement();
            if (path) {
              path.style.fill = 'url(#diagonalHatch)';
            }
          }
        });
        
        addLegend(currentMaxValue, currentMetric);
        document.getElementById('metric-choice').addEventListener('change', function(e) {
          updateMapColors(e.target.value);
        });
    });

    // Tooltip pour la carte (en dehors des features)
    let mapTooltip = L.tooltip({
                permanent: false,
                direction: 'auto',
                offset: [0, -10]
            });
    
    mapTooltip.setContent(createWorldTooltips(getStatsWorld().get()))
    
    map.on('mousemove', function(e) {
        if (!e.originalEvent.target.closest('.leaflet-interactive')) {
            mapTooltip
                .setLatLng(e.latlng)
                .addTo(map);
        } else {
            map.removeLayer(mapTooltip);
        }
    });
    
    map.on('mouseout', function() {
        map.removeLayer(mapTooltip);
    });
    
    // Gestionnaire de clic sur la carte
    map.on('click', function(e) {
      if (!e.originalEvent.target.closest('.leaflet-interactive')) {
        const countryCode = "";
        const countryName = "World";
        showCountryPanel(countryCode, countryName);
      }
    });
}

function addLegend(maxValue, metric) {
  if (legendControl) {
    map.removeControl(legendControl);
  }
  
  legendControl = L.control({ position: 'bottomright' });
  
  legendControl.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'info legend');
    
    const thresholds = [0, 0.02, 0.05, 0.09, 0.15, 0.25, 0.40, 0.60, 0.80];
    const labels = ['0–2%', '2–5%', '5–9%', '9–15%', '15–25%', '25–40%', '40–60%', '60–80%', '80–100%'];
    
    div.innerHTML = '<h4>' + getMetricLabel(metric) + '</h4>';

    div.innerHTML += '<i style="background: repeating-linear-gradient(-45deg, #f0f0f0, #f0f0f0 3px, #999 3px, #999 4px); width: 18px; height: 18px; display: inline-block; margin-right: 5px; border: 1px solid #999;"></i> ' + 'Pas de données<br>';
    
    for (let i = 0; i < thresholds.length; i++) {
      const value = thresholds[i] * maxValue;
      div.innerHTML +=
        '<i style="background:' + getColorScale(value + 1, maxValue) + '; width: 18px; height: 18px; display: inline-block; margin-right: 5px; border: 1px solid #999;"></i> ' +
        d3.format(".2s")(thresholds[i] * maxValue === 0 ? 1.0 : thresholds[i] * maxValue) + ' – ' + 
        (i < thresholds.length - 1 ? d3.format(".2s")(thresholds[i + 1] * maxValue) : d3.format(".2s")(maxValue)) +
        ' <span style="color: #666;">(' + labels[i] + ')</span><br>';
    }
    
    return div;
  };
  
  legendControl.addTo(map);
}

function updateMapColors(metric) {
  currentMetric = metric;
  currentMaxValue = calculateMaxValue(globalStatsCountry, metric);
  
  geoLayer.eachLayer(function(layer) {
    const countryCode = layer.feature.properties["ISO3166-1-Alpha-2"];
    const stats = globalStatsCountry.get(countryCode);
    const value = getMetricValue(stats, metric);
    
    if (!stats || stats.channelCount === 0) {
          layer.setStyle({
            fillColor: "#f0f0f0",
            fillOpacity: 1
          });
          const path = layer.getElement();
          if (path) {
            path.style.fill = 'url(#diagonalHatch)';
          }
        } else {
          layer.setStyle({
            fillColor: getColorScale(value, currentMaxValue),
            fillOpacity: 0.7
          });
          const path = layer.getElement();
          if (path) {
            path.style.fill = ''; // Retirer le pattern
          }
        }
      });
  
  // Mettre à jour la légende
  updateLegend(currentMaxValue, metric);
}


function updateLegend(maxValue, metric) {
  addLegend(maxValue, metric);
}

function showCountryPanel(countryCode, countryName) {
  const panel = document.getElementById("side-panel");

  if(previousCountry == countryCode && !panel.classList.contains("hidden")){
    panel.classList.add("hidden");
    return
  }

  previousCountry = countryCode;
  
  const title = document.getElementById("panel-title");
  const content = document.getElementById("panel-content");

  if(countryName === "unknown"){
    countryName = "Non définis"
  }

  title.textContent = `Classement des chaînes — ${countryName}`;
  content.innerText = "Chargement...";

  panel.classList.remove("hidden");

  setTimeout(() =>{
      let rankPipeline = pipeline.resetPipeline();
      if(countryName !== "World")
         rankPipeline.filter(d => d.country === countryCode);
      const topChannels = rankPipeline.sortBy("subscriber_count", false).run();
      
      if (topChannels.length === 0) {
        content.innerText = "Aucune chaîne disponible pour ce pays.";
        return;
      }
      content.innerText = "";
      drawBarChart(topChannels);
    },0);
}

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
    .attr("id", "map-tooltip")
  
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
    .text(d => d.channel_name.length > 7 ? d.channel_name.substring(0,7) + "..." : d.channel_name);

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

function clearMap(){
  let metricSelector = document.getElementById("metric-selector");
  let sidePanel = document.getElementById("side-panel");
  metricSelector.classList.add("hidden")
  sidePanel.classList.add("hidden")

  if (map) {
    map.remove(); 
    map=null;
  }
}

export {renderMap,clearMap};