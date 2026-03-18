import { defineMessages, useIntl } from 'react-intl';

import { mdiInformation } from '@mdi/js';
import type { MouseEventHandler } from 'react';
import InfoBar from './ui/InfoBar';
import Icon from './ui/icon';

const messages = defineMessages({
  updateAvailable: {
    id: 'infobar.updateAvailable',
    defaultMessage:
      'A newer version ({version}) of this app is available. Please visit the releases page to update.',
  },
  viewReleases: {
    id: 'infobar.buttonViewReleases',
    defaultMessage: 'View Releases',
  },
});

const RELEASES_URL =
  'https://github.com/Endlesszombiez/ferdium-singularity/releases';

export interface IProps {
  onInstallUpdate: MouseEventHandler<HTMLButtonElement>;
  onHide: () => void;
  updateVersionParsed: string;
  updateVersion?: string;
}

const AppUpdateInfoBar = (props: IProps) => {
  const { onHide, updateVersion } = props;
  const intl = useIntl();

  return (
    <InfoBar type="primary" onHide={onHide}>
      <Icon icon={mdiInformation} />
      <p style={{ padding: '0 0.5rem 0 1rem' }}>
        {intl.formatMessage(messages.updateAvailable, {
          version: updateVersion || '',
        })}
      </p>

      <button
        className="info-bar__inline-button"
        type="button"
        onClick={() => {
          window.open(RELEASES_URL, '_blank');
        }}
      >
        <u>{intl.formatMessage(messages.viewReleases)}</u>
      </button>
    </InfoBar>
  );
};

export default AppUpdateInfoBar;
