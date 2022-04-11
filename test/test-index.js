/* eslint-disable no-param-reassign */
const test = require('ava');

const fs = require('fs-extra');
const path = require('path');
const proxyquire = require('proxyquire');
const clonedeep = require('lodash.clonedeep');
const cumulusMessageAdapter = proxyquire('../dist/index', {
  lookpath: () => false,
});
const { downloadCMA } = require('./adapter');
const handlerContext = { getRemainingTimeInMillis: () => 100000 };
// store test context data
const testContext = {};

test.before(async() => {
  const srcdir = __dirname;
  const destdir = path.join(__dirname, '../');
  // download and unzip the message adapter
  const { src, dest } = await downloadCMA(srcdir, destdir);
  testContext.src = src;
  testContext.dest = dest;
  process.env.CUMULUS_MESSAGE_ADAPTER_DIR = `${dest}`;

  process.env.USE_CMA_BINARY = 'true';
  const inputJson = path.join(__dirname, 'fixtures/messages/basic.input.json');
  testContext.inputEvent = JSON.parse(fs.readFileSync(inputJson));
  const executionInputJson = path.join(__dirname, 'fixtures/messages/execution.input.json');
  testContext.executionInput = JSON.parse(fs.readFileSync(executionInputJson));
  const paramInputJson = path.join(__dirname, 'fixtures/messages/parameterized.input.json');
  testContext.paramInputEvent = JSON.parse(fs.readFileSync(paramInputJson));
  const granuleInputJson = path.join(__dirname, 'fixtures/messages/execution.granule.input.json');
  testContext.granuleInputJson = JSON.parse(fs.readFileSync(granuleInputJson));
  const inputGranuleInputJson = path.join(__dirname,
    'fixtures/messages/execution.granule.input.json');
  testContext.inputGranuleInputJson = JSON.parse(fs.readFileSync(inputGranuleInputJson));
  const outputJson = path.join(__dirname, 'fixtures/messages/basic.output.json');
  testContext.outputEvent = JSON.parse(fs.readFileSync(outputJson));
  const paramGranuleInputJson = path.join(__dirname,
    'fixtures/messages/parameterized.granule.input.json');
  testContext.paramGranuleInputJson = JSON.parse(fs.readFileSync(paramGranuleInputJson));
});

test.after.always('final cleanup', () => {
  if (process.env.LOCAL_CMA_ZIP_FILE) {
    return Promise.resolve();
  }
  return Promise.all([
    fs.remove(testContext.src),
    fs.remove(testContext.dest),
  ]);
});

test.afterEach(() => {
  process.env.USE_CMA_BINARY = 'true';
});

test.serial('Execution is set when parameterized configuration is set', async(t) => {
  const businessLogic = () => Promise.resolve(process.env.EXECUTIONS);
  const expectedOutput = 'execution_value';
  const actual = await cumulusMessageAdapter.runCumulusTask(
    businessLogic, testContext.paramInputEvent, handlerContext
  );
  t.is(expectedOutput, actual.payload);
});

test.serial('Correct cumulus message is returned when task returns a promise that resolves',
  async(t) => {
    const businessLogicOutput = 42;
    const businessLogic = () => Promise.resolve(businessLogicOutput);

    const expectedOutput = clonedeep(testContext.outputEvent);
    expectedOutput.payload = businessLogicOutput;

    const actual = await cumulusMessageAdapter.runCumulusTask(
      businessLogic,
      testContext.inputEvent,
      handlerContext
    );
    t.deepEqual(expectedOutput, actual);
  });

test.serial('The businessLogic receives the correct arguments', async(t) => {
  const context = { ...handlerContext, b: 2 };

  const expectedNestedEvent = {
    input: testContext.inputEvent.payload,
    config: testContext.inputEvent.task_config,
  };

  function businessLogic(actualNestedEvent, actualContext) {
    t.deepEqual(actualNestedEvent, expectedNestedEvent);
    t.deepEqual(actualContext, context);
    return 42;
  }
  await cumulusMessageAdapter
    .runCumulusTask(businessLogic, testContext.inputEvent, context);
});

test.serial(
  'businessLogic receives expected args when lambda context is missing getRemainingTimeInMillis',
  async(t) => {
    const context = { b: 2 };

    const expectedNestedEvent = {
      input: testContext.inputEvent.payload,
      config: testContext.inputEvent.task_config,
    };

    function businessLogic(actualNestedEvent, actualContext) {
      t.deepEqual(actualNestedEvent, expectedNestedEvent);
      t.deepEqual(actualContext, context);
      return 42;
    }
    await cumulusMessageAdapter.runCumulusTask(
      businessLogic,
      testContext.inputEvent,
      context
    );
  }
);

test.serial('A WorkflowError is returned properly', async(t) => {
  const expectedOutput = clonedeep(testContext.outputEvent);
  expectedOutput.payload = null;
  expectedOutput.exception = 'SomeWorkflowError';

  function businessLogic() {
    const error = new Error('Oh snap');
    error.name = 'SomeWorkflowError';
    throw error;
  }
  const actual = await cumulusMessageAdapter.runCumulusTask(
    businessLogic,
    testContext.inputEvent,
    handlerContext
  );
  t.deepEqual(expectedOutput, actual);
});

test.serial('A non-WorkflowError is raised', async(t) => {
  function businessLogic() {
    throw new Error('oh snap');
  }
  await t.throwsAsync(cumulusMessageAdapter.runCumulusTask(
    businessLogic,
    testContext.inputEvent,
    handlerContext
  ),
  { message: 'oh snap', name: 'Error' });
});

test.serial('A promise returns an error', async(t) => {
  function businessLogic() {
    return Promise.reject(new Error('oh no'));
  }

  await t.throwsAsync(cumulusMessageAdapter.runCumulusTask(businessLogic,
    testContext.inputEvent, handlerContext),
  { name: 'Error', message: 'oh no' });
});

test.serial('A Promise WorkflowError is returned properly', async(t) => {
  const expectedOutput = clonedeep(testContext.outputEvent);
  expectedOutput.payload = null;
  expectedOutput.exception = 'SomeWorkflowError';

  function businessLogic() {
    const error = new Error('Oh no');
    error.name = 'SomeWorkflowError';
    return Promise.reject(error);
  }
  const actual = await cumulusMessageAdapter.runCumulusTask(businessLogic,
    testContext.inputEvent, handlerContext);
  t.deepEqual(expectedOutput, actual);
});

test.serial('The task receives the cumulus_config property', async(t) => {
  const context = { ...handlerContext, b: 2 };

  const inputEvent = clonedeep(testContext.inputEvent);
  inputEvent.cumulus_meta.cumulus_context = { anykey: 'anyvalue' };

  function businessLogic(actualNestedEvent, actualContext) {
    t.deepEqual(actualContext, context);
    t.deepEqual(
      actualNestedEvent.cumulus_config.cumulus_context,
      inputEvent.cumulus_meta.cumulus_context
    );
    return 42;
  }

  await cumulusMessageAdapter
    .runCumulusTask(businessLogic, inputEvent, context);
});

test.serial('generateCMASpawnArguments uses packaged python if no system python', async(t) => {
  const messageAdapterDir = process.env.CUMULUS_MESSAGE_ADAPTER_DIR || './cumulus-message-adapter';
  const command = 'foobar';
  const result = await cumulusMessageAdapter.generateCMASpawnArguments(command);
  t.is(result[0], `${messageAdapterDir}/cma_bin/cma`);
  t.deepEqual(result[1], [command]);
});
