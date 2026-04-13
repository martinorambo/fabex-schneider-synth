const keyboardNotes = [
  { note: "C4", midi: 60, key: "a", type: "white" },
  { note: "C#4", midi: 61, key: "w", type: "black" },
  { note: "D4", midi: 62, key: "s", type: "white" },
  { note: "D#4", midi: 63, key: "e", type: "black" },
  { note: "E4", midi: 64, key: "d", type: "white" },
  { note: "F4", midi: 65, key: "f", type: "white" },
  { note: "F#4", midi: 66, key: "t", type: "black" },
  { note: "G4", midi: 67, key: "g", type: "white" },
  { note: "G#4", midi: 68, key: "y", type: "black" },
  { note: "A4", midi: 69, key: "h", type: "white" },
  { note: "A#4", midi: 70, key: "u", type: "black" },
  { note: "B4", midi: 71, key: "j", type: "white" },
  { note: "C5", midi: 72, key: "k", type: "white" }
];

const presets = {
  "Velvet Pad": {
    waveform: "sawtooth",
    attack: 0.38,
    decay: 0.8,
    sustain: 0.74,
    release: 2.2,
    filterCutoff: 3400,
    filterQ: 2.7,
    filterEnvelopeAmount: 950,
    lfoRate: 0.8,
    lfoDepth: 5,
    delayTime: 0.32,
    delayFeedback: 0.42,
    delayMix: 0.28,
    reverbMix: 0.38,
    masterGain: 0.65,
    octaveShift: 0,
    unisonVoices: 3,
    detuneAmount: 13,
    drive: 1.1,
    glide: 0.06
  },
  "Solar Lead": {
    waveform: "square",
    attack: 0.01,
    decay: 0.14,
    sustain: 0.56,
    release: 0.34,
    filterCutoff: 7100,
    filterQ: 5.8,
    filterEnvelopeAmount: 2400,
    lfoRate: 5.2,
    lfoDepth: 8.5,
    delayTime: 0.18,
    delayFeedback: 0.28,
    delayMix: 0.18,
    reverbMix: 0.13,
    masterGain: 0.72,
    octaveShift: 1,
    unisonVoices: 2,
    detuneAmount: 8,
    drive: 1.8,
    glide: 0.04
  },
  "Night Bass": {
    waveform: "triangle",
    attack: 0.01,
    decay: 0.22,
    sustain: 0.72,
    release: 0.48,
    filterCutoff: 1900,
    filterQ: 4.5,
    filterEnvelopeAmount: 1200,
    lfoRate: 2,
    lfoDepth: 1.4,
    delayTime: 0.12,
    delayFeedback: 0.18,
    delayMix: 0.09,
    reverbMix: 0.08,
    masterGain: 0.78,
    octaveShift: -1,
    unisonVoices: 2,
    detuneAmount: 4,
    drive: 2.2,
    glide: 0.02
  },
  "Crystal Keys": {
    waveform: "sine",
    attack: 0.008,
    decay: 0.48,
    sustain: 0.52,
    release: 1.6,
    filterCutoff: 8400,
    filterQ: 1.4,
    filterEnvelopeAmount: 2800,
    lfoRate: 3.6,
    lfoDepth: 2.5,
    delayTime: 0.26,
    delayFeedback: 0.34,
    delayMix: 0.22,
    reverbMix: 0.3,
    masterGain: 0.68,
    octaveShift: 0,
    unisonVoices: 1,
    detuneAmount: 0,
    drive: 1,
    glide: 0.01
  }
};

const state = {
  audioStarted: false,
  activeVoices: new Map(),
  pointerKey: null,
  heldKeys: new Set(),
  lastFrequency: null,
  settings: {
    waveform: "sawtooth",
    attack: 0.02,
    decay: 0.28,
    sustain: 0.65,
    release: 0.9,
    filterCutoff: 5200,
    filterQ: 3.2,
    filterEnvelopeAmount: 1800,
    lfoRate: 4.2,
    lfoDepth: 6,
    delayTime: 0.24,
    delayFeedback: 0.32,
    delayMix: 0.2,
    reverbMix: 0.26,
    masterGain: 0.72,
    octaveShift: 0,
    unisonVoices: 2,
    detuneAmount: 10,
    drive: 1.2,
    glide: 0.04
  }
};

const controls = {};
let audioContext;
let synth;

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createImpulseResponse(context, duration = 2.8, decay = 2.4) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      data[i] = (Math.random() * 2 - 1) * (1 - t) ** decay;
    }
  }

  return impulse;
}

function createDistortionCurve(amount) {
  const samples = 256;
  const curve = new Float32Array(samples);
  const drive = Math.max(0.0001, amount * 20);
  for (let i = 0; i < samples; i += 1) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + drive) * x * 20 * (Math.PI / 180)) / (Math.PI + drive * Math.abs(x));
  }
  return curve;
}

