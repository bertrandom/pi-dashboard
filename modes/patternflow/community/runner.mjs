// Frame server for Patternflow community patterns.
//
// Speaks newline-delimited JSON on stdin; replies on stdout with one JSON
// header line, followed for successful frames by W*H*3 bytes of raw RGB.
//   {"cmd":"load","file":"/abs/path.js"}        -> {"ok":true}
//   {"cmd":"frame","dt":0.033,"deltas":[..4],"pressed":[..4],"held":[..4]}
//                                               -> {"ok":true} + RGB bytes
// Any failure replies {"ok":false,"error":"..."} with no payload.
import fs from 'node:fs';
import readline from 'node:readline';
import { PatternRuntime } from './runtime.mjs';

const W = 128, H = 128;
let rt = null;

function reply(header, payload) {
  fs.writeSync(1, JSON.stringify(header) + '\n');
  if (payload) {
    let off = 0;
    while (off < payload.length) off += fs.writeSync(1, payload, off);
  }
}

function describe(e) {
  return e instanceof Error ? `${e.message}` : String(e);
}

const handlers = {
  load(msg) {
    rt = null;
    rt = new PatternRuntime(fs.readFileSync(msg.file, 'utf8'), W, H);
    reply({ ok: true });
  },
  frame(msg) {
    if (!rt) throw new Error('No pattern loaded.');
    const deltas = msg.deltas ?? [0, 0, 0, 0];
    deltas.forEach((d, i) => { if (d) rt.turnKnob(i, d); });
    const rgb = rt.frame(msg.dt ?? 0, deltas, msg.pressed, msg.held);
    reply({ ok: true }, rgb);
  },
};

readline.createInterface({ input: process.stdin }).on('line', line => {
  let msg;
  try {
    msg = JSON.parse(line);
    const fn = handlers[msg.cmd];
    if (!fn) throw new Error(`unknown command ${msg.cmd}`);
    fn(msg);
  } catch (e) {
    reply({ ok: false, error: describe(e) });
  }
}).on('close', () => process.exit(0));
