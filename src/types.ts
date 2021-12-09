import { CumulusMessage, ReplaceConfig } from '@cumulus/types/message';
import { ChildProcessWithoutNullStreams } from 'child_process';

export interface CumulusMessageAdapterError { stderrBuffer: string }

export interface InvokeCumulusMessageAdapterResult {
  cmaProcess: ChildProcessWithoutNullStreams,
  errorObj: CumulusMessageAdapterError,
  statusObj: { close: boolean }
}

export interface LoadNestedEventInput {
  input: unknown,
  config: unknown,
  messageConfig?: unknown
}
export interface CumulusMessageWithAssignedPayload extends CumulusMessage {
  payload: {
    granules?: { granuleId: string }[]
    [key: string]: unknown
  } | null,
  meta: {
    workflow_name: string
    [key: string]: unknown
    stack?: string,
    input_granules?: { granuleId: string }[]
  }
  replace?: ReplaceConfig
}
export interface CMAMessage {
  cma: {
    event?: object
  }
  replace?: ReplaceConfig
}