function initAudio() {
  if (audioContext) {
    return;
  }

  audioContext = new window.AudioContext();

  const input = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();
  const distortion = audioContext.createWaveShaper();
  const analyser = audioContext.createAnalyser();
  const dryGain = audioContext.createGain();
  const wetDelayGain = audioContext.createGain();
  const wetReverbGain = audioContext.createGain();
  const masterGain = audioContext.createGain();
  const delayNode = audioContext.createDelay(1.5);
  const feedbackGain = audioContext.createGain();
  const reverb = audioContext.createConvolver();

  filter.type = "lowpass";
  analyser.fftSize = 2048;
  masterGain.gain.value = state.settings.masterGain;
  reverb.buffer = createImpulseResponse(audioContext);

  input.connect(filter);
  filter.connect(distortion);
  distortion.connect(dryGain);
  distortion.connect(delayNode);
  delayNode.connect(feedbackGain);
  feedbackGain.connect(delayNode);
  delayNode.connect(wetDelayGain);
  distortion.connect(reverb);
  reverb.connect(wetReverbGain);
  dryGain.connect(masterGain);
  wetDelayGain.connect(masterGain);
  wetReverbGain.connect(masterGain);
  masterGain.connect(analyser);
  analyser.connect(audioContext.destination);

  synth = {
    input,
    filter,
    distortion,
    analyser,
    dryGain,
    wetDelayGain,
    wetReverbGain,
    masterGain,
    delayNode,
    feedbackGain
  };

  applyGlobalSettings();
  startVisualizer();
}

