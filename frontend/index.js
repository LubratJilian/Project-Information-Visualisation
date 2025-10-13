import DataPipeline from "./pipeline.js";
import {renderTreemap} from "./box/box.js";

const pipeline = new DataPipeline()

window.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

document.getElementById('box-btn').addEventListener('click', () => {
    renderTreemap();
});

export default pipeline;
