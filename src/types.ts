import { CumulusMessage } from '@cumulus/types/message';
import { Context } from 'aws-lambda';
import { ChildProcessWithoutNullStreams } from 'child_process';

export type CumulusMessageAdapterError = { stderrBuffer: string };

export type InvokeCumulusMessageAdapterType = {
  cmaProcess: ChildProcessWithoutNullStreams,
  errorObj: CumulusMessageAdapterError
};

export type LoadNestedEventInput = {
  input: unknown,
  config: unknown,
  messageConfig?: unknown
};

export type TaskFunction = (...args: [LoadNestedEventInput, Context]) => undefined;

export interface CumulusMessageWithGranulesInPayload extends CumulusMessage {
  payload: {
    granules?: { granuleId: number }[] | undefined
  }
}
