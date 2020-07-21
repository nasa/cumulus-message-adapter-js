import childProcess from 'child_process';
import { lookpath } from 'lookpath';
import * as readline from 'readline';
import { CumulusMessage, CumulusRemoteMessage } from '@cumulus/types/message';
import { Context } from 'aws-lambda';

import {
  getExecutions,
  getMessageGranules,
  getStackName,
  getParentArn,
  getAsyncOperationId
} from './message';

import {
  CumulusMessageAdapterError,
  InvokeCumulusMessageAdapterType,
  LoadNestedEventInput,
  CumulusMessageWithGranulesInPayload
} from './types';

/**
 * An error to be thrown when invokation of the cumulus-message-adapter fails
 */
class CumulusMessageAdapterExecutionError extends Error {
  // eslint-disable-next-line require-jsdoc
  constructor(message: string) {
    super(message);
    this.name = 'CumulusMessageAdapterExecutionError';
  }
}

/**
 * Generates CMA command line arguments
 *
 * @param {string} command - the action to be performed by the message-adapter
 * @returns {Promise.<Array>} - Returns arguments used to spawn the CMA
 */
export async function generateCMASpawnArguments(command: string): Promise<[string, string[]]> {
  const adapterDir = process.env.CUMULUS_MESSAGE_ADAPTER_DIR ?? './cumulus-message-adapter';
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
 * @returns {Object} cumulusMessageAdapterObject.cmaProcess - A CMA childProcess Object
 * @returns {Object} cumulusMessageAdapterObject.errorObj -  A Object with the property
 *                                                           'stderrBuffer' to make the encapsulated
 *                                                           error event storage outside this method
 */
export async function invokeCumulusMessageAdapter(): Promise<InvokeCumulusMessageAdapterType> {
  const spawnArguments = await generateCMASpawnArguments('stream');
  const errorObj = { stderrBuffer: '' };
  try {
    const cmaProcess = childProcess.spawn(...spawnArguments);
    cmaProcess.on('error', () => { });
    cmaProcess.stdin.setDefaultEncoding('utf8');
    cmaProcess.stdout.setEncoding('utf8');
    cmaProcess.stderr.setEncoding('utf8');
    cmaProcess.on('close', () => {
      // eslint-disable-next-line no-console
      console.log(`CMA Exit Code: ${cmaProcess.exitCode} `);
      if (cmaProcess.exitCode !== 0) {
        // eslint-disable-next-line no-console
        console.log(`CMA Failure: ${errorObj.stderrBuffer}`);
      }
    });
    cmaProcess.stderr.on('data', (data) => {
      errorObj.stderrBuffer += String(data);
    });
    return { cmaProcess, errorObj };
  } catch (error) {
    const msg = `CMA process failed (${error.shortMessage})\n
                 Trace: ${error.message}}\n\n\n
                 STDERR: ${errorObj.stderrBuffer}`;
    throw new CumulusMessageAdapterExecutionError(msg);
  }
}


/**
 * Conditionally set environment variable when targeted value is not undefined.
 *
 * @param {string} VARNAME - environment variable name
 * @param {string} value - value to set variable to if not undefined
 * @returns {undefined} - none
 */
function safeSetEnv(VARNAME: string, value: string): void {
  if (value !== undefined) process.env[VARNAME] = value;
}

// eslint-disable-next-line require-jsdoc
function isCumulusMessageWithGranulesInPayload(
  message:
  CumulusMessage |
  CumulusRemoteMessage |
  CumulusMessageWithGranulesInPayload |
  LoadNestedEventInput
): message is CumulusMessageWithGranulesInPayload {
  return (
    (message as CumulusMessageWithGranulesInPayload)?.payload !== undefined
    && (message as CumulusRemoteMessage)?.replace === undefined
    && (message as LoadNestedEventInput)?.input === undefined
    && (message as LoadNestedEventInput)?.config === undefined
  );
}

// eslint-disable-next-line require-jsdoc
function isLoadNestedEventInput(
  message: CumulusMessageWithGranulesInPayload | LoadNestedEventInput | CumulusRemoteMessage
): message is LoadNestedEventInput {
  return (
    (message as LoadNestedEventInput).input !== undefined
    && (message as LoadNestedEventInput).config !== undefined
  );
}


/**
 * Set environment variables to be used in logging based on the Cumulus event
 * message and context that runCumulusTask was invoked.
 *
 * @param {Object} cumulusMessage - cumulus event message
 * @param {Object} context - lambda context object.
 * @returns {undefined} - no return values
 */
function setCumulusEnvironment(
  cumulusMessage: CumulusMessageWithGranulesInPayload,
  context: Context
): void {
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
async function getCmaOutput(
  readLine: readline.ReadLine,
  errorObj: CumulusMessageAdapterError
): Promise<CumulusMessageWithGranulesInPayload | LoadNestedEventInput | CumulusRemoteMessage> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    readLine.resume();
    readLine.on('line', (input: string) => {
      if (input.endsWith('<EOC>')) {
        readLine.pause();
        readLine.removeAllListeners('line');
        const endInput = input.replace('<EOC>', '');
        buffer += endInput;
        resolve(JSON.parse(buffer));
      } else {
        buffer += input;
      }
    });
    readLine.on('close', () => {
      reject(new CumulusMessageAdapterExecutionError(errorObj.stderrBuffer));
    });
  });
}

