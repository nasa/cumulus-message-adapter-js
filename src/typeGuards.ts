import { CumulusMessage, CumulusRemoteMessage } from '@cumulus/types/message';
import {
  LoadNestedEventInput,
  CumulusMessageWithAssignedPayload,
  CMAMessage,
} from './types';

// eslint-disable-next-line require-jsdoc
export function isCumulusMessageWithAssignedPayload(
  message:
  CumulusMessage |
  CumulusRemoteMessage |
  CumulusMessageWithAssignedPayload |
  LoadNestedEventInput
): message is CumulusMessageWithAssignedPayload {
  return (
    (message as CumulusMessageWithAssignedPayload)?.payload !== undefined
    && (message as LoadNestedEventInput)?.input === undefined
    && (message as LoadNestedEventInput)?.config === undefined
  );
}

// eslint-disable-next-line require-jsdoc
export function isLoadNestedEventInput(
  message: CumulusMessageWithAssignedPayload | LoadNestedEventInput | CumulusRemoteMessage
): message is LoadNestedEventInput {
  return (
    (message as LoadNestedEventInput).input !== undefined
    && (message as LoadNestedEventInput).config !== undefined
  );
}

// eslint-disable-next-line require-jsdoc
export function isCMAMessage(
  message: CumulusRemoteMessage | CumulusMessage | CMAMessage
): message is CMAMessage {
  return ((message as CMAMessage).cma !== undefined);
}
