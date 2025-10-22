import DataPipeline from "./pipeline.js";
import {renderTreemap} from "./box/box.js";
import {initBubbleChart} from "./bubble/bubble.js";

const pipeline = new DataPipeline()

window.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

document.getElementById('box-btn').addEventListener('click', () => {
    renderTreemap();
});

document.getElementById('bubbles-btn').addEventListener("click", () => {
    initBubbleChart();
});

export default pipeline;
