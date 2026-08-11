import * as css from './style.css';
import { isJumboEmoji } from '../../utils/regex';

type PowerIconProps = css.PowerIconVariants & {
  iconSrc: string;
  name?: string;
};
export function PowerIcon({ size, iconSrc, name }: PowerIconProps) {
  return isJumboEmoji(iconSrc) ? (
    <span className={css.PowerIcon({ size })}>{iconSrc}</span>
  ) : (
    <img className={css.PowerIcon({ size })} src={iconSrc} alt={name} />
  );
}
