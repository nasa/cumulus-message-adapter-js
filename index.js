'use strict';

const cp = require('child_process');
const get = require('lodash.get');

const GRANULE_LOG_LIMIT = 500;

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
    const adapterDir = process.env.CUMULUS_MESSAGE_ADAPTER_DIR || './cumulus-message-adapter';
    const cumulusMessageAdapter = cp.spawn('python', [adapterDir, command]);

    // Collect STDOUT
    let cumulusMessageAdapterStdout = '';
    cumulusMessageAdapter.stdout.on('data', (chunk) => {
      cumulusMessageAdapterStdout += chunk;
    });

    // Collect STDERR
    let cumulusMessageAdapterStderr = '';
    cumulusMessageAdapter.stderr.on('data', (chunk) => {
      cumulusMessageAdapterStderr += chunk;
    });

    cumulusMessageAdapter.on('close', (code) => {
      if (code === 0) resolve(JSON.parse(cumulusMessageAdapterStdout));
      else reject(new CumulusMessageAdapterExecutionError(cumulusMessageAdapterStderr));
    });

    // If STDIN is closed already, something went wrong.  Don't handle it
    // here and expect a non-zero code when the close event fires.
    // If this line is not present, calling sled.stdin.end with a chunk will
    // result in an unhandled "Error: write EPIPE".
    cumulusMessageAdapter.stdin.on('error', () => {});

    cumulusMessageAdapter.stdin.end(JSON.stringify(input));
  });
}

/**
 * If a Cumulus Remote Message is passed, fetch it and return a full Cumulus
 * Message with updated task metadata.
 *
 * @param {Object} cumulusMessage - either a full Cumulus Message or a Cumulus Remote Message
 * @param {Object} context - an AWS Lambda context
 * @param {string} schemaLocations - contains location of schema files, can be null
 * @returns {Promise.<Object>} - a full Cumulus Message
 */
function loadAndUpdateRemoteEvent(cumulusMessage, context, schemaLocations) {
  return callCumulusMessageAdapter('loadAndUpdateRemoteEvent', {
    event: cumulusMessage,
    context,
    schemas: schemaLocations
  });
}

/**
 * Query AWS to create a task-specific event
 *
 * @param {Object} cumulusMessage - a full Cumulus Message
 * @param {Object} context - an AWS Lambda context
 * @param {string} schemaLocations - contains location of schema files, can be null
 * @returns {Promise.<Object>} - an Object containing the keys input, config and messageConfig
 */
function loadNestedEvent(cumulusMessage, context, schemaLocations) {
  return callCumulusMessageAdapter('loadNestedEvent', {
    event: cumulusMessage,
    schemas: schemaLocations,
    context
  });
}

/**
 * Create a new Cumulus message with the output of this task
 *
 * @param {Object} handlerResponse - the return value of the task function
 * @param {Object} cumulusMessage - a full Cumulus Message
 * @param {Object} messageConfig - the value of the messageConfig key returned by loadNestedEvent
 * @param {string} schemaLocations - contains location of schema files, can be null
 * @returns {Promise.<Object>} - a Cumulus Message or a Cumulus Remote Message
 */
function createNextEvent(handlerResponse, cumulusMessage, messageConfig, schemaLocations) {
  const input = {
    event: cumulusMessage,
    handler_response: handlerResponse
  };

  // If input.message_config is undefined, JSON.stringify will drop the key.
  // If it is instead set to null, the key is retained and the value is null.
  input.message_config = messageConfig || null;
  input.schemas = schemaLocations;

  return callCumulusMessageAdapter('createNextEvent', input);
}

/**
 * Invoke the task function and wrap the result as a Promise
 *
 * @param {Function} taskFunction - the task function to be invoked
 * @param {Object} cumulusMessage - a full Cumulus message
 * @param {Object} context - the Lambda context
 * @returns {Promise} - the result of invoking the task function
 */
function invokePromisedTaskFunction(taskFunction, cumulusMessage, context) {
  return new Promise((resolve, reject) => {
    try {
      resolve(taskFunction(cumulusMessage, context));
    }
    catch (err) {
      reject(err);
    }
  });
}

/**
 * Get granules from execution message.
 *   Uses the order of precedence as defined by the cumulus/common/message
 *   description.
 *
 * @param {Object} message - An execution message
 * @param {integer} granuleLimit - number of granules to limit the log to
 * including, to avoid environment variable truncation
 * @returns {Array<Object>} - An array of granule ids
 */
