/* eslint-disable no-param-reassign */
const test = require('ava').serial;

const fs = require('fs-extra');
const path = require('path');
const clonedeep = require('lodash.clonedeep');

const cumulusMessageAdapter = require('../index');
const { downloadCMA, extractZipFile } = require('./adapter');

// store test context data
const testContext = {};

test.before(async() => {
  const srcdir = __dirname;
  const destdir = path.join(__dirname, '../');
  // download and unzip the message adapter
  if (process.env.LOCAL_CMA_ZIP_FILE) {
    const dest = path.join(destdir, 'cumulus-message-adapter');
    await extractZipFile(process.env.LOCAL_CMA_ZIP_FILE, dest)
  }
  else {
    const { src, dest } = await downloadCMA(srcdir, destdir);
    testContext.src = src;
    testContext.dest = dest;
  }

  const inputJson = path.join(__dirname, 'fixtures/messages/basic.input.json');
  testContext.inputEvent = JSON.parse(fs.readFileSync(inputJson));
  const executionInputJson = path.join(__dirname, 'fixtures/messages/execution.input.json');
  testContext.executionInput = JSON.parse(fs.readFileSync(executionInputJson));
  const paramInputJson = path.join(__dirname, 'fixtures/messages/parameterized.input.json');
  testContext.paramInputEvent = JSON.parse(fs.readFileSync(paramInputJson));
  const outputJson = path.join(__dirname, 'fixtures/messages/basic.output.json');
  testContext.outputEvent = JSON.parse(fs.readFileSync(outputJson));
});

test.after.always('final cleanup', () => {
  if(process.env.LOCAL_CMA_ZIP_FILE) {
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
  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.paramInputEvent, {}, callback);
});

test.cb('Execution is set when cumulus_meta has an execution value', (t) => {
  const businessLogic = () => Promise.resolve(process.env.EXECUTIONS);
  const expectedOutput = 'execution_value';
  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data.payload, expectedOutput);
    t.end();
  }
  return cumulusMessageAdapter.runCumulusTask(businessLogic, testContext.paramInputEvent, {}, callback);
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
