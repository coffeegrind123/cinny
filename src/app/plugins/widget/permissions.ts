import { MatrixClient } from 'matrix-js-sdk';
import { Capability } from 'matrix-widget-api';

/**
 * Where widget consent is remembered.
 *
 * Same account-data key Element uses, so a grant made in one client is
 * recognised by the other rather than each asking again.
 */
export const ALLOWED_WIDGETS_ACCOUNT_DATA = 'im.vector.setting.allowed_widgets';

type AllowedWidgetsContent = {
  /** widget event id -> capability -> allowed */
  allowed?: Record<string, Record<string, boolean>>;
};

const readContent = (mx: MatrixClient): AllowedWidgetsContent =>
  mx.getAccountData(ALLOWED_WIDGETS_ACCOUNT_DATA as never)?.getContent<AllowedWidgetsContent>() ??
  {};

export const getGrantedCapabilities = (mx: MatrixClient, widgetKey: string): Set<Capability> => {
  const forWidget = readContent(mx).allowed?.[widgetKey] ?? {};
  return new Set(
    Object.entries(forWidget)
      .filter(([, allowed]) => allowed === true)
      .map(([capability]) => capability),
  );
};

/**
 * Records the user's decision for each capability the widget asked for.
 *
 * Denials are stored as `false` rather than omitted, so a widget that asks
 * again gets the same answer instead of a fresh prompt every time it reloads —
 * a prompt that reappears until you click yes is a prompt that trains people to
 * click yes.
 */
export const setGrantedCapabilities = async (
  mx: MatrixClient,
  widgetKey: string,
  decisions: Record<string, boolean>,
): Promise<void> => {
  const content = readContent(mx);
  const allowed = { ...(content.allowed ?? {}) };
  allowed[widgetKey] = { ...(allowed[widgetKey] ?? {}), ...decisions };
  await mx.setAccountData(ALLOWED_WIDGETS_ACCOUNT_DATA as never, { ...content, allowed } as never);
};

export const revokeWidget = async (mx: MatrixClient, widgetKey: string): Promise<void> => {
  const content = readContent(mx);
  const allowed = { ...(content.allowed ?? {}) };
  delete allowed[widgetKey];
  await mx.setAccountData(ALLOWED_WIDGETS_ACCOUNT_DATA as never, { ...content, allowed } as never);
};

/**
 * Capabilities the widget asked for that have never been decided on.
 *
 * A widget that changes its request — because its URL changed, or because it
 * simply asks for more this time — comes back through the prompt for the new
 * items only.
 */
export const getUndecidedCapabilities = (
  mx: MatrixClient,
  widgetKey: string,
  requested: Iterable<Capability>,
): Capability[] => {
  const decided = readContent(mx).allowed?.[widgetKey] ?? {};
  return Array.from(requested).filter((capability) => !(capability in decided));
};
