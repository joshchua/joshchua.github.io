const {test} = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const source = readFileSync(new URL('../assets/js/triangles.js', `file://${__filename}`), 'utf8');
const helper = source.slice(source.indexOf('  function backgroundSize('), source.indexOf('  function createEngine('));
const size = vm.runInNewContext(helper + '; backgroundSize');
test('background density and pixel budget hold across screen shapes and DPRs', () => {
  for (const [width, height] of [[390,844], [832,803], [1920,1080], [2560,1440], [3840,2160], [5120,1440]]) {
    for (const pixelRatio of [1, 1.25, 2, 3]) {
      const result = size({width,height,pixelRatio});
      assert.ok(result.width * result.height <= 500000);
      assert.ok(result.ratio <= .75 && result.ratio <= pixelRatio);
      assert.ok(Math.abs(result.width - width * result.ratio) < 1);
      assert.ok(Math.abs(result.height - height * result.ratio) < 1);
    }
  }
});
