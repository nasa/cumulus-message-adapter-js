'use strict';

const childProcess = require('child_process');
const get = require('lodash.get');
const { lookpath } = require('lookpath');
const readline = require('readline');

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
 * Generates CMA command line arguments
 *
 * @param {string} command - the action to be performed by the message-adapter
 * @returns {Promise.<Array>} - Returns arguments used to spawn the CMA
 */
async function generateCMASpawnArguments(command) {
  const adapterDir = process.env.CUMULUS_MESSAGE_ADAPTER_DIR || './cumulus-message-adapter';
  const systemPython = await lookpath('python');
  if (systemPython) {
    return [systemPython, [`${adapterDir}`, command]];
  }
  // If there is no system python, attempt use of pre-packaged CMA binary
  return [`${adapterDir}/cma`, [command]];
}


/**
 * Invoke the cumulus-message-adapter
 *

 * @returns {Promise.<Object>} - the output of the message-adapter
 */
async function invokeCumulusMessageAdapter() {
  const spawnArguments = await generateCMASpawnArguments('stream');
  try {
    // Would like to use sindresorhus's lib, however
    // https://github.com/sindresorhus/execa/issues/411
    // and related mean that pulling in the childProcess
    // is hacky.   Using node native for now, should revisit
    // the results #414 in the future.
    const cumulusMessageAdapter = childProcess.spawn(...spawnArguments);
    cumulusMessageAdapter.stdin.setEncoding = 'utf8';
    cumulusMessageAdapter.stdout.setEncoding = 'utf8';
    cumulusMessageAdapter.stderr.setEncoding = 'utf8';
    cumulusMessageAdapter.stdin.on('error', () => { });
    return cumulusMessageAdapter;
  }
  catch (error) {
    const msg = `CMA process failed (${error.shortMessage})\n
                 Trace: ${error.message}}\n\n\n
                 STDERR: ${error.stderr}`;
    throw new CumulusMessageAdapterExecutionError(msg);
  }
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
 * Get current async operation id from Cumulus message.
 *
 * @param {Object} message - Cumulus message.
 * @returns {string} asyncOperationId or null
 */
function getAsyncOperationId(message) {
  return get(message, 'cumulus_meta.asyncOperationId')
    || get(message, 'cma.event.cumulus_meta.asyncOperationId');
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
  safeSetEnv('ASYNCOPERATIONID', getAsyncOperationId(cumulusMessage));
}


// eslint-disable-next-line require-jsdoc
function runCumulusTask(taskFunction, cumulusMessage, context,
  callback, schemas = null) {
  setCumulusEnvironment(cumulusMessage, context);
  if (process.env.CUMULUS_MESSAGE_ADAPTER_DISABLED === 'true') {
    invokePromisedTaskFunction(
      taskFunction,
      cumulusMessage,
      context
    ).then((nextEvent) => callback(null, nextEvent));
  }
  else {
    invokeCumulusMessageAdapter().then((messageAdapter) => {
      let stderr = '';
      messageAdapter.on('close', () => {
        console.log('closing');
        if (messageAdapter.exitCode !== 0) {
          callback(new CumulusMessageAdapterExecutionError(stderr));
        }
      });
      messageAdapter.stderr.on('data', (data) => {
        stderr += String(data);
      });
      const events = {};
      let loadEventBuffer = '';
      const cma = messageAdapter;

      const rl = readline.createInterface({
        input: cma.stdout
      });

      // eslint-disable-next-line require-jsdoc
      const cne = (cneRl, cneCma, handlerResponse, message,
        messageConfig, cneSchemas) => {
        let buffer = '';
        rl.resume();
        cneCma.stdin.write('createNextEvent\n');
        cneCma.stdin.write(JSON.stringify({
          event: message,
          handler_response: handlerResponse,
          message_config: messageConfig,
          cneSchemas
        }));
        cneCma.stdin.write('\n<EOC>\n');
        cneRl.on('line', (input) => {
          if (input.endsWith('<EOC>')) {
            cneRl.pause();
            const endInput = input.replace('<EOC>', '');
            buffer += `${endInput}`;
            const cmaOutput = JSON.parse(buffer);
            callback(null, cmaOutput);
          }
          buffer += `${input}\n`;
        });
      };

      // eslint-disable-next-line require-jsdoc
      const lne = (lneRl, lneCma, output, lneContext, lneSchemas) => {
        setCumulusEnvironment(output, lneContext);
        let buffer = '';
        lneRl.resume();
        lneCma.stdin.write('loadNestedEvent\n');
        lneCma.stdin.write(JSON.stringify({
          event: output,
          lneSchemas,
          lneContext
        }));
        lneCma.stdin.write('\n<EOC>\n');
        lneRl.on('line', (input) => {
          if (input.endsWith('<EOC>')) {
            lneRl.pause();
            rl.removeAllListeners('line');
            const endInput = input.replace('<EOC>', '');
            buffer += `${endInput}`;
            const cmaOutput = JSON.parse(buffer);
            events.loadNestedEvent = cmaOutput;
            invokePromisedTaskFunction(taskFunction, cmaOutput, context).then((taskOutput) => {
              // taskFunction(cmaOutput, lneContext).then((taskOutput) => {
              events.taskOutput = taskOutput;
              cne(lneRl, lneCma,
                events.taskOutput, events.loadAndUpdateRemoteEvent,
                events.loadNestedEvent.messageConfig, schemas);
            }).catch((err) => {
              if (err.name && err.name.includes('WorkflowError')) {
                callback(null, { ...cumulusMessage, payload: null, exception: err.name });
              }
              callback(err);
            });
          }
          buffer += `${input}\n`;
        });
      };
      rl.on('line', (input) => {
        if (input.endsWith('<EOC>')) {
          rl.pause();
          rl.removeAllListeners('line');
          const endInput = input.replace('<EOC>', '');
          loadEventBuffer += `${endInput}`;
          const cmaOutput = JSON.parse(loadEventBuffer);
          events.loadAndUpdateRemoteEvent = cmaOutput;
          lne(rl, cma, cmaOutput, context, schemas);
        }
        loadEventBuffer += `${input}\n`;
      });

      cma.stdin.write('loadAndUpdateRemoteEvent\n');
      cma.stdin.write(JSON.stringify({
        event: cumulusMessage,
        context,
        schemas
      }));
      cma.stdin.write('\n<EOC>\n');
    });
  }
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
 *//*
function runCumulusTask(taskFunction, cumulusMessage, context, callback, schemas = null) {
  console.log('Running cumulus task');
  setCumulusEnvironment(cumulusMessage, context);
  let promisedNextEvent;
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
} */
exports.runCumulusTask = runCumulusTask;
// exports.callCumulusMessageAdapter = callCumulusMessageAdapter;
// DEPRECATE
exports.invokeCumulusMessageAdapter = invokeCumulusMessageAdapter;
