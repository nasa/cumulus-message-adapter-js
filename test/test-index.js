const test = require('ava');
const cumulusMessageAdapter = require('../index');

test.cb('The correct cumulus message is returned', (t) => {
  const businessLogicOutput = 42;
  const businessLogic = () => businessLogicOutput;

  const inputEvent = { a: 1 };

  const expectedOutput = {
    event: {
      event: inputEvent,
      context: {},
      schemas: null
    },
    handler_response: businessLogicOutput,
    message_config: null,
    schemas: null
  };

  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data, expectedOutput);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, inputEvent, {}, callback);
});

test.cb('Correct cumulus message is returned when task returns a promise that resolves', (t) => {
  const businessLogicOutput = 42;
  const businessLogic = () => Promise.resolve(businessLogicOutput);

  const inputEvent = { a: 1 };

  const expectedOutput = {
    event: {
      event: inputEvent,
      context: {},
      schemas: null
    },
    handler_response: businessLogicOutput,
    message_config: null,
    schemas: null
  };

  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data, expectedOutput);
    t.end();
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, inputEvent, {}, callback);
});

test.cb('The businessLogic receives the correct arguments', (t) => {
  const inputEvent = { a: 1 };
  const context = { b: 2 };

  const expectedNestedEvent = {
    event: { event: { a: 1 }, context: {}, schemas: null },
    schemas: null,
    context: { b: 2 }
  };

  function businessLogic(actualNestedEvent, actualContext) {
    t.deepEqual(actualNestedEvent, expectedNestedEvent);
    t.deepEqual(actualContext, context);
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, inputEvent, context, t.end);
});

test.cb('A WorkflowError is returned properly', (t) => {
  const inputEvent = { a: 1 };

  const expectedOutput = {
    a: 1,
    payload: null,
    exception: 'SomeWorkflowError'
  };

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

  return cumulusMessageAdapter.runCumulusTask(businessLogic, inputEvent, {}, callback);
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

  return cumulusMessageAdapter.runCumulusTask(businessLogic, {}, {}, callback);
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

  return cumulusMessageAdapter.runCumulusTask(businessLogic, {}, {}, callback);
});

test.cb('A Promise WorkflowError is returned properly', (t) => {
  const inputEvent = { a: 1 };

  const expectedOutput = {
    a: 1,
    payload: null,
    exception: 'SomeWorkflowError'
  };

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

  return cumulusMessageAdapter.runCumulusTask(businessLogic, inputEvent, {}, callback);
});
