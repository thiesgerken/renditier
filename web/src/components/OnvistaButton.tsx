import { Tooltip, Button } from '@mui/material';
import type { ButtonProps } from '@mui/material';
import { styled } from '@mui/material/styles';

// `styled()` erases Button's polymorphism, so the anchor props it accepts when
// `href` is set (target, rel) have to be declared explicitly.
const StyledButton = styled(Button)<ButtonProps<'a'>>({
  textTransform: 'none',
  fontWeight: 600,
});

interface Props {
  relativeUrl: string;
}

const OnvistaButton = ({ relativeUrl }: Props) => (
  <Tooltip title="auf onvista.de ansehen" arrow>
    <StyledButton
      color="secondary"
      rel="noreferrer"
      size="small"
      href={`https://www.onvista.de${relativeUrl}`}
      target="_blank"
    >
      onvista
    </StyledButton>
  </Tooltip>
);

export default OnvistaButton;
