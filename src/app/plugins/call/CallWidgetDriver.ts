import { type Capability } from 'matrix-widget-api';
import { MatrixClient } from 'matrix-js-sdk';
import { getCallCapabilities } from './utils';
import { BaseWidgetDriver } from '../widget/BaseWidgetDriver';

export class CallWidgetDriver extends BaseWidgetDriver {
  private allowedCapabilities: Set<Capability>;

  public constructor(mx: MatrixClient, inRoomId: string) {
    super(mx, inRoomId);

    const deviceId = mx.getDeviceId();
    if (!deviceId) throw new Error('Failed to initialize CallWidgetDriver! Device ID not found.');

    this.allowedCapabilities = getCallCapabilities(inRoomId, mx.getSafeUserId(), deviceId);
  }

  /**
   * SECURITY — KNOWN LIMITATION: this allowlist is advisory, not enforcing.
   *
   * It is the correct check for a *well-behaved* widget: it narrows what the
   * Element Call frame may ask us to do over the widget API. But the frame is
   * served from our own origin and sandboxed with both `allow-scripts` and
   * `allow-same-origin` (see CallEmbed.getIframe, which documents why neither
   * token can be dropped today). Those two together are a same-origin
   * sandbox escape: a compromised bundle can reach `window.parent` directly
   * and read the access token and crypto store out of localStorage/IndexedDB
   * without ever sending a single postMessage through this driver.
   *
   * So: everything below constrains accidents and protocol misuse, not an
   * attacker. Making it enforcing requires serving the widget from a separate
   * origin — an architectural change, tracked at the CallEmbed site.
   *
   * Third-party widgets do NOT share this limitation, because they are loaded
   * cross-origin and refused outright if they are not — see
   * plugins/widget/widgetUrl.ts and GenericWidgetDriver.
   */
  public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    const allow = Array.from(requested).filter((cap) => this.allowedCapabilities.has(cap));
    return new Set(allow);
  }
}
