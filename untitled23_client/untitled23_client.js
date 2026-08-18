// SETUP

let start_pos = 0.0;
let end_pos = 1.0;
let zoom = 3.0;
let narrow_intensity = 0.0;
let silence = 0;

const numPoses = 10;

const numSynths = 5;

function randomRange(min, max, skew = 1) {
	return ((Math.random() ** (1 / skew)) * (max - min)) + min;
}

function genPos() {
	return randomRange(0, 1);
}

function genGrainGain() {
	return randomRange(-40, 0);
}

function genPlaybackRate() {
	return randomRange(2, 9, 0.3);
}

function genChopperRate() {
	return randomRange(3, 8);
}

function initArray(len, f) {
	let a = [];
	for (let i = 0; i < len; i++) {
		a.push(f());
	}
	return a;
}

function randomChoice(a) {
	return a[Math.floor(Math.random() * a.length)];
}

let finalgain = new Tone.Gain(1).toDestination();

// synth

function Synth() {
	this.between_poses = initArray(numPoses - 2, genPos).sort(); this.between_poses.unshift(0); this.between_poses.push(1);
	this.grain_gains = initArray(numPoses - 2, genGrainGain); this.grain_gains.unshift(-999); this.grain_gains.push(-999);
	this.playback_rates = initArray(numPoses, genPlaybackRate);
	this.chopper_rates = initArray(numPoses, genChopperRate);

	this.graingain = new Tone.Gain(1, "decibels").connect(finalgain);
	this.chopgain = new Tone.Gain(1).connect(this.graingain);

	this.grain = new Tone.Player("ake_metalhit.wav").connect(this.chopgain);
	this.grain.autoplay = true;
	this.grain.loop = true;
	this.grain.playbackRate = 14; // from 4 to 9

	this.chopper = new Tone.LFO(3, 0, 1); // from 3 to 8
	this.chopper.connect(this.chopgain.gain);

	this.startAudio = () => {
		this.chopper.start();
		this.grain.start();
	}

}

function initSynth() {
	return new Synth();
}

let synths = initArray(numSynths, initSynth);

// pinger

const pingPitches = [
	6547, 6582, 6622, 6698, 7863, 8026, 8230, 8451, 8470, 9332, 9360, 9553
].map((x) => x / 3);

let pingergain = new Tone.Gain(0.01).connect(finalgain);

let pinger = new Tone.Sampler({
	urls: {G6: "tibetan_bell.wav"},
	baseUrl: ""
}).connect(pingergain);

function soundPing() {
	pinger.triggerAttackRelease(randomChoice(pingPitches), 1);
}


let ws = new WebSocket("ws://" + location.host + "/ws");

// CALLBACKS

function startAudio() {
	document.getElementById("modal").style.display = "none";
	document.getElementById("interface").style.display = "block";

	Tone.start();

	synths.forEach((s) => {s.startAudio()});
}

function receiveMessage(m) {
	data = JSON.parse(m.data);
	zoom = data.zoom / 10;
	start_pos = data.start_pos / 1000;
	end_pos = data.end_pos / 1000;
	silence = data.silence;
	document.getElementById("zoom").textContent = "Zoom: " + zoom.toFixed(1);
	document.getElementById("start_pos").textContent = "Start: " + start_pos.toFixed(3);
	document.getElementById("end_pos").textContent = "End: " + end_pos.toFixed(3);
}

ws.onmessage = receiveMessage;

function onCloseOrError(e) {
	silence = 1;
}

ws.onclose = onCloseOrError;
ws.onerror = onCloseOrError;

function sendIncrZoom() {
	ws.send("/u23/zoom/incr");
	soundPing();
}

function sendDecrZoom() {
	ws.send("/u23/zoom/decr");
	soundPing();
}

function sendIncrStart() {
	ws.send("/u23/start_pos/incr");
	soundPing();
}

function sendDecrStart() {
	ws.send("/u23/start_pos/decr");
	soundPing();
}

function sendIncrEnd() {
	ws.send("/u23/end_pos/incr");
	soundPing();
}

function sendDecrEnd() {
	ws.send("/u23/end_pos/decr");
	soundPing();
}

function sendEndingFalse() {
	ws.send("/u23/ending/false");
}

