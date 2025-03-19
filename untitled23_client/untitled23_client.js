// SETUP

let start_pos = 0.0;
let end_pos = 1.0;
let zoom = 3.0;
let narrow_intensity = 0.0;
let silence = false;

const numPoses = 10;

function randomRange(min, max, skew = 1) {
	return ((Math.random() ** (1 / skew)) * (max - min)) + min;
}

function genPos() {
	return randomRange(0, 1);
}

function genGrainGain() {
	return randomRange(0.001, 0.1);
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

let between_poses = initArray(numPoses - 2, genPos).sort(); between_poses.unshift(0); between_poses.push(1);
let grain_gains = initArray(numPoses - 2, genGrainGain); grain_gains.unshift(0); grain_gains.push(0);
let playback_rates = initArray(numPoses, genPlaybackRate);
let chopper_rates = initArray(numPoses, genChopperRate);

let ws = new WebSocket("ws://localhost:8080");

const finalgain = new Tone.Gain(1).toDestination();
const graingain = new Tone.Gain(1).connect(finalgain);
const chopgain = new Tone.Gain(1).connect(graingain);
const pingergain = new Tone.Gain(0.1).connect(finalgain);

const grain = new Tone.Player("ake_metalhit.wav").connect(chopgain);
grain.autoplay = true;
grain.loop = true;
grain.playbackRate = 14; // from 4 to 9

const chopper = new Tone.LFO(3, 0, 1); // from 3 to 8
chopper.connect(chopgain.gain);

const pinger = new Tone.Sampler({
	urls: {G6: "tibetan_bell.wav"},
	baseUrl: ""
}).connect(pingergain);

// CALLBACKS

function startAudio() {
	document.getElementById("modal").style.display = "none";
	document.getElementById("interface").style.display = "block";
	Tone.start();
	chopper.start();
	grain.start();
	soundPing();
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

function randomChoice(a) {
	return a[Math.floor(Math.random() * a.length)];
}

const pingPitches = [
	6547, 6582, 6622, 6698, 7863, 8026, 8230, 8451, 8470, 9332, 9360, 9553
].map((x) => x / 3);

function soundPing() {
	pinger.triggerAttackRelease(randomChoice(pingPitches), 1);
}

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

function sendSilenceTrue() {
	ws.send("/u23/silence/true");
}

function sendSilenceFalse() {
	ws.send("/u23/silence/false");
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

	// get the playback, chopper, gain info and update those parameters
	graingain.gain.value = lerpList(pos, between_poses, grain_gains);
	grain.playbackRate = lerpList(pos, between_poses, playback_rates);
	chopper.frequency = lerpList(pos, between_poses, chopper_rates);

	if (silence) {
		finalgain.gain.value *= 0.995;
	} else {
		finalgain.gain.value = 1;
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

setTimeout(updateParameters, 10);
