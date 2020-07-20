import { CumulusMessage } from '@cumulus/types/message';
import { Context } from 'aws-lambda';
import { ChildProcessWithoutNullStreams } from 'child_process';

export type cumulusMessageAdapterError = { stderrBuffer: string };

export type invokeCumulusMessageAdapterType = {
  cmaProcess: ChildProcessWithoutNullStreams,
  errorObj: cumulusMessageAdapterError
};

export type loadNestedEventInput = {
  input: unknown,
  config: unknown,
  messageConfig?: unknown
};

export type taskFunction = (...args: [loadNestedEventInput, Context]) => undefined;

export interface cumulusMessageWithGranulesInPayload extends CumulusMessage {
  payload: {
    granules?: { granuleId: number }[] | undefined
  }
}
