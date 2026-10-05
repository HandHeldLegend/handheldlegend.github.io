/**
 * User view — port of hoja2/modules/user-md.js.
 */
import { card } from '../../ui/controls.js';
import { settingField } from '../../settings/field.js';
import { t } from '../../i18n/index.js';

export function mount(root) {
  root.append(
    card({ title: t('Player'), icon: 'user', tone: 'green' },
      settingField('user.name', { stacked: true })),
  );
}
