/* eslint-disable no-param-reassign */
const test = require('ava');

const fs = require('fs-extra');
const path = require('path');
const proxyquire = require('proxyquire');
const clonedeep = require('lodash.clonedeep');

const {
  getMessageGranules,
  getStackName,
  getParentArn,
  getAsyncOperationId
} = require('../message');

const cumulusMessageAdapter = proxyquire('../index', {
  lookpath: () => false
});
const { downloadCMA } = require('./adapter');

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
  const paramInputGranuleInputJson = path.join(__dirname,
    'fixtures/messages/parameterized.input_granule.input.json');
  testContext.paramInputGranuleInputJson = JSON.parse(fs.readFileSync(paramInputGranuleInputJson));
});

test.after.always('final cleanup', () => {
  if (process.env.LOCAL_CMA_ZIP_FILE) {
    return Promise.resolve();
  }
  return Promise.all([
    fs.remove(testContext.src),
    fs.remove(testContext.dest)
  ]);
});

test.afterEach(() => {
  process.env.USE_CMA_BINARY = 'true';
});

test.serial('Execution is set when parameterized configuration is set', async(t) => {
  const businessLogic = () => Promise.resolve(process.env.EXECUTIONS);
  const expectedOutput = 'execution_value';
  const actual = await cumulusMessageAdapter.runCumulusTask(
    businessLogic, testContext.paramInputEvent, {}
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
      {}
    );
    t.deepEqual(expectedOutput, actual);
  });

test.serial('The businessLogic receives the correct arguments', async(t) => {
  const context = { b: 2 };

  const expectedNestedEvent = {
    input: testContext.inputEvent.payload,
    config: testContext.inputEvent.task_config
  };

  function businessLogic(actualNestedEvent, actualContext) {
    t.deepEqual(actualNestedEvent, expectedNestedEvent);
    t.deepEqual(actualContext, context);
    return 42;
  }

  try {
    await cumulusMessageAdapter
      .runCumulusTask(businessLogic, testContext.inputEvent, context);
  } catch {
    console.log('oh no it is horrible');
  }
});

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
    {}
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
    {}
  ),
  { message: 'oh snap', name: 'Error' });
});

test.serial('A promise returns an error', async(t) => {
  function businessLogic() {
    return Promise.reject(new Error('oh no'));
  }

  await t.throwsAsync(cumulusMessageAdapter.runCumulusTask(businessLogic,
    testContext.inputEvent, {}),
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
    testContext.inputEvent, {});
  t.deepEqual(expectedOutput, actual);
});

test.serial('The task receives the cumulus_config property', async(t) => {
  const context = { b: 2 };

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


test.serial('GetMessageGranules returns empty array if no granules are found', (t) => {
  const messageGranules = getMessageGranules(testContext.inputEvent);

  t.deepEqual(messageGranules, []);
});

test.serial('GetMessageGranules returns granules if they are in the payload', (t) => {
  const messageGranules = getMessageGranules(testContext.granuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017'
  ]);
});

test.serial('GetMessageGranules returns granules if they are in the meta.input_granules', (t) => {
  const messageGranules = getMessageGranules(testContext.inputGranuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017'
  ]);
});

test.serial('GetMessageGranules returns CMA granules if they are in the CMA event payload', (t) => {
  const messageGranules = getMessageGranules(testContext.paramGranuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017'
  ]);
});

test.serial('GetMessageGranules returns granules if they are in the CMA event meta.input_granules',
  (t) => {
    const messageGranules = getMessageGranules(testContext.paramInputGranuleInputJson);

    t.deepEqual(messageGranules, [
      'MOD09GQ.A2016358.h13v04.006.2016360104606',
      'MOD09GQ.A2016358.h13v04.007.2017'
    ]);
  });

test.serial('GetMessageGranules truncates granules over the specified limit', (t) => {
  const inputGranules = Array(5).fill().map((e, i) => ({ granuleId: `granule-${i}` }));
  const message = { payload: { granules: inputGranules } };

  const messageGranules = getMessageGranules(message, 3);

  t.deepEqual(messageGranules, [
    'granule-0',
    'granule-1',
    'granule-2'
  ]);
});

test.serial('GetStackName returns a stack name if the stack is in the meta', (t) => {
  const stack = getStackName(testContext.inputEvent);

  t.is(stack, 'cumulus-stack');
});

test.serial('GetStackName returns a stack name if the stack is in the CMA event meta', (t) => {
  const stack = getStackName(testContext.paramInputEvent);

  t.is(stack, 'cumulus-stack');
});

test.serial('GetParentArn returns a parent arn if the parentArn is in the cumulus_meta', (t) => {
  const arn = getParentArn(testContext.inputEvent);

  t.is(arn,
    'arn:aws:states:us-east-1:12345:execution:DiscoverGranules:8768aebb');
});

test.serial('GetParentArn returns a parent arn if the parentArn is in the CMA event cumulus_meta',
  (t) => {
    const arn = getParentArn(testContext.paramInputEvent);

    t.is(arn,
      'arn:aws:states:us-east-1:12345:execution:DiscoverGranules:8768aebb');
  });

// eslint-disable-next-line max-len
test.serial('GetAsyncOperationId returns an async operation id if the asyncOperationId is in the cumulus_meta', (t) => {
  const asyncOperationId = getAsyncOperationId(testContext.inputEvent);

  t.is(asyncOperationId, 'async-id-123');
});

// eslint-disable-next-line max-len
test.serial('GetAsyncOperationId returns an async operation id if the asyncOperationId is in the CMA event cumulus_meta', (t) => {
  const asyncOperationId = getAsyncOperationId(testContext.paramInputEvent);

  t.is(asyncOperationId, 'async-id-123');
});

test.serial('generateCMASpawnArguments uses packaged python if no system python', async(t) => {
  const messageAdapterDir = process.env.CUMULUS_MESSAGE_ADAPTER_DIR || './cumulus-message-adapter';
  const command = 'foobar';
  const result = await cumulusMessageAdapter.generateCMASpawnArguments(command);
  t.is(result[0], `${messageAdapterDir}/cma_bin/cma`);
  t.deepEqual(result[1], [command]);
});
