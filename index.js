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
  if (systemPython && process.env.USE_CMA_BINARY !== 'true') {
    return [systemPython, [`${adapterDir}`, command]];
  }
  // If there is no system python, attempt use of pre-packaged CMA binary
  return [`${adapterDir}/cma_bin/cma`, [command]];
}


/**
 * Invoke the cumulus-message-adapter
 *
 * @returns {Promise<Object>} cumulusMessageAdapterObject - Returns an Object with a
 * childprocess and a stderror buffer
 * @returns {Object} cumulusMessageAdapterObject.cumulusMessageAdapter - A CMA childProcess Object
 * @returns {string} cumulusMessageAdapterObject.errorObj -  A Object with the property
 *                                                           'stderrBuffer' to make the encapsulated
 *                                                           error event storage outside this method
 */
async function invokeCumulusMessageAdapter() {
  const spawnArguments = await generateCMASpawnArguments('stream');
  const errorObj = { stderrBuffer: '' };
  try {
    // Would like to use sindresorhus's lib, however
    // https://github.com/sindresorhus/execa/issues/411
    // and related mean that pulling in the childProcess
    // is hacky.   Using node native for now, should revisit
    // the results #414 in the future.
    const cmaProcess = childProcess.spawn(...spawnArguments);
    cmaProcess.on('error', () => {});
    cmaProcess.stdin.setEncoding = 'utf8';
    cmaProcess.stdout.setEncoding = 'utf8';
    cmaProcess.stderr.setEncoding = 'utf8';
    cmaProcess.on('close', () => {
      console.log(`CMA Exit Code: ${cmaProcess.exitCode} `);
      if (cmaProcess.exitCode !== 0) {
        console.log(`CMA Failure: ${errorObj.stderrBuffer}`);
      }
    });
    cmaProcess.stderr.on('data', (data) => {
      errorObj.stderrBuffer += String(data);
    });
    return { cmaProcess, errorObj };
  }
  catch (error) {
    const msg = `CMA process failed (${error.shortMessage})\n
                 Trace: ${error.message}}\n\n\n
                 STDERR: ${errorObj.stderrBuffer}`;
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

/**
 * Read the CMA output/results after sending a command
 *
 * @param {Object} readLine - configured readline object
 * @param {*} errorObj - cma errorObject with stderr string buffer
 * @returns {Promise<Object>} - Promise that resolves to a parsed JSON object
 *                              from the CMA output
 */
async function getCmaOutput(readLine, errorObj) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    readLine.resume();
    readLine.on('line', (input) => {
      if (input.endsWith('<EOC>')) {
        readLine.pause();
        readLine.removeAllListeners('line');
        const endInput = input.replace('<EOC>', '');
        buffer += endInput;
        resolve(JSON.parse(buffer));
      }
      else {
        buffer += input;
      }
    });
    readLine.on('close', () => {
      reject(new CumulusMessageAdapterExecutionError(errorObj.stderrBuffer));
    });
  });
}

/**
 * Build a nested Cumulus event and pass it to a tasks's business function
 *
 * @param {Function} taskFunction - the function containing the business logic of the task
 * @param {Object} cumulusMessage - either a full Cumulus Message or a Cumulus Remote Message
 * @param {Object} context - an AWS Lambda context
 * @param {string} schemas - Location of schema files, defaults to null.
 * @returns {Object} - The response from the call to createNextEvent or the taskFunction
 *                     depending on the CUMULUS_MESSAGE_ADAPTER_DISABLED environment variable
 */
async function runCumulusTask(taskFunction, cumulusMessage,
  context, schemas = null) {
  if (process.env.CUMULUS_MESSAGE_ADAPTER_DISABLED === 'true') {
    const functionReturn = await invokePromisedTaskFunction(
      taskFunction,
      cumulusMessage,
      context
    );
    return functionReturn;
  }
  try {
    const { cmaProcess, errorObj } = await invokeCumulusMessageAdapter();
    const cmaStdin = cmaProcess.stdin;
    const rl = readline.createInterface({
      input: cmaProcess.stdout
    });
    cmaStdin.write('loadAndUpdateRemoteEvent\n');
    cmaStdin.write(JSON.stringify({
      event: cumulusMessage,
      context,
      schemas
    }));
    cmaStdin.write('\n<EOC>\n');

    const loadAndUpdateRemoteEventOutput = await getCmaOutput(rl, errorObj);
    setCumulusEnvironment(loadAndUpdateRemoteEventOutput, context);
    cmaStdin.write('loadNestedEvent\n');
    cmaStdin.write(JSON.stringify({
      event: loadAndUpdateRemoteEventOutput,
      schemas,
      context
    }));
    cmaStdin.write('\n<EOC>\n');
    const loadNestedEventOutput = await getCmaOutput(rl, errorObj);
    const taskOutput = await invokePromisedTaskFunction(taskFunction,
      loadNestedEventOutput, context);
    cmaStdin.write('createNextEvent\n');
    cmaStdin.write(JSON.stringify({
      event: loadAndUpdateRemoteEventOutput,
      handler_response: taskOutput,
      message_config: loadNestedEventOutput.messageConfig,
      schemas
    }));
    cmaStdin.write('\n<EOC>\n');
    const createNextEventOutput = await getCmaOutput(rl, errorObj);
    cmaStdin.write('\n<EXIT>\n');
    return createNextEventOutput;
  }
  catch (error) {
    if (error.name && error.name.includes('WorkflowError')) {
      return { ...cumulusMessage, payload: null, exception: error.name };
    }
    throw error;
  }
}

exports.runCumulusTask = runCumulusTask;
exports.invokeCumulusMessageAdapter = invokeCumulusMessageAdapter;
