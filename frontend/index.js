import DataPipeline from "./pipeline.js";
import {renderTreemap} from "./box/box.js";

const pipeline = new DataPipeline();

const state = {
    visualization: '', filters: {
        selectedCountry: null,
        selectedCategory: null,
        minSubscribers: 0,
        maxSubscribers: Infinity,
        minVideos: 0,
        minDate: '2005-01-01',
        maxDate: new Date().toISOString().split('T')[0],
        topK: 100
    }
};

function renderBubble() {
    // import this function
}

function renderMap() {
    // import this function
}

function renderPie() {
    // import this function
}

function renderHistogram() {
    // import this function
}

const renderers = new Map([['treemap', renderTreemap], ['bubble', renderBubble], ['map', renderMap], ['pie', renderPie], ['histogram', renderHistogram]]);

globalThis.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

document.getElementById('box-btn').addEventListener('click', () => {
    state.visualization = 'treemap';
    const renderer = renderers.get(state.visualization) ?? renderTreemap;
    renderer();
});

document.getElementById('applyFilters').addEventListener('click', () => {
    pipeline.clearOperations();
    const f = state.filters;

    pipeline
        .filter('filters', d => {
            return (!f.selectedCountry || d.country === f.selectedCountry)
                && (!f.selectedCategory || d.category === f.selectedCategory)
                && (+d.subscriber_count >= f.minSubscribers)
                && (+d.subscriber_count <= f.maxSubscribers) && (+d.video_count >= f.minVideos)
                && (new Date(d.created_date) >= new Date(f.minDate))
                && (new Date(d.created_date) <= new Date(f.maxDate));
        })
        .sortBy('subscribers', false)
        .limit('topK', f.topK);

    const renderer = renderers.get(state.visualization) ?? renderTreemap;
    renderer();
});

const main = document.getElementById("main-layout");
const toggle = document.getElementById("filter-toggle");

toggle.addEventListener("click", () => {
    main.classList.toggle("open");
    new Promise(resolve => setTimeout(resolve, 250)).then(() => renderTreemap());
});

export default pipeline;
