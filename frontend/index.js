import DataPipeline from "./pipeline.js";

const pipeline = new DataPipeline()

window.initPipeline = function () {
    pipeline.load("data/youtube.csv", "csv").then();
};
