import DataPipeline from "./pipeline.js";

const pipeline = new DataPipeline()

window.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};

window.closeSidePanel = function () {
    /*if (window.cancelImageLoading) {
        window.cancelImageLoading();
    }*/
    const panel = document.getElementById("side-panel");
    panel.classList.add("hidden");
}

export default pipeline;