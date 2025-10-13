const express = require("express");
const app = express();
app.use(express.static("../frontend"));
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
