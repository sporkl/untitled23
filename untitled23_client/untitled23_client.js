let start_pos = 0.0;
let end_pos = 0.0;
let zoom = 1.0;

let ws = new WebSocket("ws://localhost:8080");

function receiveMessage(event) {
	data=JSON.parse(event.data);
	document.getElementById("zoom").textContent = "Zoom: " + (data.zoom / 100).toFixed(2);
	document.getElementById("start_pos").textContent = "Start: " + (data.start_pos / 1000).toFixed(3);
	document.getElementById("end_pos").textContent = "End: " + (data.end_pos / 1000).toFixed(3);
}

ws.onmessage = receiveMessage;

function sendIncrZoom() {
	ws.send("/u23/zoom/incr");
}

function sendDecrZoom() {
	ws.send("/u23/zoom/decr");
}

function sendIncrStart() {
	ws.send("/u23/start_pos/incr");
}

function sendDecrStart() {
	ws.send("/u23/start_pos/decr");
}

function sendIncrEnd() {
	ws.send("/u23/end_pos/incr");
}

function sendDecrEnd() {
	ws.send("/u23/end_pos/decr");
}
