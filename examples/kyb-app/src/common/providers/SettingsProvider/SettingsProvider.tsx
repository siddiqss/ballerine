import { settingsProviderContext } from './settings-provider.context';
import { ISettings } from '@app/common/types/settings';
const { Provider } = settingsProviderContext;

interface Props {
  settings: ISettings;
  children: React.ReactNode | React.ReactNode[];
}

export const SettingsProvider = ({ settings, children }: Props) => {
  return <Provider value={settings}>{children}</Provider>;
};
