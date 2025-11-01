import DataPipeline from "./pipeline.js";
import { renderTreemap } from "./box/box.js";
import { renderForCountry as renderPie, showPie } from "./pie/pie.js";

window.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

document.getElementById('box-btn').addEventListener('click', () => {
    renderTreemap();
});

document.getElementById('pie-btn').addEventListener('click', () => {
    renderPie('Monde');
});

export default pipeline;
