const test = require('ava').serial;
const clonedeep = require('lodash.clonedeep');
const fs = require('fs-extra');
const path = require('path');

const cumulusMessageAdapter = require('../dist/index');
const { downloadCMA } = require('./adapter');

const handlerContext = { getRemainingTimeInMillis: () => Promise.resolve(10000) };

// store test context data
const testContext = {};

test.before(async() => {
  testContext.dir = path.join(__dirname, 'alternate-dir');
  fs.mkdirpSync(testContext.dir);

  // download and unzip the message adapter
  await downloadCMA(testContext.dir, testContext.dir);

  const inputJson = path.join(__dirname, 'fixtures/messages/basic.input.json');
  testContext.inputEvent = JSON.parse(fs.readFileSync(inputJson));
  const outputJson = path.join(__dirname, 'fixtures/messages/basic.output.json');
  testContext.outputEvent = JSON.parse(fs.readFileSync(outputJson));
  process.env.USE_CMA_BINARY = 'true';
});

test.after.always('final cleanup', () => fs.remove(testContext.dir));

test('CUMULUS_MESSAGE_ADAPTER_DIR sets the location of the message adapter', async(t) => {
  const dir = path.join(__dirname, 'alternate-dir', 'cumulus-message-adapter');
  process.env.CUMULUS_MESSAGE_ADAPTER_DIR = dir;

  const businessLogicOutput = 42;
  const businessLogic = async() => businessLogicOutput;

  // assign task output from the lambda
  const expectedOutput = clonedeep(testContext.outputEvent);
  expectedOutput.payload = businessLogicOutput;

  const result = await cumulusMessageAdapter.runCumulusTask(
    businessLogic,
    testContext.inputEvent,
    handlerContext
  );
  t.deepEqual(result, expectedOutput);
});

test('callback returns error if CUMULUS_MESSAGE_ADAPTER_DIR is incorrect', async(t) => {
  const dir = path.join(__dirname, 'wrong-dir', 'cumulus-message-adapter');
  process.env.CUMULUS_MESSAGE_ADAPTER_DIR = dir;

  const businessLogicOutput = 42;
  const businessLogic = async() => businessLogicOutput;

  const inputEvent = { a: 1 };

  await t.throwsAsync(
    cumulusMessageAdapter.runCumulusTask(
      businessLogic,
      inputEvent,
      handlerContext
    )
  );
});
