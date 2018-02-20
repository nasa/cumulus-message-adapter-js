const cumulusMessageAdapter = require('@cumulus/cumulus-message-adapter-js');

/**
 * The function containing the actual code of your task.
 *
 * @param {Object} nestedEvent - a translated and validated Cumulus event
 * @param {Object} context - a Lambda context
 * @returns {Object} - what you would like the handler_response property of
 *   the response message to be set to
 */
function myBusinessLogic(nestedEvent, context) {
  console.log('Hello, example!');
  console.log('Nested Event:', nestedEvent);
  console.log('Context:', context);

  return { answer: 42 };
}

/**
 * This is a standard Lambda handler function.
 *
 * There are very few cases where your actual handler function should be any
 * more than this one line.  Any actual work performed by the task should
 * be defined in a separate function.
 *
 * @param {Object} event - an incoming Lambda event
 * @param {Object} context - a Lambda context
 * @param {Function} cb - the Lambda callback
 * @returns {undefined} - there is no return value from this function, but
 *   the callback function specified by Lambda will be invoked with either an
 *   error or a full Cumulus message containing the result of the business
 *   logic function.
 */
function handler(event, context, cb) {
  const schemas = { input: 'input.json' };
  cumulusMessageAdapter.runCumulusTask(myBusinessLogic, event, context, cb, schemas);
}
exports.handler = handler;
