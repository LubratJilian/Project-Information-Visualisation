import DataPipeline from "./pipeline.js";
import {renderTreemap} from "./box/box.js";
import {renderMap,clearMap, getGlobalStatsCountry} from "./Map/map.js"
import {renderBubbleChart} from "./bubble/bubble.js";

const pipeline = new DataPipeline();

const state = {
    visualization: 'treemap', filters: {}
};

let defaultFilters = {};

function renderPie() {
    // import this function
}

function renderHistogram() {
    // import this function
}

const renderers = new Map([['treemap', renderTreemap], ['bubble', renderBubbleChart], ['map', renderMap], ['pie', renderPie], ['histogram', renderHistogram]]);

async function initPipeline() {
    await pipeline.load("data/youtube.csv", "csv");
    initializeFilters(pipeline.run());
    renderers.get(state.visualization)();
}

function initializeFilters(data) {
    console.log(data)
    const countries = [...new Set(data.map(d => d.country))].sort((a, b) => a.localeCompare(b));

    const categories = [...new Set(data.flatMap(d => {
        if (!d.category) return [];
        return d.category.split(',').map(cat => cat.trim());
    }))].sort((a, b) => a.localeCompare(b));

    const subscribers = data.map(d => +d.subscriber_count).filter(n => !Number.isNaN(n));
    const videos = data.map(d => +d.video_count).filter(n => !Number.isNaN(n));

    const subsMin = Math.min(...subscribers);
    const subsMax = Math.max(...subscribers);
    const videosMin = Math.min(...videos);
    const videosMax = Math.max(...videos);

    populateMultiSelect('countryDropdown', 'countryTrigger', countries, 'selectedCountries', 'pays');
    populateMultiSelect('categoryDropdown', 'categoryTrigger', categories, 'selectedCategories', 'catégories');

    bindDoubleSlider('minSubs', 'maxSubs', 'minSubsInput', 'maxSubsInput', 'minSubscribers', 'maxSubscribers', subsMin, subsMax);
    bindDoubleSlider('minVideos', 'maxVideos', 'minVideosInput', 'maxVideosInput', 'minVideos', 'maxVideos', videosMin, videosMax);

    bindInput('minDate', 'minDate');
    bindInput('maxDate', 'maxDate');
    bindInput('topK', 'topK', 'number');

    defaultFilters = {
        selectedCountries: [],
        selectedCategories: [],
        minSubscribers: subsMin,
        maxSubscribers: subsMax,
        minVideos: videosMin,
        maxVideos: videosMax,
        minDate: '2005-01-01',
        maxDate: new Date().toISOString().split('T')[0],
        topK: 100
    };

    state.filters = {...defaultFilters};
}

function populateMultiSelect(dropdownId, triggerId, options, stateKey, labelSingular) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);
    const selectedText = trigger.querySelector('.selected-text');

    dropdown.innerHTML = '';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'multi-select-search';
    searchInput.placeholder = 'Rechercher...';
    dropdown.appendChild(searchInput);

    const itemsContainer = document.createElement('div');
    itemsContainer.className = 'multi-select-items';
    dropdown.appendChild(itemsContainer);

    for (const option of options) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${dropdownId}-${option}`;
        checkbox.value = option;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = option;

        const item = document.createElement('div');
        item.className = 'multi-select-item';
        item.dataset.value = option.toLowerCase();
        item.appendChild(checkbox);
        item.appendChild(label);

        checkbox.addEventListener('change', () => {
            updateMultiSelectState(dropdownId, stateKey, selectedText, labelSingular);
        });

        itemsContainer.appendChild(item);
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const items = itemsContainer.querySelectorAll('.multi-select-item');

        for (const item of items) {
            const value = item.dataset.value;
            if (value.includes(searchTerm)) item.style.display = ''; else item.style.display = 'none';
        }
    });

    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
        if (dropdown.classList.contains('active')) {
            searchInput.value = '';
            searchInput.focus();
            for (const item of itemsContainer.querySelectorAll('.multi-select-item')) {
                item.style.display = '';
            }
        }
    });

    document.addEventListener('click', () => {
        dropdown.classList.remove('active');
    });

    dropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

function updateMultiSelectState(dropdownId, stateKey, selectedText, labelSingular) {
    const checkboxes = document.querySelectorAll(`#${dropdownId} input[type="checkbox"]:checked`);
    const selected = Array.from(checkboxes).map(cb => cb.value);

    state.filters[stateKey] = selected;

    if (selected.length === 0) selectedText.textContent = `Tous les ${labelSingular}`; else if (selected.length === 1) selectedText.textContent = selected[0]; else selectedText.textContent = `${selected.length} ${labelSingular} sélectionné(s)`;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function updateDoubleSlider(minSlider, maxSlider, minInput, maxInput, minStateKey, maxStateKey) {
    let minVal = Number.parseInt(minSlider.value);
    let maxVal = Number.parseInt(maxSlider.value);

    state.filters[minStateKey] = minVal;
    state.filters[maxStateKey] = maxVal;
    updateSliderTrack(minSlider, maxSlider);
}

