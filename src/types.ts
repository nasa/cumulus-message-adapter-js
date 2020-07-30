import { CumulusMessage, ReplaceConfig } from '@cumulus/types/message';
import { ChildProcessWithoutNullStreams } from 'child_process';

export interface CumulusMessageAdapterError { stderrBuffer: string }

export interface InvokeCumulusMessageAdapterResult {
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
    granules?: { granuleId: string }[]
  }
  meta: {
    stack?: string,
    input_granules?: { granuleId: string }[]
  }
}
export interface CMAMessage {
  cma: {
    event?: object
  }
  replace?: ReplaceConfig
}