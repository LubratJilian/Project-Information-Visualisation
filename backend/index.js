import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.static("../frontend"));

app.get("/proxy", async (req, res) => {
    const {url} = req.query;
    if (!url) return res.status(400).send("Missing url parameter");

    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send("Failed to fetch remote image");

    res.set("Content-Type", response.headers.get("content-type"));
    res.set("Access-Control-Allow-Origin", "*");

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
});

app.listen(3000, () => console.log("http://localhost:3000"));
		// Serve CSV explicitly from repository root so frontend can fetch it at /youtube_channel_info_v2.csv
		const path = require('path');
		app.get('/youtube_channel_info_v2.csv', (req, res) => {
			const csvPath = path.join(__dirname, '..', 'youtube_channel_info_v2.csv');
			res.sendFile(csvPath, err => {
				if (err) {
					console.error('Error sending CSV:', err);
					res.status(500).send('Failed to send CSV');
				}
			});
		});
