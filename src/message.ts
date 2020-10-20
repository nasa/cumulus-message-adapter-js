import { CumulusMessageWithAssignedPayload } from './types';

const GRANULE_LOG_LIMIT = 500;
/**
 * Get granules from execution message.
 *   Uses the order of precedence as defined by the cumulus/common/message
 *   description.
 *
 * @param {Object} message - a Cumulus message
 * @param {integer} granuleLimit - number of granules to limit the log to
 * including, to avoid environment variable truncation
 * @returns {Array<string>} - An array of granule ids
 */
export const getMessageGranules = (
  message: CumulusMessageWithAssignedPayload,
  granuleLimit: number = GRANULE_LOG_LIMIT
): string[] => {
  const granules = message?.payload?.granules || message?.meta?.input_granules;
  if (granules) {
    return granules.slice(0, granuleLimit)
      .map((granule: { granuleId: string }) => granule.granuleId);
  }
  return [];
};

/**
 * Get the stackname pulled from the meta of the event.
 *
 * @param {Object} message - A cumulus event message.
 * @returns {string | undefined} - The cumulus stack name.
 */
export const getStackName = (
  message: CumulusMessageWithAssignedPayload
): string | undefined => message?.meta?.stack;

/**
 * Gets parent arn from execution message.
 *
 * @param {Object} message - An execution message.
 * @returns {string | undefined} - the parent execution.
 */
export const getParentArn = (
  message: CumulusMessageWithAssignedPayload
): string | undefined => message?.cumulus_meta?.parentExecutionArn;

/**
* Get current execution name from Cumulus message.
*
* @param {Object} message - Cumulus message.
* @returns {string | undefined} current execution name.
*/
export const getExecutions = (
  message: CumulusMessageWithAssignedPayload
): string | undefined => message?.cumulus_meta?.execution_name;

/**
 * Get current async operation id from Cumulus message.
 *
 * @param {Object} message - Cumulus message.
 * @returns {string} asyncOperationId or null
 */
export const getAsyncOperationId = (
  message: CumulusMessageWithAssignedPayload
): string | undefined => message?.cumulus_meta?.asyncOperationId;
