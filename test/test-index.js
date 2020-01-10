/* eslint-disable no-param-reassign */
const test = require('ava').serial;

const fs = require('fs-extra');
const path = require('path');
const clonedeep = require('lodash.clonedeep');
const rewire = require('rewire');

const cumulusMessageAdapter = rewire('../index');
const { downloadCMA } = require('./adapter');

const cmaRewire = rewire('../index');
const getMessageGranules = cmaRewire.__get__(
  'getMessageGranules'
);
const getStackName = cmaRewire.__get__(
  'getStackName'
);
const getParentArn = cmaRewire.__get__(
  'getParentArn'
);
const getAsyncOperationId = cmaRewire.__get__(
  'getAsyncOperationId'
);

// store test context data
const testContext = {};

test.before(async() => {
  const srcdir = __dirname;
  const destdir = path.join(__dirname, '../');
  // download and unzip the message adapter
  const { src, dest } = await downloadCMA(srcdir, destdir);
  testContext.src = src;
  testContext.dest = dest;

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


test.cb('Execution is set when parameterized configuration is set', (t) => {
  const businessLogic = () => Promise.resolve(process.env.EXECUTIONS);
  const expectedOutput = 'execution_value';
  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data.payload, expectedOutput);
    t.end();
  }
  return cumulusMessageAdapter.runCumulusTask(
    businessLogic, testContext.paramInputEvent, {}, callback
  );
});

test.cb('Execution is set when cumulus_meta has an execution value', (t) => {
  const businessLogic = () => Promise.resolve(process.env.EXECUTIONS);
  const expectedOutput = 'execution_value';
  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data.payload, expectedOutput);
    t.end();
  }
  return cumulusMessageAdapter.runCumulusTask(
    businessLogic, testContext.paramInputEvent, {}, callback
  );
});


test.cb('Correct cumulus message is returned when task returns a promise that resolves', (t) => {
  const businessLogicOutput = 42;
  const businessLogic = () => Promise.resolve(businessLogicOutput);

  const expectedOutput = clonedeep(testContext.outputEvent);
  expectedOutput.payload = businessLogicOutput;

  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data, expectedOutput);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.inputEvent, {}, callback);
});


test.cb('The businessLogic receives the correct arguments', (t) => {
  const context = { b: 2 };

  const expectedNestedEvent = {
    input: testContext.inputEvent.payload,
    config: testContext.inputEvent.workflow_config[testContext.inputEvent.cumulus_meta.task]
  };

  function businessLogic(actualNestedEvent, actualContext) {
    t.deepEqual(actualNestedEvent, expectedNestedEvent);
    t.deepEqual(actualContext, context);
    return 42;
  }

  return cumulusMessageAdapter
    .runCumulusTask(businessLogic, testContext.inputEvent, context, t.end);
});


test.cb('A WorkflowError is returned properly', (t) => {
  const expectedOutput = clonedeep(testContext.outputEvent);
  expectedOutput.payload = null;
  expectedOutput.exception = 'SomeWorkflowError';

  function businessLogic() {
    const error = new Error('Oh snap');
    error.name = 'SomeWorkflowError';
    throw error;
  }

  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data, expectedOutput);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.inputEvent, {}, callback);
});

test.cb('A non-WorkflowError is raised', (t) => {
  function businessLogic() {
    throw new Error('oh snap');
  }

  function callback(err, data) {
    t.is(err.name, 'Error');
    t.is(err.message, 'oh snap');
    t.is(data, undefined);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.inputEvent, {}, callback);
});

test.cb('A promise returns an error', (t) => {
  function businessLogic() {
    return Promise.reject(new Error('oh no'));
  }

  function callback(err, data) {
    t.is(err.name, 'Error');
    t.is(err.message, 'oh no');
    t.is(data, undefined);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.inputEvent, {}, callback);
});

test.cb('A Promise WorkflowError is returned properly', (t) => {
  const expectedOutput = clonedeep(testContext.outputEvent);
  expectedOutput.payload = null;
  expectedOutput.exception = 'SomeWorkflowError';

  function businessLogic() {
    const error = new Error('Oh no');
    error.name = 'SomeWorkflowError';
    return Promise.reject(error);
  }

  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data, expectedOutput);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.inputEvent, {}, callback);
});

test.cb('The task receives the cumulus_config property', (t) => {
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

  return cumulusMessageAdapter
    .runCumulusTask(businessLogic, inputEvent, context, t.end);
});