function bindDoubleSlider(minSliderId, maxSliderId, minInputId, maxInputId, minStateKey, maxStateKey, dataMin, dataMax) {
    const minSlider = document.getElementById(minSliderId);
    const maxSlider = document.getElementById(maxSliderId);
    const minInput = document.getElementById(minInputId);
    const maxInput = document.getElementById(maxInputId);

    const step = Math.max(1, Math.floor((dataMax - dataMin) / 1000));

    minSlider.min = maxSlider.min = dataMin;
    minSlider.max = maxSlider.max = dataMax;
    minSlider.step = maxSlider.step = step;

    minSlider.value = minInput.value = state.filters[minStateKey] = dataMin;
    maxSlider.value = maxInput.value = state.filters[maxStateKey] = dataMax;

    minSlider.addEventListener('input', () => {
        minInput.value = minSlider.value;
        updateDoubleSlider(minSlider, maxSlider, minInput, maxInput, minStateKey, maxStateKey);
    });

    maxSlider.addEventListener('input', () => {
        maxInput.value = maxSlider.value;
        updateDoubleSlider(minSlider, maxSlider, minInput, maxInput, minStateKey, maxStateKey);
    });

    minInput.addEventListener('change', () => {
        let val = Number.parseInt(minInput.value);
        if (Number.isNaN(val)) val = dataMin;
        val = clamp(val, dataMin, Number.parseInt(maxSlider.value));
        minInput.value = minSlider.value = val;
        updateDoubleSlider(minSlider, maxSlider, minInput, maxInput, minStateKey, maxStateKey);
    });

    maxInput.addEventListener('change', () => {
        let val = Number.parseInt(maxInput.value);
        if (Number.isNaN(val)) val = dataMax;
        val = clamp(val, Number.parseInt(minSlider.value), dataMax);
        maxInput.value = maxSlider.value = val;
        updateDoubleSlider(minSlider, maxSlider, minInput, maxInput, minStateKey, maxStateKey);
    });

    updateSliderTrack(minSlider, maxSlider);
}

function updateSliderTrack(minSlider, maxSlider) {
    const min = Number.parseInt(minSlider.value);
    const max = Number.parseInt(maxSlider.value);
    const rangeMin = Number.parseInt(minSlider.min);
    const rangeMax = Number.parseInt(minSlider.max);

    const percentMin = ((min - rangeMin) / (rangeMax - rangeMin)) * 100;
    const percentMax = ((max - rangeMin) / (rangeMax - rangeMin)) * 100;

    const container = minSlider.parentElement;
    container.style.setProperty('--min-percent', `${percentMin}%`);
    container.style.setProperty('--max-percent', `${percentMax}%`);
}

function bindInput(inputId, stateKey, type = 'string') {
    const input = document.getElementById(inputId);
    input.addEventListener('input', () => state.filters[stateKey] = type === 'number' ? Number.parseInt(input.value) : input.value);
}

function resetFilters() {
    state.filters = {...defaultFilters};

    for (const cb of document.querySelectorAll('.multi-select-items input[type="checkbox"]')) cb.checked = false;

    document.getElementById('selected-countries').textContent = 'Tous les pays';
    document.getElementById('selected-categories').textContent = 'Toutes les catégories';

    document.getElementById('minSubs').value = state.filters.minSubscribers;
    document.getElementById('maxSubs').value = state.filters.maxSubscribers;
    document.getElementById('minSubsInput').value = state.filters.minSubscribers;
    document.getElementById('maxSubsInput').value = state.filters.maxSubscribers;

    document.getElementById('minVideos').value = state.filters.minVideos;
    document.getElementById('maxVideos').value = state.filters.maxVideos;
    document.getElementById('minVideosInput').value = state.filters.minVideos;
    document.getElementById('maxVideosInput').value = state.filters.maxVideos;

    updateSliderTrack(document.getElementById('minSubs'), document.getElementById('maxSubs'));
    updateSliderTrack(document.getElementById('minVideos'), document.getElementById('maxVideos'));

    document.getElementById('minDate').value = state.filters.minDate;
    document.getElementById('maxDate').value = state.filters.maxDate;
    document.getElementById('topK').value = state.filters.topK;

    pipeline.clearOperations();

    if(state.visualization === map){
        document.getElementById('metric-choice').value = 'maxSubscribers';
    }

    renderers.get(state.visualization)();
}

