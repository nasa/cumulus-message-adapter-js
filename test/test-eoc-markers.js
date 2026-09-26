/* eslint-disable no-restricted-syntax */
const test = require('ava');
const { spawnSync } = require('child_process');
const path = require('path');

for (const stage of ['load', 'nested', 'next']) {
  for (const [name, data] of [
    ['ordinary', { text: 'ordinary value' }],
    ['marker', { text: 'before <EOC> after' }],
    ['repeated', { text: '<EOC><EOC>', nested: ['x<EOC>y'] }],
    ['key', { '<EOC>': 'value', text: 'café \"quoted\"' }],
  ]) {
    for (const pretty of [false, true]) {
      test(`${stage} preserves ${name} in ${pretty ? 'multiline' : 'compact'} JSON`, (t) => {
        const runner = path.join(__dirname, 'fixtures/eoc-runner.js');
        const result = spawnSync(process.execPath, [runner], {
          encoding: 'utf8',
          timeout: 10000,
          env: {
            ...process.env,
            USE_CMA_BINARY: 'false',
            CUMULUS_MESSAGE_ADAPTER_DIR: path.join(__dirname, 'fixtures/eoc-adapter.js'),
            CMA_TEST_STAGE: stage,
            CMA_TEST_DATA: JSON.stringify(data),
            CMA_TEST_PRETTY: pretty ? '1' : '0',
          },
        });
        t.falsy(result.error);
        t.is(result.status, 0, result.stderr);
        const line = result.stdout.split('\n').find((entry) => entry.startsWith('RESULT='));
        t.truthy(line);
        const output = JSON.parse(line.slice('RESULT='.length));
        t.deepEqual(output.payload, data);
        t.deepEqual(output.taskInput, stage === 'next' ? { ordinary: true } : data);
      });
    }
  }
}

for (const command of ['loadAndUpdateRemoteEvent', 'loadNestedEvent', 'createNextEvent']) {
  test(`invalid JSON from ${command} rejects the task instead of crashing Node`, (t) => {
    const result = spawnSync(process.execPath,
      [path.join(__dirname, 'fixtures/eoc-error-runner.js')], {
        encoding: 'utf8',
        timeout: 10000,
        env: {
          ...process.env,
          USE_CMA_BINARY: 'false',
          CUMULUS_MESSAGE_ADAPTER_DIR: path.join(__dirname, 'fixtures/eoc-adapter.js'),
          CMA_TEST_STAGE: 'none',
          CMA_TEST_DATA: '{}',
          CMA_TEST_INVALID: command,
        },
      });
    t.falsy(result.error);
    t.is(result.status, 0, result.stderr);
    const line = result.stdout.split('\n').find((entry) => entry.startsWith('RESULT='));
    t.is(JSON.parse(line.slice('RESULT='.length)).name, 'SyntaxError');
  });
}

test('an adapter closing during the task rejects with its execution error and stderr', (t) => {
  const result = spawnSync(process.execPath,
    [path.join(__dirname, 'fixtures/eoc-error-runner.js')], {
      encoding: 'utf8',
      timeout: 10000,
      env: {
        ...process.env,
        USE_CMA_BINARY: 'false',
        CUMULUS_MESSAGE_ADAPTER_DIR: path.join(__dirname, 'fixtures/eoc-adapter.js'),
        CMA_TEST_STAGE: 'none',
        CMA_TEST_DATA: '{}',
        CMA_TEST_EXIT: 'loadNestedEvent',
      },
    });
  t.falsy(result.error);
  t.is(result.status, 0, result.stderr);
  const line = result.stdout.split('\n').find((entry) => entry.startsWith('RESULT='));
  t.truthy(line, 'the task must settle rather than exiting with a pending promise');
  const error = JSON.parse(line.slice('RESULT='.length));
  t.is(error.name, 'CumulusMessageAdapterExecutionError');
  t.true(error.message.includes('synthetic adapter failure'));
});