/**
 * Invoke the task function and wrap the result as a Promise
 *
 * @param {Function} TaskFunction - the task function to be invoked
 * @param {Object} cumulusMessage - a full Cumulus message
 * @param {Object} context - the Lambda context
 * @returns {Promise} - the result of invoking the task function
 */
function invokePromisedTaskFunction(
  TaskFunction: (msg: LoadNestedEventInput, context: Context) => Promise<unknown>,
  cumulusMessage: LoadNestedEventInput,
  context: Context
) {
  return new Promise((resolve, reject) => {
    try {
      resolve(TaskFunction(cumulusMessage, context));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Build a nested Cumulus event and pass it to a tasks's business function
 *
 * @param {Function} TaskFunction - the function containing the business logic of the task
 * @param {Object} cumulusMessage - either a full Cumulus Message or a Cumulus Remote Message
 * @param {Object} context - an AWS Lambda context
 * @param {string} schemas - Location of schema files, defaults to null.
 * @returns {Promise<Object>} - The response from the call to createNextEvent or the TaskFunction
 *                     depending on the CUMULUS_MESSAGE_ADAPTER_DISABLED environment variable
 */
export async function runCumulusTask(
  TaskFunction: (msg: LoadNestedEventInput, context: Context) => Promise<unknown>,
  cumulusMessage: CumulusMessage | CumulusRemoteMessage,
  context: Context,
  schemas: string | null = null
): Promise<CumulusMessage | CumulusRemoteMessage> {
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
    if (!isCumulusMessageWithGranulesInPayload(loadAndUpdateRemoteEventOutput)) {
      throw new Error(`Invalid output typing recieved from
      loadAndUpdateRemoteEvent ${JSON.stringify(loadAndUpdateRemoteEventOutput)}`);
    }
    setCumulusEnvironment(loadAndUpdateRemoteEventOutput, context);
    cmaStdin.write('loadNestedEvent\n');
    cmaStdin.write(JSON.stringify({
      event: loadAndUpdateRemoteEventOutput,
      schemas,
      context
    }));
    cmaStdin.write('\n<EOC>\n');
    const loadNestedEventOutput = await getCmaOutput(rl, errorObj);
    if (!isLoadNestedEventInput(loadNestedEventOutput)) {
      throw new Error(`Invalid output typing recieved from
      loadNestedEvent ${JSON.stringify(loadNestedEventOutput)}`);
    }
    const taskOutput = await invokePromisedTaskFunction(TaskFunction,
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
    if (isLoadNestedEventInput(createNextEventOutput)) {
      throw new Error(`Invalid typing recieved from
      createNextEventOutput: ${JSON.stringify(createNextEventOutput)}`);
    }
    return createNextEventOutput;
  } catch (error) {
    if (error.name && error.name.includes('WorkflowError')) {
      const returnObject = cumulusMessage;
      returnObject.payload = null;
      returnObject.exception = error.name;
      return { ...cumulusMessage, payload: null, exception: error.name };
    }
    throw error;
  }
}
