/* eslint-disable require-jsdoc */

const test = require('ava');
const cumulusMessageAdapter = require('../index');

test('CUMULUS_MESSAGE_ADAPTER_DISABLED="true" bypasses the message adapter', (t) => {
  process.env.CUMULUS_MESSAGE_ADAPTER_DISABLED = 'true';

  const inputEvent = { a: 1 };
  const context = { b: 2 };

  function businessLogic(actualNestedEvent, actualContext) {
    t.deepEqual(actualNestedEvent, inputEvent);
    t.deepEqual(actualContext, context);

    return { result: 42 };
  }

  function callback(err, data) {
    t.is(err, null);
    t.deepEqual(data, { result: 42 });
  }

  return cumulusMessageAdapter.runCumulusTask(businessLogic, inputEvent, context, callback);
});
