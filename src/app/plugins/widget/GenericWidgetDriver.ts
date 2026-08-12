import { Capability, IOpenIDUpdate, OpenIDRequestState, SimpleObservable } from 'matrix-widget-api';
import { MatrixClient } from 'matrix-js-sdk';
import { BaseWidgetDriver } from './BaseWidgetDriver';

/**
 * Driver for third-party widgets.
 *
 * Unlike the call driver, this one's capability check is enforcing rather than
 * advisory: a third-party widget is only ever loaded cross-origin (see
 * widgetUrl.ts, which refuses same-origin URLs), so the iframe sandbox is a
 * real boundary and this driver is the widget's only route to the account.
 *
 * The granted set is fixed when the widget is opened, from what the user
 * consented to. It is not re-read while the widget runs, so a grant revoked
 * mid-session takes effect on the next open rather than mutating under a
 * running widget.
 */
export class GenericWidgetDriver extends BaseWidgetDriver {
  private granted: Set<Capability>;

  public constructor(mx: MatrixClient, inRoomId: string, granted: Set<Capability>) {
    super(mx, inRoomId);
    this.granted = granted;
  }

  public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
    return new Set(Array.from(requested).filter((capability) => this.granted.has(capability)));
  }

  /**
   * OpenID lets a widget prove to its own backend who you are on Matrix.
   *
   * Always refused. Granting it is how a widget turns "some anonymous frame" into
   * "an authenticated session belonging to @you:server" on a third-party
   * service, and there is no way to present that choice honestly in a prompt
   * next to the others. Widgets that need it will say they are not signed in,
   * which is accurate.
   */
  public async askOpenID(observer: SimpleObservable<IOpenIDUpdate>): Promise<void> {
    observer.update({ state: OpenIDRequestState.Blocked });
  }
}
