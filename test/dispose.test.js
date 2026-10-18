"use strict";

const assert = require('node:assert/strict');
const test = require('node:test');
const SubtitlesOctopus = require('../src/subtitles-octopus.js');

test('dispose keeps a supplied canvas and disconnects the video observer', () => {
    const context = {
        clearRect() {},
        getImageData() { return { data: [0, 0, 0, 0] }; },
        putImageData() {},
        drawImage() {}
    };
    const canvas = { width: 1, height: 1, getContext() { return context; } };
    const children = [];
    const parent = {
        appendChild(child) { children.push(child); child.parentNode = this; },
        removeChild(child) {
            const index = children.indexOf(child);
            if (index === -1) throw new TypeError('Child is not in parent');
            children.splice(index, 1);
            child.parentNode = null;
        }
    };
    const video = {
        videoWidth: 0,
        addEventListener() {},
        removeEventListener() {}
    };
    parent.appendChild(video);
    parent.appendChild(canvas);

    let disconnected = false;
    global.window = { devicePixelRatio: 1, Worker: true, addEventListener() {}, removeEventListener() {} };
    global.ImageData = global.window.ImageData = class ImageData {
        constructor(data) { this.data = data; }
    };
    global.document = {
        URL: 'https://example.test/',
        createElement() { return { width: 1, height: 1, getContext() { return context; } }; },
        addEventListener() {},
        removeEventListener() {}
    };
    global.Worker = class Worker {
        addEventListener() {}
        removeEventListener() {}
        postMessage() {}
        terminate() {}
    };
    global.ResizeObserver = class ResizeObserver {
        observe() {}
        disconnect() { disconnected = true; }
    };

    try {
        const subtitles = new SubtitlesOctopus({ canvas, video });
        assert.equal(subtitles.canvasParent, null);
        assert.doesNotThrow(() => subtitles.dispose());
        assert.equal(disconnected, true);
        assert.deepEqual(children, [video, canvas]);
    } finally {
        delete global.window;
        delete global.ImageData;
        delete global.document;
        delete global.Worker;
        delete global.ResizeObserver;
    }
});

test('loaded metadata sizes a supplied canvas from the video', () => {
    const context = {
        clearRect() {},
        getImageData() { return { data: [0, 0, 0, 0] }; },
        putImageData() {},
        drawImage() {}
    };
    const canvas = { width: 1, height: 1, style: {}, getContext() { return context; } };
    const listeners = new Map();
    const video = {
        videoWidth: 0,
        videoHeight: 0,
        offsetWidth: 640,
        offsetHeight: 360,
        addEventListener(type, listener) { listeners.set(type, listener); },
        removeEventListener(type) { listeners.delete(type); },
        getBoundingClientRect() { return { top: 0 }; }
    };
    const messages = [];

    global.window = { devicePixelRatio: 1, Worker: true, addEventListener() {}, removeEventListener() {} };
    global.ImageData = global.window.ImageData = class ImageData {
        constructor(data) { this.data = data; }
    };
    global.document = {
        URL: 'https://example.test/',
        createElement() { return { width: 1, height: 1, getContext() { return context; } }; },
        addEventListener() {},
        removeEventListener() {}
    };
    global.Worker = class Worker {
        addEventListener() {}
        removeEventListener() {}
        postMessage(message) { messages.push(message); }
        terminate() {}
    };

    try {
        const subtitles = new SubtitlesOctopus({ canvas, video });
        video.videoWidth = 1920;
        video.videoHeight = 1080;

        assert.doesNotThrow(() => listeners.get('loadedmetadata')({ target: video, type: 'loadedmetadata' }));
        assert.equal(canvas.width, 640);
        assert.equal(canvas.height, 360);
        assert.ok(messages.some(message => message.target === 'canvas' && message.width === 640 && message.height === 360));
        subtitles.dispose();
    } finally {
        delete global.window;
        delete global.ImageData;
        delete global.document;
        delete global.Worker;
    }
});