function applyGlobalSettings() {
  if (!synth || !audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  synth.filter.frequency.setTargetAtTime(state.settings.filterCutoff, now, 0.02);
  synth.filter.Q.setTargetAtTime(state.settings.filterQ, now, 0.02);
  synth.masterGain.gain.setTargetAtTime(state.settings.masterGain, now, 0.02);
  synth.delayNode.delayTime.setTargetAtTime(state.settings.delayTime, now, 0.02);
  synth.feedbackGain.gain.setTargetAtTime(state.settings.delayFeedback, now, 0.02);
  synth.wetDelayGain.gain.setTargetAtTime(state.settings.delayMix, now, 0.02);
  synth.wetReverbGain.gain.setTargetAtTime(state.settings.reverbMix, now, 0.02);
  synth.dryGain.gain.setTargetAtTime(clamp(1 - state.settings.delayMix * 0.18, 0.7, 1), now, 0.03);
  synth.distortion.curve = createDistortionCurve(state.settings.drive);
  synth.distortion.oversample = "4x";
}

function startAudio() {
  initAudio();
  audioContext.resume();
  state.audioStarted = true;
  controls.powerButton.textContent = "Audio Ready";
  controls.powerButton.classList.add("active");
  controls.statusText.textContent = "Audio is active. Press keyboard keys or click the piano.";
}

function buildKeyboard() {
  controls.keyboard.innerHTML = "";

  keyboardNotes.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key ${item.type}`;
    button.dataset.midi = item.midi;
    button.dataset.key = item.key;
    button.innerHTML = `
      <span class="key-note">${item.note}</span>
      <span class="key-label">${item.key.toUpperCase()}</span>
    `;

    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      state.pointerKey = item.key;
      playMappedKey(item.key);
    });

    button.addEventListener("pointerup", () => releaseMappedKey(item.key));
    button.addEventListener("pointerenter", () => {
      if (state.pointerKey) {
        playMappedKey(item.key);
      }
    });
    button.addEventListener("pointerleave", () => {
      if (state.pointerKey === item.key) {
        releaseMappedKey(item.key);
      }
    });

    controls.keyboard.appendChild(button);
  });

  window.addEventListener("pointerup", () => {
    if (state.pointerKey) {
      releaseMappedKey(state.pointerKey);
      state.pointerKey = null;
    }
  });
}

function noteIdFromKey(key) {
  return key.toLowerCase();
}

function getKeyboardConfig(key) {
  return keyboardNotes.find((item) => item.key === key.toLowerCase());
}

function activateKeyUI(key, active) {
  const config = getKeyboardConfig(key);
  if (!config) {
    return;
  }

  const keyElement = controls.keyboard.querySelector(`[data-key="${config.key}"]`);
  if (keyElement) {
    keyElement.classList.toggle("active", active);
  }
}

function createVoice(frequency) {
  const now = audioContext.currentTime;
  const voiceGain = audioContext.createGain();
  const voiceFilter = audioContext.createBiquadFilter();
  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  const oscillators = [];
  const unisonVoices = state.settings.unisonVoices;
  const detuneSpread = state.settings.detuneAmount;

  voiceFilter.type = "lowpass";
  voiceFilter.frequency.value = Math.max(80, state.settings.filterCutoff - state.settings.filterEnvelopeAmount * 0.35);
  voiceFilter.Q.value = state.settings.filterQ;

  voiceGain.gain.setValueAtTime(0.0001, now);
  voiceGain.connect(voiceFilter);
  voiceFilter.connect(synth.input);

  for (let i = 0; i < unisonVoices; i += 1) {
    const osc = audioContext.createOscillator();
    const oscGain = audioContext.createGain();
    const detune = (i - (unisonVoices - 1) / 2) * detuneSpread;
    const startFrequency = state.lastFrequency ?? frequency;

    osc.type = state.settings.waveform;
    osc.frequency.setValueAtTime(startFrequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(frequency, 0.001), now + state.settings.glide);
    osc.detune.setValueAtTime(detune, now);
    osc.connect(oscGain);
    oscGain.connect(voiceGain);
    oscGain.gain.value = 0.9 / unisonVoices;
    osc.start(now);
    oscillators.push(osc);
  }

  lfo.type = "sine";
  lfo.frequency.setValueAtTime(state.settings.lfoRate, now);
  lfoGain.gain.setValueAtTime(state.settings.lfoDepth, now);
  lfo.connect(lfoGain);
  oscillators.forEach((osc) => lfoGain.connect(osc.detune));
  lfo.start(now);

  const peakTime = now + state.settings.attack;
  const decayTime = peakTime + state.settings.decay;
  voiceGain.gain.cancelScheduledValues(now);
  voiceGain.gain.linearRampToValueAtTime(1, peakTime);
  voiceGain.gain.linearRampToValueAtTime(state.settings.sustain, decayTime);

  voiceFilter.frequency.cancelScheduledValues(now);
  voiceFilter.frequency.linearRampToValueAtTime(state.settings.filterCutoff + state.settings.filterEnvelopeAmount, peakTime);
  voiceFilter.frequency.linearRampToValueAtTime(state.settings.filterCutoff, decayTime);

  return { oscillators, lfo, lfoGain, voiceGain, voiceFilter };
}

function stopVoice(voice) {
  if (!voice || !audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const stopAt = now + state.settings.release + 0.1;

  voice.voiceGain.gain.cancelScheduledValues(now);
  voice.voiceGain.gain.setValueAtTime(Math.max(voice.voiceGain.gain.value, 0.0001), now);
  voice.voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + state.settings.release);
  voice.voiceFilter.frequency.cancelScheduledValues(now);
  voice.voiceFilter.frequency.setTargetAtTime(Math.max(120, state.settings.filterCutoff * 0.7), now, state.settings.release * 0.35);

  voice.oscillators.forEach((osc) => osc.stop(stopAt));
  voice.lfo.stop(stopAt);

  setTimeout(() => {
    voice.voiceGain.disconnect();
    voice.voiceFilter.disconnect();
    voice.lfo.disconnect();
    voice.lfoGain.disconnect();
  }, Math.max(0, (state.settings.release + 0.3) * 1000));
}

function playNote(noteId, midi) {
  if (!state.audioStarted) {
    startAudio();
  }

  const actualMidi = midi + state.settings.octaveShift * 12;
  const frequency = midiToFrequency(actualMidi);
  const existing = state.activeVoices.get(noteId);

  if (existing) {
    stopVoice(existing);
  }

  state.lastFrequency = frequency;
  state.activeVoices.set(noteId, createVoice(frequency));
}

function releaseNote(noteId) {
  const voice = state.activeVoices.get(noteId);
  if (!voice) {
    return;
  }

  stopVoice(voice);
  state.activeVoices.delete(noteId);
}

function playMappedKey(key) {
  const config = getKeyboardConfig(key);
  if (!config || state.heldKeys.has(config.key)) {
    return;
  }

  state.heldKeys.add(config.key);
  activateKeyUI(config.key, true);
  playNote(noteIdFromKey(config.key), config.midi);
}

function releaseMappedKey(key) {
  const config = getKeyboardConfig(key);
  if (!config) {
    return;
  }

  state.heldKeys.delete(config.key);
  activateKeyUI(config.key, false);
  releaseNote(noteIdFromKey(config.key));
}

function bindComputerKeyboard() {
  window.addEventListener("keydown", (event) => {
    if (event.repeat || ["INPUT", "SELECT"].includes(document.activeElement?.tagName)) {
      return;
    }

    const config = getKeyboardConfig(event.key);
    if (!config) {
      return;
    }

    event.preventDefault();
    playMappedKey(config.key);
  });

  window.addEventListener("keyup", (event) => {
    const config = getKeyboardConfig(event.key);
    if (!config) {
      return;
    }

    event.preventDefault();
    releaseMappedKey(config.key);
  });
}

function formatValue(id, value) {
  switch (id) {
    case "attack":
      return `${Number(value).toFixed(3)} s`;
    case "decay":
    case "release":
    case "delayTime":
    case "glide":
      return `${Number(value).toFixed(2)} s`;
    case "sustain":
    case "masterGain":
    case "delayFeedback":
    case "delayMix":
    case "reverbMix":
      return `${Math.round(Number(value) * 100)}%`;
    case "filterCutoff":
    case "filterEnvelopeAmount":
      return `${Math.round(Number(value))} Hz`;
    case "filterQ":
      return Number(value).toFixed(1);
    case "lfoRate":
      return `${Number(value).toFixed(1)} Hz`;
    case "lfoDepth":
      return `${Number(value).toFixed(1).replace(".0", "")} cents`;
    case "detuneAmount":
      return `${Math.round(Number(value))} cents`;
    case "drive":
      return Number(value).toFixed(2);
    default:
      return `${value}`;
  }
}

function attachControl(id) {
  const input = document.getElementById(id);
  const valueLabel = document.getElementById(`${id}Value`);
  controls[id] = input;

  if (valueLabel) {
    controls[`${id}Value`] = valueLabel;
    valueLabel.textContent = formatValue(id, input.value);
  }

  input.addEventListener("input", () => {
    state.settings[id] = input.type === "range" ? Number(input.value) : input.value;
    if (valueLabel) {
      valueLabel.textContent = formatValue(id, input.value);
    }
    applyGlobalSettings();
  });
}

function populatePresets() {
  Object.keys(presets).forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    controls.presetSelect.appendChild(option);
  });

  controls.presetSelect.addEventListener("change", () => {
    const preset = presets[controls.presetSelect.value];
    if (!preset) {
      return;
    }

    Object.entries(preset).forEach(([key, value]) => {
      state.settings[key] = value;
      if (controls[key]) {
        controls[key].value = value;
      }
      if (controls[`${key}Value`]) {
        controls[`${key}Value`].textContent = formatValue(key, value);
      }
    });

    controls.octaveShiftValue.textContent = `${state.settings.octaveShift}`;
    controls.unisonVoicesValue.textContent = `${state.settings.unisonVoices}`;
    applyGlobalSettings();
  });

  controls.presetSelect.value = "Velvet Pad";
  controls.presetSelect.dispatchEvent(new Event("change"));
}

function startVisualizer() {
  const canvas = controls.visualizer;
  const context = canvas.getContext("2d");
  const data = new Uint8Array(synth.analyser.fftSize);

  function draw() {
    requestAnimationFrame(draw);
    synth.analyser.getByteTimeDomainData(data);

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 2.4;
    context.strokeStyle = "#7dd3fc";
    context.beginPath();

    const sliceWidth = canvas.width / data.length;
    let x = 0;
    for (let i = 0; i < data.length; i += 1) {
      const y = (data[i] / 128) * canvas.height / 2;
      if (i === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
      x += sliceWidth;
    }

    context.stroke();
    context.strokeStyle = "rgba(245, 158, 11, 0.35)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(0, canvas.height / 2);
    context.lineTo(canvas.width, canvas.height / 2);
    context.stroke();
  }

  draw();
}

function initializeControls() {
  controls.powerButton = document.getElementById("powerButton");
  controls.statusText = document.getElementById("statusText");
  controls.keyboard = document.getElementById("keyboard");
  controls.visualizer = document.getElementById("visualizer");
  controls.presetSelect = document.getElementById("presetSelect");

  [
    "waveform",
    "attack",
    "decay",
    "sustain",
    "release",
    "filterCutoff",
    "filterQ",
    "filterEnvelopeAmount",
    "lfoRate",
    "lfoDepth",
    "delayTime",
    "delayFeedback",
    "delayMix",
    "reverbMix",
    "masterGain",
    "octaveShift",
    "unisonVoices",
    "detuneAmount",
    "drive",
    "glide"
  ].forEach(attachControl);

  controls.powerButton.addEventListener("click", startAudio);
  controls.octaveShift.addEventListener("input", () => {
    controls.octaveShiftValue.textContent = `${controls.octaveShift.value}`;
  });
  controls.unisonVoices.addEventListener("input", () => {
    controls.unisonVoicesValue.textContent = `${controls.unisonVoices.value}`;
  });
}

function init() {
  initializeControls();
  populatePresets();
  buildKeyboard();
  bindComputerKeyboard();
}

document.addEventListener("DOMContentLoaded", init);
