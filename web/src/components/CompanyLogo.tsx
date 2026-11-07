import { cn } from 'cn';
import {
  siActivision,
  siAmd,
  siApple,
  siBitcoin,
  siCdprojekt,
  siChase,
  siCocacola,
  siEa,
  siEthereum,
  siGoogle,
  siHsbc,
  siNvidia,
  siRoblox,
  siRockwellautomation,
  siSage,
  siSap,
  siShell,
  siSiemens,
  siTaketwointeractivesoftware,
  siTesla,
} from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';

// The largest companies in the portfolio's funds, its own shares and crypto
// currencies, by ISIN.
// Simple Icons has no logo for many others (Microsoft, Amazon, ASML, ...),
// which removed theirs on request; those get a monogram. Only the icons
// imported here end up in the bundle.
const LOGOS: Partial<Record<string, SimpleIcon>> = {
  US02079K3059: siGoogle, // Alphabet A
  US02079K1079: siGoogle, // Alphabet C
  US0378331005: siApple,
  US67066G1040: siNvidia,
  US88160R1014: siTesla,
  US1912161007: siCocacola,
  GB00BP6MXD84: siShell,
  US46625H1005: siChase, // JPMorgan Chase
  DE0007164600: siSap,
  DE0007236101: siSiemens,
  US7739031091: siRockwellautomation,
  GB00B8C3BL03: siSage,
  GB0005405286: siHsbc,
  US0079031078: siAmd,
  US00507V1098: siActivision,
  US2855121099: siEa,
  US8740541094: siTaketwointeractivesoftware,
  US7710491033: siRoblox,
  PLOPTTC00011: siCdprojekt,
  EU000A2YZK67: siBitcoin, // BTCEUR
  EU000A2YZK75: siEthereum, // ETHEUR
};

// The first letter of a name, in a muted circle the size of a logo, so that
// names line up whether or not they have one.
const Monogram = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => (
  <span
    aria-hidden
    className={cn(
      'inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground uppercase',
      className
    )}
  >
    {name.trim().charAt(0)}
  </span>
);

interface Props {
  isin: string;
  // for the monogram of a company without a logo
  name: string;
  className?: string;
}

// A company's logo in the text colour, or its monogram.
const CompanyLogo = ({ isin, name, className }: Props) => {
  const logo = LOGOS[isin];
  if (logo === undefined) return <Monogram name={name} className={className} />;

  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={cn('size-4 shrink-0 fill-current', className)}
    >
      <path d={logo.path} />
    </svg>
  );
};

export default CompanyLogo;
