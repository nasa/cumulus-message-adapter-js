'use strict';

const cp = require('child_process');

/**
 * An error to be thrown when invokation of the cumulus-message-adapter fails
 */
class CumulusMessageAdapterExecutionError extends Error {
  // eslint-disable-next-line require-jsdoc
  constructor(message, fileName, lineNumber) {
    super(message, fileName, lineNumber);
    this.name = 'CumulusMessageAdapterExecutionError';
  }
}

/**
 * Invoke the cumulus-message-adapter
 *
 * @param {string} command - the action to be performed by the message-adapter
 * @param {Object} input - the input to be sent to the message-adapter
 * @returns {Promise.<Object>} - the output of the message-adapter
 */
function callCumulusMessageAdapter(command, input) {
  return new Promise((resolve, reject) => {
    const sled = cp.spawn('python', ['./cumulus-message-adapter.zip', command]);

    // Collect STDOUT
    let sledStdout = '';
    sled.stdout.on('data', (chunk) => {
      sledStdout += chunk;
    });

    // Collect STDERR
    let sledStderr = '';
    sled.stderr.on('data', (chunk) => {
      sledStderr += chunk;
    });

    sled.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(sledStdout));
      else reject(new CumulusMessageAdapterExecutionError(sledStderr));
    });

    // If STDIN is closed already, something went wrong.  Don't handle it
    // here and expect a non-zero code when the close event fires.
    // If this line is not present, calling sled.stdin.end with a chunk will
    // result in an unhandled "Error: write EPIPE".
    sled.stdin.on('error', () => {});

    sled.stdin.end(JSON.stringify(input));
  });
}

/**
 * If a Cumulus Remote Message is passed, fetch it and return a full Cumulus Message
 *
 * @param {Object} cumulusMessage - either a full Cumulus Message or a Cumulus Remote Message
 * @returns {Promise.<Object>} - a full Cumulus Message
 */
function loadRemoteEvent(cumulusMessage) {
  return callCumulusMessageAdapter('loadRemoteEvent', { event: cumulusMessage });
}

/**
 * Query AWS to create a task-specific event
 *
 * @param {Object} cumulusMessage - a full Cumulus Message
 * @param {Object} context - an AWS Lambda context
 * @returns {Promise.<Object>} - an Object containing the keys input, config and messageConfig
 */
function loadNestedEvent(cumulusMessage, context) {
  return callCumulusMessageAdapter('loadNestedEvent', {
    event: cumulusMessage,
    context
  });
}

/**
 * Create a new Cumulus message with the output of this task
 *
 * @param {Object} handlerResponse - the return value of the task function
 * @param {Object} cumulusMessage - a full Cumulus Message
 * @param {Object} messageConfig - the value of the messageConfig key returned by loadNestedEvent
 * @returns {Promise.<Object>} - a Cumulus Message or a Cumulus Remote Message
 */
function createNextEvent(handlerResponse, cumulusMessage, messageConfig) {
  return callCumulusMessageAdapter(
    'createNextEvent',
    {
      event: cumulusMessage,
      handler_response: handlerResponse,
      message_config: messageConfig
    }
  );
}

/**
 * Build a nested Cumulus event and pass it to a tasks's business function
 *
 * @param {Function} taskFunction - the function containing the business logic of the task
 * @param {Object} cumulusMessage - either a full Cumulus Message or a Cumulus Remote Message
 * @param {Object} context - an AWS Lambda context
 * @param {Function} callback - the callback to be called when the taskFunction
 *   has completed.  This should be the callback passed to the Lambda handler.
 * @returns {Promise} - resolves when the task has completed
 */
function runCumulusTask(taskFunction, cumulusMessage, context, callback) {
  const promisedRemoteEvent = loadRemoteEvent(cumulusMessage);
  const promisedNestedEvent = promisedRemoteEvent.then((event) => loadNestedEvent(event, context));
  const promisedTaskOutput = promisedNestedEvent
    .then((nestedEvent) => taskFunction(nestedEvent, context));

  return Promise.all([promisedTaskOutput, promisedRemoteEvent, promisedNestedEvent])
    .then((resolvedPromises) =>
      createNextEvent(resolvedPromises[0], resolvedPromises[1], resolvedPromises[2].messageConfig))
    .then((nextEvent) => callback(null, nextEvent))
    .catch((err) => {
      if (err.name && err.name.includes('WorkflowError')) {
        callback(null, Object.assign({}, cumulusMessage, { payload: null, exception: err.name }));
      }
      else callback(err);
    });
}
exports.runCumulusTask = runCumulusTask;
