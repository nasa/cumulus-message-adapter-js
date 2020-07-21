import { CumulusMessage, CumulusRemoteMessage } from '@cumulus/types/message';
import {
  LoadNestedEventInput,
  CumulusMessageWithPayload,
  CMAMessage
} from './types';

// eslint-disable-next-line require-jsdoc
export function isCumulusMessageWithPayload(
  message:
  CumulusMessage |
  CumulusRemoteMessage |
  CumulusMessageWithPayload |
  LoadNestedEventInput
): message is CumulusMessageWithPayload {
  return (
    (message as CumulusMessageWithPayload)?.payload !== undefined
    && (message as CumulusRemoteMessage)?.replace === undefined
    && (message as LoadNestedEventInput)?.input === undefined
    && (message as LoadNestedEventInput)?.config === undefined
  );
}

// eslint-disable-next-line require-jsdoc
export function isLoadNestedEventInput(
  message: CumulusMessageWithPayload | LoadNestedEventInput | CumulusRemoteMessage
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
