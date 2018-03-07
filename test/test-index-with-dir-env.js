/* eslint-disable require-jsdoc */

const path = require('path');

const test = require('ava').serial;
const cumulusMessageAdapter = require('../index');

test.cb('CUMULUS_MESSAGE_ADAPTER_DIR sets the location of the message adapter', (t) => {
  const dir = path.join(__dirname, 'alternate-dir', 'cumulus-message-adapter');
  process.env.CUMULUS_MESSAGE_ADAPTER_DIR = dir;

  const businessLogicOutput = 42;
  const businessLogic = () => businessLogicOutput;

  const inputEvent = { a: 1 };

  const expectedOutput = {
    event: {
      event: inputEvent,
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
