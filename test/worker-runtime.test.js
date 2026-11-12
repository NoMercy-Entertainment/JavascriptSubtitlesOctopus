"use strict";

// Drives the built worker (dist/js/subtitles-octopus-worker.js) inside a vm
// context that looks like a Web Worker, and talks to it with the same
// messages the main-thread class sends.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dist = path.join(__dirname, '..', 'dist', 'js');

const ASS = `[Script Info]
ScriptType: v4.00+
PlayResX: 640
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1
Style: Second,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,First line
Dialogue: 0,0:00:01.00,0:00:06.00,Default,,0,0,0,,Second line
Dialogue: 0,0:00:02.00,0:00:07.00,Default,,0,0,0,,Third line
`;

const INLINE_FONT_ASS = ASS.replace('Third line', '{\\fnInlineOnlyFont}Third line');

function startWorker(options = {}) {
    const sent = [];
    const waiters = [];
    const fontLoads = [];
    const FakeXhr = class {
        open() {}
        send() {
            this.response = new Uint8Array(4).buffer;
            this.status = 200;
            setImmediate(() => this.onload && this.onload());
        }
    };
    const sandbox = {
        Module: { wasmBinary: fs.readFileSync(path.join(dist, 'subtitles-octopus-worker.wasm')) },
        console: { ...console, log: (text) => sent.push({ target: 'stdout', content: String(text) }) },
        setTimeout, clearTimeout, setInterval, clearInterval, setImmediate,
        performance,
        crypto: globalThis.crypto,
        XMLHttpRequest: FakeXhr,
        importScripts() {},
        postMessage(message) {
            sent.push(message);
            for (const waiter of waiters.slice()) waiter(message);
        },
        TextDecoder, TextEncoder,
        WebAssembly,
        URL,
        location: { href: 'https://example.test/worker.js' }
    };
    sandbox.self = sandbox;
    sandbox.window = undefined;
    vm.createContext(sandbox);
    vm.runInContext(
        fs.readFileSync(path.join(dist, 'subtitles-octopus-worker.js'), 'utf8'),
        sandbox,
        { filename: 'subtitles-octopus-worker.js' }
    );

    const worker = {
        sandbox,
        sent,
        fontLoads,
        send(data) { sandbox.onmessage({ data }); },
        waitFor(predicate, ms = 20000) {
            const hit = sent.find(predicate);
            if (hit) return Promise.resolve(hit);
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    waiters.splice(waiters.indexOf(waiter), 1);
                    reject(new Error('timed out; last messages: ' + JSON.stringify(sent.slice(-5)).slice(0, 600)));
                }, ms);
                const waiter = (message) => {
                    if (!predicate(message)) return;
                    clearTimeout(timer);
                    waiters.splice(waiters.indexOf(waiter), 1);
                    resolve(message);
                };
                waiters.push(waiter);
            });
        },
        request(target, data = {}) {
            const before = sent.length;
            worker.send({ target, ...data });
            return worker.waitFor((m) => m.target === target && sent.indexOf(m) >= before);
        }
    };

    worker.send({
        target: 'worker-init',
        preMain: true,
        width: 640,
        height: 360,
        subContent: options.subContent || ASS,
        fonts: [],
        renderMode: 'wasm-blend',
        availableFonts: options.availableFonts || {},
        fallbackFont: 'default.woff2',
        libassMemoryLimit: options.libassMemoryLimit || 0,
        libassGlyphLimit: options.libassGlyphLimit || 0
    });
    return worker;
}

async function ready(options) {
    const worker = startWorker(options);
    await worker.waitFor((m) => m.target === 'ready');
    const deadline = Date.now() + 20000;
    while (!worker.sandbox.octObj) {
        if (Date.now() > deadline) throw new Error('worker did not start: ' + JSON.stringify(worker.sent.slice(-5)).slice(0, 500));
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return worker;
}

function stdout(worker) {
    return worker.sent.filter((m) => m.target === 'stdout').map((m) => m.content);
}

test('removeStyle frees the style and leaves the events alone', async () => {
    const worker = await ready();
    const eventsBefore = (await worker.request('get-events')).events;
    const stylesBefore = (await worker.request('get-styles')).styles;
    const second = stylesBefore.findIndex((s) => s.Name === 'Second');
    assert.notEqual(second, -1);

    worker.send({ target: 'remove-style', index: second });
    const stylesAfter = (await worker.request('get-styles')).styles;
    const eventsAfter = (await worker.request('get-events')).events;

    // libass frees the name string but keeps the slot, so the read-back is no longer the old name.
    assert.notEqual(stylesAfter[second].Name, 'Second', 'style Second is freed');
    assert.deepEqual(eventsAfter.map((e) => e.Text), eventsBefore.map((e) => e.Text), 'events are untouched');
});

test('a track libass cannot parse reports an error and the worker keeps answering', async () => {
    const worker = await ready();
    const before = (await worker.request('get-events')).events.length;
    assert.ok(before > 0);

    worker.send({ target: 'set-track', content: '' });
    await worker.waitFor((m) => m.target === 'track-error');

    const events = await worker.request('get-events');
    assert.ok(Array.isArray(events.events), 'worker still answers after the bad track');
    worker.send({ target: 'set-track', content: ASS });
    const after = (await worker.request('get-events')).events;
    assert.equal(after.length, before, 'a good track loads again');
});

test('memory limits stay in force after a new track is loaded', async () => {
    const worker = await ready({ libassMemoryLimit: 32, libassGlyphLimit: 16 });
    const before = stdout(worker).filter((l) => l.includes('setting total libass memory limits')).length;
    assert.equal(before, 1, 'limits applied at startup');

    worker.send({ target: 'set-track', content: ASS });
    await worker.request('get-events');
    const after = stdout(worker).filter((l) => l.includes('setting total libass memory limits')).length;
    assert.equal(after, 2, 'limits applied again to the renderer made for the new track');
});

test('fonts named only by inline \\fn tags load when a track is set', async () => {
    const worker = await ready({ availableFonts: { inlineonlyfont: 'blob:inline-font' } });
    const loaded = [];
    worker.sandbox.self.loadFontFile = (id, url) => loaded.push(url);

    worker.send({ target: 'set-track', content: INLINE_FONT_ASS });
    await worker.request('get-events');
    assert.deepEqual(loaded, ['blob:inline-font']);
});