test('GetMessageGranules returns empty array if no granules are found', (t) => {
  const messageGranules = getMessageGranules(testContext.inputEvent);

  t.deepEqual(messageGranules, []);
});

test('GetMessageGranules returns granules if they are in the payload', (t) => {
  const messageGranules = getMessageGranules(testContext.granuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017'
  ]);
});

test('GetMessageGranules returns granules if they are in the meta.input_granules', (t) => {
  const messageGranules = getMessageGranules(testContext.inputGranuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017'
  ]);
});

test('GetMessageGranules returns CMA granules if they are in the CMA event payload', (t) => {
  const messageGranules = getMessageGranules(testContext.paramGranuleInputJson);

  t.deepEqual(messageGranules, [
    'MOD09GQ.A2016358.h13v04.006.2016360104606',
    'MOD09GQ.A2016358.h13v04.007.2017'
  ]);
});

test('GetMessageGranules returns granules if they are in the CMA event meta.input_granules',
  (t) => {
    const messageGranules = getMessageGranules(testContext.paramInputGranuleInputJson);

    t.deepEqual(messageGranules, [
      'MOD09GQ.A2016358.h13v04.006.2016360104606',
      'MOD09GQ.A2016358.h13v04.007.2017'
    ]);
  });

test('GetMessageGranules truncates granules over the specified limit', (t) => {
  const inputGranules = Array(5).fill().map((e, i) => ({ granuleId: `granule-${i}` }));
  const message = { payload: { granules: inputGranules } };

  const messageGranules = getMessageGranules(message, 3);

  t.deepEqual(messageGranules, [
    'granule-0',
    'granule-1',
    'granule-2'
  ]);
});

test('GetStackName returns a stack name if the stack is in the meta', (t) => {
  const stack = getStackName(testContext.inputEvent);

  t.is(stack, 'cumulus-stack');
});

test('GetStackName returns a stack name if the stack is in the CMA event meta', (t) => {
  const stack = getStackName(testContext.paramInputEvent);

  t.is(stack, 'cumulus-stack');
});

test('GetParentArn returns a parent arn if the parentArn is in the cumulus_meta', (t) => {
  const arn = getParentArn(testContext.inputEvent);

  t.is(arn,
    'arn:aws:states:us-east-1:12345:execution:DiscoverGranules:8768aebb');
});

test('GetParentArn returns a parent arn if the parentArn is in the CMA event cumulus_meta', (t) => {
  const arn = getParentArn(testContext.paramInputEvent);

  t.is(arn,
    'arn:aws:states:us-east-1:12345:execution:DiscoverGranules:8768aebb');
});

// eslint-disable-next-line max-len
test('GetAsyncOperationId returns an async operation id if the asyncOperationId is in the cumulus_meta', (t) => {
  const asyncOperationId = getAsyncOperationId(testContext.inputEvent);

  t.is(asyncOperationId, 'async-id-123');
});

// eslint-disable-next-line max-len
test('GetAsyncOperationId returns an async operation id if the asyncOperationId is in the CMA event cumulus_meta', (t) => {
  const asyncOperationId = getAsyncOperationId(testContext.paramInputEvent);

  t.is(asyncOperationId, 'async-id-123');
});

test('callCumulusMessageAdapter throws a readable error on schema failure', async(t) => {
  const callCumulusMessageAdapter = cumulusMessageAdapter.__get__('callCumulusMessageAdapter');
  const result = await t.throwsAsync(() => callCumulusMessageAdapter('loadNestedEvent', {
    event: testContext.inputEvent,
    schemas: { input: './test/fixtures/schemas/error_schema/input.json' },
    context: {}
  }));
  t.regex(result.message, new RegExp('Failed validating \'required\' in schema'));
});

test('generateCMASpawnArguments uses packaged python if no system python', async(t) => {
  const generateCMASpawnArguments = cumulusMessageAdapter.__get__('generateCMASpawnArguments');
  const revert = cumulusMessageAdapter.__set__('lookpath', () => false);
  const command = 'foobar';
  const result = await generateCMASpawnArguments(command);
  revert();
  t.regex(result[0], new RegExp('\/cma$'));
});

test('generateCMASpawnArguments uses system python', async(t) => {
  const generateCMASpawnArguments = cumulusMessageAdapter.__get__('generateCMASpawnArguments');
  const revert = cumulusMessageAdapter.__set__('lookpath', () => '/foo/bar/python');
  const command = 'foobar';
  const result = await generateCMASpawnArguments(command);
  revert();
  t.regex(result[0], new RegExp('/foo/bar/python$'));
});