function sendEndingTrue() {
	ws.send("/u23/ending/true");
}

function sendSilenceTransition() {
	ws.send("/u23/silence/1");
}

function sendSilenceFalse() {
	ws.send("/u23/silence/0");
}

function sendSilenceComplete() {
	ws.send("/u23/silence/2");
}

function setNarrowIntensity(v) {
	narrow_intensity = v;
}

// THE LOOP

function lerp(v, imin, imax, omin, omax) {
	return (((v - imin) / (imax - imin)) * (omax - omin)) + omin;
}

function lerpList(v, ilist, olist) {
	for (let i = 1; i < ilist.length - 1; i++) {
		if (v < ilist[i]) {
			return lerp(v, ilist[i-1], ilist[i], olist[i-1], olist[i]);
		}
	}
	return lerp(v, ilist[ilist.length-2], ilist[ilist.length-1], olist[ilist.length-2], olist[ilist.length-1]);
}

function updateParameters() {
	// find position from 0 to 1 based on current time and zoom
	let timepos = ((Date.now() / 1000) % zoom) / zoom;
	
	// convert that time to be within the current start and end
	let pos = lerp(timepos, 0, 1, start_pos, end_pos);

	synths.forEach((s) => {
		// get the playback, chopper, gain info and update those parameters
		s.graingain.gain.value = lerpList(pos, s.between_poses, s.grain_gains);
		s.grain.playbackRate = lerpList(pos, s.between_poses, s.playback_rates);
		s.chopper.frequency = lerpList(pos, s.between_poses, s.chopper_rates);
	});

	if (silence == 0) {
		finalgain.gain.value = 1;
	} else if (silence == 1) {
		finalgain.gain.value *= 0.995;
	} else {
		finalgain.gain.value = 0;
	}

	if (Math.random() < narrow_intensity) {
		if (start_pos > end_pos) {
			if (Math.random() > 0.5) {
				ws.send("/u23/start_pos/decr");
			} else {
				ws.send("/u23/end_pos/incr");
			}
		} else {
			if (Math.random() > 0.5) {
				ws.send("/u23/start_pos/incr");
			} else {
				ws.send("/u23/end_pos/decr");
			}
		}
	}

	setTimeout(updateParameters, 10);
}

function updateVisualization(timestamp) {
	
	// find position from 0 to 1 based on current time and zoom
	let timepos = ((Date.now() / 1000) % zoom) / zoom;
	
	// convert that time to be within the current start and end
	let pos = lerp(timepos, 0, 1, start_pos, end_pos);

	// update the visualization
	let visualizer = document.getElementById("visualizer").getContext("2d");
	let bgColor = window.getComputedStyle(document.body).getPropertyValue("--bg-color");
	let fgColor = window.getComputedStyle(document.body).getPropertyValue("--font-color");
	let accentColor = window.getComputedStyle(document.body).getPropertyValue("--color-primary");

	// clear
	visualizer.clearRect(0, 0, 1000, 100);

	visualizer.lineWidth = 4;
	
	// draw the line
	visualizer.beginPath();
	visualizer.moveTo(0, 50);
	visualizer.strokeStyle = fgColor;
	visualizer.lineTo(1000, 50);
	visualizer.stroke();

	// draw the start
	let startX = Math.round(start_pos * 1000);
	visualizer.beginPath();
	visualizer.moveTo(startX, 0);
	visualizer.strokeStyle = fgColor;
	visualizer.lineTo(startX, 100);
	visualizer.stroke();
	
	// draw the end
	let endX = Math.round(end_pos * 1000);
	visualizer.beginPath();
	visualizer.moveTo(endX, 0);
	visualizer.strokeStyle = fgColor;
	visualizer.lineTo(endX, 100);
	visualizer.stroke();
	
	// draw current position
	let posX = Math.round(pos * 1000);
	visualizer.beginPath();
	visualizer.moveTo(posX, 0);
	visualizer.strokeStyle = accentColor;
	visualizer.lineTo(posX, 100);
	visualizer.stroke();

	requestAnimationFrame(updateVisualization);
}

setTimeout(updateParameters, 10);
requestAnimationFrame(updateVisualization);
