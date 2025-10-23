import DataPipeline from "./pipeline.js";
import {renderTreemap} from "./box/box.js";
import {renderMap,clearMap} from "./Map/map.js"

const pipeline = new DataPipeline()

window.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

document.getElementById('box-btn').addEventListener('click', () => {
    clearMap();
    renderTreemap();
});

document.getElementById('map-btn').addEventListener('click', () => {
    clearMap();
    renderMap();
});

window.closeSidePanel = function () {
    /*if (window.cancelImageLoading) {
        window.cancelImageLoading();
    }*/
    const panel = document.getElementById("side-panel");
    panel.classList.add("hidden");
}

export default pipeline;