// SETUP

let start_pos = 0.0;
let end_pos = 1.0;
let zoom = 3.0;
let narrow_intensity = 0.0;
let silence = false;

function randomRange(min, max, skew = 1) {
	return ((Math.random() ** (1 / skew)) * (max - min)) + min;
}

function genGrainGain() {
	return randomRange(0.01, 1);
}

function genPlaybackRate() {
	return randomRange(2, 9, 0.3);
}

function genChopperRate() {
	return randomRange(3, 8);
}

let between_poses = [randomRange(0, 1), randomRange(0, 1), randomRange(0, 1), randomRange(0, 1)].sort();
let grain_gains = [0, genGrainGain(), genGrainGain(), genGrainGain(), genGrainGain(), 0];
let playback_rates = [genPlaybackRate(), genPlaybackRate(), genPlaybackRate(), genPlaybackRate(), genPlaybackRate(), genPlaybackRate()];
let chopper_rates = [genChopperRate(), genChopperRate(), genChopperRate(), genChopperRate(), genChopperRate(), genChopperRate()];

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

// generate 3 intermediate position numbers, and 5 numbers total
// linear interpolate between the 5 numbers at the 3 positions
// 5th number for gain should be 0

// gets playback rate value at position p from 0 to 1
function getPlaybackRate(p) {
	if (p < between_poses[0]) {
		return lerp(p, 0, between_poses[0], playback_rates[0], playback_rates[1]);
	} else if ((between_poses[0] <= p) && (p < between_poses[1])) {
		return lerp(p, between_poses[0], between_poses[1], playback_rates[1], playback_rates[2]);
	} else if ((between_poses[1] <= p) && (p < between_poses[2])) {
		return lerp(p, between_poses[1], between_poses[2], playback_rates[2], playback_rates[3]);
	} else if ((between_poses[2] <= p) && (p < between_poses[3])) {
		return lerp(p, between_poses[2], between_poses[3], playback_rates[3], playback_rates[4]);
	} else if (p >= between_poses[3]) {
		return lerp(p, between_poses[3], 1, playback_rates[4], playback_rates[5]);
	}
}

// gets chopper rate value at position p from 0 to 1
function getChopperRate(p) {
	if (p < between_poses[0]) {
		return lerp(p, 0, between_poses[0], chopper_rates[0], chopper_rates[1]);
	} else if ((between_poses[0] <= p) && (p < between_poses[1])) {
		return lerp(p, between_poses[0], between_poses[1], chopper_rates[1], chopper_rates[2]);
	} else if ((between_poses[1] <= p) && (p < between_poses[2])) {
		return lerp(p, between_poses[1], between_poses[2], chopper_rates[2], chopper_rates[3]);
	} else if ((between_poses[2] <= p) && (p < between_poses[3])) {
		return lerp(p, between_poses[2], between_poses[3], chopper_rates[3], chopper_rates[4]);
	} else if (p >= between_poses[3]) {
		return lerp(p, between_poses[3], 1, chopper_rates[4], chopper_rates[5]);
	}
}

// gets final gain value at position p from 0 to 1
function getGrainGain(p) {
	if (p < between_poses[0]) {
		return lerp(p, 0, between_poses[0], grain_gains[0], grain_gains[1]);
	} else if ((between_poses[0] <= p) && (p < between_poses[1])) {
		return lerp(p, between_poses[0], between_poses[1], grain_gains[1], grain_gains[2]);
	} else if ((between_poses[1] <= p) && (p < between_poses[2])) {
		return lerp(p, between_poses[1], between_poses[2], grain_gains[2], grain_gains[3]);
	} else if ((between_poses[2] <= p) && (p < between_poses[3])) {
		return lerp(p, between_poses[2], between_poses[3], grain_gains[3], grain_gains[4]);
	} else if (p >= between_poses[3]) {
		return lerp(p, between_poses[3], 1, grain_gains[4], grain_gains[5]);
	}
}

function lerp(v, imin, imax, omin, omax) {
	return (((v - imin) / (imax - imin)) * (omax - omin)) + omin;
}

function updateParameters() {
	// find position from 0 to 1 based on current time and zoom
	let timepos = ((Date.now() / 1000) % zoom) / zoom;
	
	// convert that time to be within the current start and end
	let pos = lerp(timepos, 0, 1, start_pos, end_pos);

	// get the playback, chopper, gain info and update those parameters
	graingain.gain.value = getGrainGain(pos);
	grain.playbackRate = getPlaybackRate(pos);
	chopper.frequency = getChopperRate(pos);

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
