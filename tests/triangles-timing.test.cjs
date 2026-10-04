const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');

// Exercise the production callbacks without needing a GPU or a browser clock.
const source = readFileSync(new URL('../assets/js/triangles.js', `file://${__filename}`), 'utf8');
const callbacks = source.slice(source.indexOf('  function tick(now)'), source.indexOf('  async function webgpu()'));
function loop() {
  const context = vm.createContext({requestAnimationFrame: () => 1, cancelAnimationFrame() {}});
  vm.runInContext(`
    let frame = 0, last = null, time = 0, nextFrame = null;
    let paused = false, hidden = false, renderer = true;
    const frameInterval = 1000 / 60;
    const draws = [];
    function draw() { draws.push({at: last, time}); }
    function updatePointer() {}
    ${callbacks}
    globalThis.run = now => tick(now);
    globalThis.reset = () => sync();
    globalThis.draws = draws;
  `, context);
  return context;
}

test('a late callback does not suppress the next healthy frame', () => {
  const clock = loop();
  [0, 1000 / 60, 52, 4000 / 60, 5000 / 60].forEach(clock.run);
  assert.equal(clock.draws.length, 5);
  assert.equal(clock.draws[3].at, 4000 / 60);
});

test('60 fps cap holds across common refresh rates over a minute', () => {
  for (const hz of [60, 72, 120, 144]) {
    const clock = loop();
    for (let i = 0; i < hz * 60; i++) clock.run(i * 1000 / hz);
    assert.ok(Math.abs(clock.draws.length - 3600) <= 1, `${hz} Hz: ${clock.draws.length} draws`);
    for (let i = 1; i < clock.draws.length; i++) {
      assert.ok(clock.draws[i].at - clock.draws[i - 1].at <= 1000 / 60 + 1000 / hz + .01);
    }
  }
});

test('a long interruption draws once and resumes without catch-up work', () => {
  const clock = loop();
  [0, 1000 / 60, 5052, 5066.6667].forEach(clock.run);
  assert.equal(clock.draws.length, 4);
  assert.ok(Math.abs(clock.draws[3].time - 5.0666667) < 1e-8);
});

test('resuming excludes paused time and renders immediately', () => {
  const clock = loop();
  clock.run(0); clock.run(1000 / 60);
  clock.reset(); clock.run(10000);
  assert.equal(clock.draws.length, 3);
  assert.ok(Math.abs(clock.draws[2].time - 1 / 60) < 1e-8);
});