function getMessageGranules(message, granuleLimit = GRANULE_LOG_LIMIT) {
  const granules = get(message, 'payload.granules')
    || get(message, 'meta.input_granules')
    || get(message, 'cma.event.payload.granules')
    || get(message, 'cma.event.meta.input_granules');

  if (granules) {
    return granules.slice(0, granuleLimit)
      .map((granule) => granule.granuleId);
  }

  return [];
}

/**
 * Get the stackname pulled from the meta of the event.
 *
 * @param {Object} message - A cumulus event message.
 * @returns {string} - The cumulus stack name.
 */
function getStackName(message) {
  return get(message, 'meta.stack')
    || get(message, 'cma.event.meta.stack');
}

/**
 * Gets parent arn from execution message.
 *
 * @param {Object} message - An execution message.
 * @returns {string} - the parent execution.
 */
function getParentArn(message) {
  return get(message, 'cumulus_meta.parentExecutionArn')
    || get(message, 'cma.event.cumulus_meta.parentExecutionArn');
}

/**
 * Get current execution name from Cumulus message.
 *
 * @param {Object} message - Cumulus message.
 * @returns {string} current execution name.
 */
function getExecutions(message) {
  return get(message, 'cumulus_meta.execution_name')
    || get(message, 'cma.event.cumulus_meta.execution_name');
}


/**
 * Conditionally set environment variable when targeted value is not undefined.
 *
 * @param {string} VARNAME - environment variable name
 * @param {string} value - value to set variable to if not undefined
 * @returns {undefined} - none
 */
function safeSetEnv(VARNAME, value) {
  if (value !== undefined) process.env[VARNAME] = value;
}

/**
 * Set environment variables to be used in logging based on the Cumulus event
 * message and context that runCumulusTask was invoked.
 *
 * @param {Object} cumulusMessage - cumulus event message
 * @param {Object} context - lambda context object.
 * @returns {undefined} - no return values
 */
function setCumulusEnvironment(cumulusMessage, context) {
  safeSetEnv('EXECUTIONS', getExecutions(cumulusMessage));
  safeSetEnv('SENDER', context.functionName);
  safeSetEnv('TASKVERSION', context.functionVersion);
  safeSetEnv('STACKNAME', getStackName(cumulusMessage));
  safeSetEnv('GRANULES', JSON.stringify(getMessageGranules(cumulusMessage)));
  safeSetEnv('PARENTARN', getParentArn(cumulusMessage));
}

/**
 * Build a nested Cumulus event and pass it to a tasks's business function
 *
 * @param {Function} taskFunction - the function containing the business logic of the task
 * @param {Object} cumulusMessage - either a full Cumulus Message or a Cumulus Remote Message
 * @param {Object} context - an AWS Lambda context
 * @param {Function} callback - the callback to be called when the taskFunction
 *   has completed.  This should be the callback passed to the Lambda handler.
 * @param {string} schemas - Location of schema files, defaults to null.
 * @returns {undefined} - there is no return value from this function, but
 *   the callback function will be invoked with either an error or a full
 *   Cumulus message containing the result of the business logic function.
 */
function runCumulusTask(taskFunction, cumulusMessage, context, callback, schemas = null) {
  let promisedNextEvent;
  setCumulusEnvironment(cumulusMessage, context);
  if (process.env.CUMULUS_MESSAGE_ADAPTER_DISABLED === 'true') {
    promisedNextEvent = invokePromisedTaskFunction(
      taskFunction,
      cumulusMessage,
      context
    );
  }
  else {
    const promisedRemoteEvent = loadAndUpdateRemoteEvent(cumulusMessage, context, schemas);
    const promisedNestedEvent = promisedRemoteEvent.then((event) => {
      // Reset the environment with what we can grab from the event from S3
      setCumulusEnvironment(event, context);
      return loadNestedEvent(event, context, schemas);
    });

    const promisedTaskOutput = promisedNestedEvent
      .then((nestedEvent) => taskFunction(nestedEvent, context));

    promisedNextEvent = Promise.all([promisedTaskOutput, promisedRemoteEvent, promisedNestedEvent])
      .then((resolvedPromises) => createNextEvent(
        resolvedPromises[0],
        resolvedPromises[1],
        resolvedPromises[2].messageConfig,
        schemas
      ));
  }

  promisedNextEvent
    .then((nextEvent) => callback(null, nextEvent))
    .catch((err) => {
      if (err.name && err.name.includes('WorkflowError')) {
        callback(null, { ...cumulusMessage, payload: null, exception: err.name });
      }
      else callback(err);
    });
}
exports.runCumulusTask = runCumulusTask;
