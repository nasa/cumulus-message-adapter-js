import { Context } from 'aws-lambda';
import { CumulusMessage, CumulusRemoteMessage } from '@cumulus/types/message';
import { lookpath } from 'lookpath';
import * as readline from 'readline';
import childProcess from 'child_process';

import {
  getAsyncOperationId,
  getExecutions,
  getMessageGranules,
  getParentArn,
  getStackName,
} from './message';

import {
  CMAMessage,
  CumulusMessageAdapterError,
  CumulusMessageWithAssignedPayload,
  InvokeCumulusMessageAdapterResult,
  LoadNestedEventInput,
} from './types';

import {
  isCMAMessage,
  isCumulusMessageWithAssignedPayload,
  isLoadNestedEventInput,
} from './typeGuards';

/**
 * An error to be thrown when invocation of the cumulus-message-adapter fails
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
export async function invokeCumulusMessageAdapter(): Promise<InvokeCumulusMessageAdapterResult> {
  const spawnArguments = await generateCMASpawnArguments('stream');
  const errorObj = { stderrBuffer: '' };
  const statusObj = { close: false };
  try {
    const cmaProcess = childProcess.spawn(...spawnArguments);
    cmaProcess.on('error', () => {
      console.log(`CMA (on error) StdErr: \n ${errorObj.stderrBuffer}`);
    });
    cmaProcess.stdin.setDefaultEncoding('utf8');
    cmaProcess.stdout.setEncoding('utf8');
    cmaProcess.stderr.setEncoding('utf8');
    cmaProcess.on('close', (code, signal) => {
      if (code !== 0) {
        console.log(`CMA Exit Code: ${code}`);
        console.log(`CMA Exit Signal: ${signal}`);
        console.log(`CMA Process Kill: ${cmaProcess.killed}`);
        console.log(`CMA StdErr: \n ${errorObj.stderrBuffer}\n`);
      }
      statusObj.close = true;
    });
    cmaProcess.stderr.on('data', (data) => {
      errorObj.stderrBuffer += String(data);
    });
    return { cmaProcess, errorObj, statusObj };
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
 * @param {string | undefined} value - value to set variable to if not undefined
 * @returns {undefined} - none
 */
function safeSetEnv(VARNAME: string, value?: string): void {
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
function setCumulusEnvironment(
  cumulusMessage: CumulusMessageWithAssignedPayload,
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
): Promise<CumulusMessageWithAssignedPayload | LoadNestedEventInput | CumulusRemoteMessage> {
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
 * Build a nested Cumulus event and pass it to a tasks's business function
 *
 * @param {Function} TaskFunction - the function containing the business logic of the task
 * @param {Object} cumulusMessage - either a full Cumulus Message or a Cumulus Remote Messag
 *                                  or a workflow configured CMAMessage
 *                                  containing a Cumulus Message in it's event
 * @param {Object} context - an AWS Lambda context
 * @param {string} schemas - Location of schema files, defaults to null.
 * @returns {Promise<Object>} - The response from the call to createNextEvent
 */
export async function runCumulusTask(
  TaskFunction: Function,
  cumulusMessage: CumulusMessage | CumulusRemoteMessage | CMAMessage,
  context: Context,
  schemas: string | null = null
): Promise<CumulusMessageWithAssignedPayload | CumulusRemoteMessage> {
  const { cmaProcess, errorObj, statusObj } = await invokeCumulusMessageAdapter();
  const cmaStdin = cmaProcess.stdin;
  const rl = readline.createInterface({
    input: cmaProcess.stdout,
  });

  let lambdaTimer;
  let runningTask = false;

  if (typeof context.getRemainingTimeInMillis === 'function') {
    lambdaTimer = setTimeout(() => {
      console.log('Lambda timing out, writing CMA stderr to cloudwatch logs');
      console.log(`CMA (on start task timeout) StdErr: \n ${errorObj.stderrBuffer}`);
    }, context.getRemainingTimeInMillis() - 5 * 100);
  } else {
    console.log(
      'Info: No CMA timeout buffer dump set, as lambda is not running as a lambda'
    );
    lambdaTimer = setTimeout(() => {
    }, 0);
  }

  try {
    cmaStdin.write('loadAndUpdateRemoteEvent\n');
    cmaStdin.write(JSON.stringify({
      event: cumulusMessage,
      context,
      schemas,
    }));
    cmaStdin.write('\n<EOC>\n');
    const loadAndUpdateRemoteEventOutput = await getCmaOutput(rl, errorObj);
    if (!isCumulusMessageWithAssignedPayload(loadAndUpdateRemoteEventOutput)) {
      throw new Error(`Invalid output typing received from
      loadAndUpdateRemoteEvent ${JSON.stringify(loadAndUpdateRemoteEventOutput)}`);
    }
    setCumulusEnvironment(loadAndUpdateRemoteEventOutput, context);
    cmaStdin.write('loadNestedEvent\n');
    cmaStdin.write(JSON.stringify({
      event: loadAndUpdateRemoteEventOutput,
      schemas,
      context,
    }));
    cmaStdin.write('\n<EOC>\n');
    const loadNestedEventOutput = await getCmaOutput(rl, errorObj);
    if (!isLoadNestedEventInput(loadNestedEventOutput)) {
      throw new Error(`Invalid output typing received from
      loadNestedEvent ${JSON.stringify(loadNestedEventOutput)}`);
    }
    console.log('Starting task function');
    runningTask = true;
    const taskOutput = await TaskFunction(loadNestedEventOutput, context);
    runningTask = false;
    console.log('Starting task function finished');

    cmaStdin.write('createNextEvent\n');
    cmaStdin.write(JSON.stringify({
      event: loadAndUpdateRemoteEventOutput,
      handler_response: taskOutput,
      message_config: loadNestedEventOutput.messageConfig,
      schemas,
    }));
    cmaStdin.write('\n<EOC>\n');
    const createNextEventOutput = await getCmaOutput(rl, errorObj);
    cmaStdin.write('<EXIT>\n');
    if (isLoadNestedEventInput(createNextEventOutput)) {
      throw new Error(`Invalid typing received from
      createNextEventOutput: ${JSON.stringify(createNextEventOutput)}`);
    }
    const returnVal = createNextEventOutput;
    return returnVal;
  } catch (error) {
    try {
      if (!runningTask) {
        cmaStdin.write('\n');
      }
      cmaStdin.write('<EXIT>\n');
      if (!cmaProcess.kill('SIGTERM')) {
        cmaProcess.kill('SIGKILL');
      }
    } catch (e) {
      console.log(`CMA process failed to kill on task failure: ${JSON.stringify(e)}`);
    }
    if (error?.name?.includes('WorkflowError') && (!isCMAMessage(cumulusMessage))) {
      return {
        ...cumulusMessage, payload: null, exception: error.name,
      } as CumulusMessageWithAssignedPayload;
    }

    // Wait for .close process event to complete before throwing
    let waitIterations = 0;
    while (!statusObj.close && waitIterations < 20) {
      console.log('Waiting up to 2 seconds for CMA child process to exit');
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
      waitIterations += 1;
    }
    throw error;
  } finally {
    clearTimeout(lambdaTimer);
  }
}
