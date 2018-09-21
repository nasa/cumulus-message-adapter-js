const test = require('ava').serial;
const clonedeep = require('lodash.clonedeep');
const fs = require('fs-extra');
const path = require('path');

const cumulusMessageAdapter = require('../index');
const { downloadCMA } = require('./adapter');

// store test context data
const testContext = {};

test.before(async() => {
  testContext.dir = path.join(__dirname, 'alternate-dir');
  fs.mkdirpSync(testContext.dir);

  // download and unzip the message adapter
  const { src, dest } = await downloadCMA(testContext.dir, testContext.dir);

  const inputJson = path.join(__dirname, 'fixtures/messages/basic.input.json');
  testContext.inputEvent = JSON.parse(fs.readFileSync(inputJson));
  const outputJson = path.join(__dirname, 'fixtures/messages/basic.output.json');
  testContext.outputEvent = JSON.parse(fs.readFileSync(outputJson));
});

test.after.always('final cleanup', () =>
  fs.remove(testContext.dir)
);

test.cb('CUMULUS_MESSAGE_ADAPTER_DIR sets the location of the message adapter', (t) => {
  const dir = path.join(__dirname, 'alternate-dir', 'cumulus-message-adapter');
  process.env.CUMULUS_MESSAGE_ADAPTER_DIR = dir;

  const businessLogicOutput = 42;
  const businessLogic = () => businessLogicOutput;

  // assign task output from the lambda
  const expectedOutput = clonedeep(testContext.outputEvent);
  expectedOutput.payload = businessLogicOutput;

  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data, expectedOutput);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.inputEvent, {}, callback);
});

test.cb('callback returns error if CUMULUS_MESSAGE_ADAPTER_DIR is incorrect', (t) => {
  const dir = path.join(__dirname, 'wrong-dir', 'cumulus-message-adapter');
  process.env.CUMULUS_MESSAGE_ADAPTER_DIR = dir;

  const businessLogicOutput = 42;
  const businessLogic = () => businessLogicOutput;

  const inputEvent = { a: 1 };

  function callback(err, data) {
    t.is(typeof err, 'object');
    t.is(err.name, 'CumulusMessageAdapterExecutionError');
    t.is(data, undefined);
    t.end();
  }

  cumulusMessageAdapter.runCumulusTask(businessLogic, inputEvent, {}, callback);
});
