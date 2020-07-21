import { CumulusMessage, ReplaceConfig } from '@cumulus/types/message';
import { Context } from 'aws-lambda';
import { ChildProcessWithoutNullStreams } from 'child_process';

export interface CumulusMessageAdapterError { stderrBuffer: string }

export interface InvokeCumulusMessageAdapterType {
  cmaProcess: ChildProcessWithoutNullStreams,
  errorObj: CumulusMessageAdapterError
}

export interface LoadNestedEventInput {
  input: unknown,
  config: unknown,
  messageConfig?: unknown
}
export interface CumulusMessageWithPayload extends CumulusMessage {
  payload: {
    granules?: { granuleId: number }[] | undefined
  }
  meta: {
    stack?: string
  }
}
export interface CMAMessage {
  cma: {
    event?: object
  }
  replace?: ReplaceConfig
}

export type TaskFunction = (...args: [LoadNestedEventInput, Context]) => undefined;