document.addEventListener('DOMContentLoaded', async () => {
    await initPipeline();
});

document.getElementById('box-btn').addEventListener('click', () => {
    clearMap();
    console.log(pipeline)
    state.visualization = 'treemap';
    renderers.get(state.visualization)();
});

document.getElementById('bubbles-btn').addEventListener('click', () => {
    clearMap();
    console.log(pipeline)

    state.visualization = 'bubble';
    renderers.get(state.visualization)();
});

document.getElementById('applyFilters').addEventListener('click', () => {
    pipeline.removeOperation('countryFilter');
    pipeline.removeOperation('categoryFilter');
    pipeline.removeOperation('subscriberFilter');
    pipeline.removeOperation('dateFilter');
    pipeline.removeOperation('sortBy');
    pipeline.removeOperation('topK');

    const f = state.filters;

    pipeline
        .filter('countryFilter', d => !f.selectedCountries?.length || f.selectedCountries.includes(d.country))
        .filter('categoryFilter', d => {
            if (!f.selectedCategories?.length) return true;
            const channelCategories = new Set(d.category.split(',').map(cat => cat.trim()));
            return f.selectedCategories.some(selected => channelCategories.has(selected));
        })
        .filter('subscriberFilter', d => +d.subscriber_count >= f.minSubscribers && +d.subscriber_count <= f.maxSubscribers)
        .filter('videoFilter', d => +d.video_count >= f.minVideos && +d.video_count <= f.maxVideos)
        .filter('dateFilter', d => new Date(d.created_date) >= new Date(f.minDate) && new Date(d.created_date) <= new Date(f.maxDate))
        .sortBy('sortBy', 'subscriber_count', false)
        .limit('topK', f.topK);
    console.log(pipeline)
    renderers.get(state.visualization)();
});

document.getElementById('resetFilters').addEventListener('click', () => {
    pipeline.removeOperation('countryFilter');
    pipeline.removeOperation('categoryFilter');
    pipeline.removeOperation('subscriberFilter');
    pipeline.removeOperation('dateFilter');
    pipeline.removeOperation('sortBy');
    pipeline.removeOperation('topK');
    resetFilters();
    renderers.get(state.visualization)();
});

document.getElementById("filter-toggle").addEventListener("click", () => {
    document.getElementById("main-layout").classList.toggle("open");
    new Promise(resolve => setTimeout(resolve, 250)).then(() => renderers.get(state.visualization)());
});

document.getElementById('map-btn').addEventListener('click', () => {
    clearMap();
    state.visualization = 'map';
    renderers.get(state.visualization)();
});

function updateFiltersForMetric(statsMap, metricKey) {
  // Définir quel slider utiliser selon la métrique
  const isVideoMetric = metricKey === 'avgVideos' || metricKey === 'totalVideos';
  
  const sliderConfig = isVideoMetric ? {
    min: 'minVideos',
    max: 'maxVideos',
    minInput: 'minVideosInput',
    maxInput: 'maxVideosInput',
    minFilter: 'minVideos',
    maxFilter: 'maxVideos',
    label: 'Nombre de vidéos'
  } : {
    min: 'minSubs',
    max: 'maxSubs',
    minInput: 'minSubsInput',
    maxInput: 'maxSubsInput',
    minFilter: 'minSubscribers',
    maxFilter: 'maxSubscribers',
    label: 'Nombre d\'abonnés'
  };
  
  // Extraire les valeurs
  const values = Array.from(statsMap.values())
    .map(stats => stats[metricKey])
    .filter(n => !Number.isNaN(n) && n !== undefined);
  
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  
  // Mettre à jour le slider
  bindDoubleSlider(
    sliderConfig.min,
    sliderConfig.max,
    sliderConfig.minInput,
    sliderConfig.maxInput,
    sliderConfig.minFilter,
    sliderConfig.maxFilter,
    minValue,
    maxValue
  );
  
  // Mettre à jour les filtres
  state.filters[sliderConfig.minFilter] = minValue;
  state.filters[sliderConfig.maxFilter] = maxValue;
}

document.getElementById('metric-choice')?.addEventListener('change', async (e) => {
    if(e.target.value === "channelCount")
        return initializeFilters(pipeline.run())
    updateFiltersForMetric(getGlobalStatsCountry(e.target.value), e.target.value);
});

window.closeSidePanel = function () {
    const panel = document.getElementById("side-panel");
    panel.classList.add("hidden");
    pipeline.removeOperation("countryFilter")
}

export default pipeline;