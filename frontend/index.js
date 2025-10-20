import DataPipeline from "./pipeline.js";
import {renderTreemap} from "./box/box.js";

const pipeline = new DataPipeline()
const pipeline = new DataPipeline();

const state = {
    visualization: '',
    filters: {
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

globalThis.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

document.getElementById('box-btn').addEventListener('click', () => {
    renderTreemap();
});

document.getElementById('applyFilters').addEventListener('click', () => {
    pipeline.clearOperations();
    const f = state.filters;

    pipeline
        .filter(d => {

            return (!f.selectedCountry || d.country === f.selectedCountry)
                && (!f.selectedCategory || d.category === f.selectedCategory)
                && (+d.subscribers >= f.minSubscribers)
                && (+d.subscribers <= f.maxSubscribers)
                && (+d.videos >= f.minVideos)
                && (new Date(d.date) >= new Date(f.minDate))
                && (new Date(d.date) <= new Date(f.maxDate));
        })
        .sortBy('subscribers', false)
        .limit('topK', f.topK);

    pipeline.run().slice(0, state.filters.topK);

    renderTreemap();
});

const main = document.getElementById("main-layout");
const toggle = document.getElementById("filter-toggle");

toggle.addEventListener("click", () => {
    main.classList.toggle("open");
    new Promise(resolve => setTimeout(resolve, 250)).then(() => renderTreemap());
});

export default pipeline;
