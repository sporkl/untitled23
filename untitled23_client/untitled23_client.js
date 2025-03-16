
ws = new WebSocket("ws://localhost:8080");

function onmessage(event) {
	console.log(event.data);
}

ws.onmessage = onmessage;

