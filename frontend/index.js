import DataPipeline from "./pipeline.js";
import {renderTreemap} from "./box/box.js";

const pipeline = new DataPipeline()

globalThis.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

document.getElementById('box-btn').addEventListener('click', () => {
    renderTreemap();
});

document.getElementById('applyFilters').addEventListener('click', () => {
    pipeline.operations = [];

    pipeline
        .filter(d => {
            const f = state.filters;
            return (!f.selectedCountry || d.country === f.selectedCountry) && (!f.selectedCategory || d.category === f.selectedCategory) && (+d.subscribers >= f.minSubscribers) && (+d.subscribers <= f.maxSubscribers) && (+d.videos >= f.minVideos) && (new Date(d.date) >= new Date(f.minDate)) && (new Date(d.date) <= new Date(f.maxDate));
        })
        .sortBy('subscribers', false);


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
