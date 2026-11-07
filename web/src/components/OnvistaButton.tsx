import { ExternalLink } from 'lucide-react';

import { Button } from './ui/button';

interface Props {
  relativeUrl: string;
}

const OnvistaButton = ({ relativeUrl }: Props) => (
  <Button variant="outline" size="sm" asChild>
    <a
      href={`https://www.onvista.de${relativeUrl}`}
      target="_blank"
      rel="noreferrer"
      title="auf onvista.de ansehen"
    >
      onvista
      <ExternalLink />
    </a>
  </Button>
);

export default OnvistaButton;
