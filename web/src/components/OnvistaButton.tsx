import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from './ui/button';

interface Props {
  relativeUrl: string;
}

const OnvistaButton = ({ relativeUrl }: Props) => {
  const { t } = useTranslation();

  return (
    <Button variant="outline" size="sm" asChild>
      <a
        href={`https://www.onvista.de${relativeUrl}`}
        target="_blank"
        rel="noreferrer"
        title={t('stock.viewOnOnvista')}
      >
        onvista
        <ExternalLink />
      </a>
    </Button>
  );
};

export default OnvistaButton;
