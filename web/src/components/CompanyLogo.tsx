import { cn } from 'cn';
import {
  Bot,
  Brain,
  Building,
  Coins,
  Cpu,
  Droplet,
  Euro,
  Fuel,
  Gamepad2,
  Globe,
  HandCoins,
  HeartPulse,
  ScrollText,
  Sprout,
  Sun,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  siActivision,
  siAdidas,
  siAirbnb,
  siAirbus,
  siAmd,
  siApple,
  siArm,
  siBaidu,
  siBmw,
  siBoeing,
  siBrenntag,
  siBroadcom,
  siCdprojekt,
  siChase,
  siCisco,
  siCocacola,
  siCoinbase,
  siCommerzbank,
  siDatadog,
  siDeutschebank,
  siDeutschetelekom,
  siDhl,
  siEa,
  siFerrarinv,
  siGoogle,
  siHellofresh,
  siHermes,
  siHonda,
  siHsbc,
  siIntel,
  siLufthansa,
  siMastercard,
  siMcdonalds,
  siMeta,
  siNetflix,
  siNike,
  siNvidia,
  siPalantir,
  siPaypal,
  siPuma,
  siQualcomm,
  siRoblox,
  siRockwellautomation,
  siSage,
  siSamsung,
  siSap,
  siSartorius,
  siShell,
  siShopify,
  siSiemens,
  siSony,
  siSpotify,
  siStarbucks,
  siTaketwointeractivesoftware,
  siTesla,
  siToyota,
  siUber,
  siVisa,
  siVolkswagen,
  siZalando,
} from 'simple-icons';
import type { SimpleIcon } from 'simple-icons';

// Large caps that funds hold or that are popular as single shares, by ISIN,
// one entry per share class. Simple Icons has no logo for many others
// (Microsoft, Amazon, ASML, Allianz, Mercedes-Benz, ...), which removed theirs
// on request; those get a monogram. Only the icons imported here end up in
// the bundle. Porsche's and Unilever's logos are left out: at icon size they
// are a blur, at about 50 KB each.
export const LOGOS: Partial<Record<string, SimpleIcon>> = {
  // North America
  US00507V1098: siActivision,
  US0090661010: siAirbnb,
  US02079K3059: siGoogle, // Alphabet A
  US02079K1079: siGoogle, // Alphabet C
  US0079031078: siAmd,
  US0378331005: siApple,
  US0420682058: siArm, // Arm Holdings ADR
  US0567521085: siBaidu, // ADR
  US0970231058: siBoeing,
  US11135F1012: siBroadcom,
  US17275R1023: siCisco,
  US1912161007: siCocacola,
  US19260Q1076: siCoinbase,
  US23804L1035: siDatadog,
  US2855121099: siEa, // Electronic Arts
  US4581401001: siIntel,
  US46625H1005: siChase, // JPMorgan Chase
  US57636Q1040: siMastercard,
  US5801351017: siMcdonalds,
  US30303M1027: siMeta,
  US64110L1061: siNetflix,
  US6541061031: siNike,
  US67066G1040: siNvidia,
  US69608A1088: siPalantir,
  US70450Y1038: siPaypal,
  US7475251036: siQualcomm,
  US7710491033: siRoblox,
  US7739031091: siRockwellautomation,
  CA82509L1076: siShopify,
  US8552441094: siStarbucks,
  US8740541094: siTaketwointeractivesoftware,
  US88160R1014: siTesla,
  US90353T1007: siUber,
  US92826C8394: siVisa,
  // Germany
  DE000A1EWWW0: siAdidas,
  DE0005190003: siBmw, // Stammaktie
  DE0005190037: siBmw, // Vorzugsaktie
  DE000A1DAHH0: siBrenntag,
  DE000CBK1001: siCommerzbank,
  DE0005140008: siDeutschebank,
  DE0005557508: siDeutschetelekom,
  DE0005552004: siDhl, // DHL Group, formerly Deutsche Post
  DE000A161408: siHellofresh,
  DE0008232125: siLufthansa,
  DE0006969603: siPuma,
  DE0007164600: siSap,
  DE0007165631: siSartorius, // Vorzugsaktie
  DE0007236101: siSiemens,
  DE0007664005: siVolkswagen, // Stammaktie
  DE0007664039: siVolkswagen, // Vorzugsaktie
  DE000ZAL1111: siZalando,
  // Rest of Europe
  NL0000235190: siAirbus,
  PLOPTTC00011: siCdprojekt,
  NL0011585146: siFerrarinv, // Ferrari N.V.
  FR0000052292: siHermes,
  GB0005405286: siHsbc,
  GB00B8C3BL03: siSage,
  GB00BP6MXD84: siShell,
  LU1778762911: siSpotify,
  // Asia
  JP3854600008: siHonda,
  KR7005930003: siSamsung, // Samsung Electronics
  JP3435000009: siSony,
  JP3633400001: siToyota,
};

// What a name says a fund holds, for anything without a logo: mostly funds,
// but a company called "... Water" gets the droplet too. The first match
// wins, so themes come before the regions they are often combined with
// ("Global Water", "MSCI World Energy"). Whole words only: "Goldman" is no
// gold, "Euronext" no euro.
interface Theme {
  keywords: RegExp;
  icon: LucideIcon;
}

const THEMES: Theme[] = [
  { keywords: /\bgold\b/i, icon: Coins },
  { keywords: /\bwater\b/i, icon: Droplet },
  { keywords: /\b(clean energy|solar|renewable)\b/i, icon: Sun },
  { keywords: /\b(oil|energy)\b/i, icon: Fuel },
  { keywords: /\bsemiconductors?\b/i, icon: Cpu },
  {
    keywords: /\b(artificial intelligence|ai|digitali[sz]ation)\b/i,
    icon: Brain,
  },
  { keywords: /\b(robotics|automation)\b/i, icon: Bot },
  { keywords: /\b(health ?care|health)\b/i, icon: HeartPulse },
  { keywords: /\b(real estate|reits?|property)\b/i, icon: Building },
  { keywords: /\b(dividends?|aristocrats)\b/i, icon: HandCoins },
  { keywords: /\b(bonds?|treasury|govt|government)\b/i, icon: ScrollText },
  { keywords: /\b(gaming|esports)\b/i, icon: Gamepad2 },
  { keywords: /\bemerging markets?\b/i, icon: Sprout },
  { keywords: /\b(euro|eurozone|europe)\b/i, icon: Euro },
  { keywords: /\b(world|acwi|global)\b/i, icon: Globe },
];

export const themeOf = (name: string): Theme | undefined =>
  THEMES.find(({ keywords }) => keywords.test(name));

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
  // for the theme and the monogram
  name: string;
  className?: string;
}

// A company's logo in the text colour, else its name's theme, else a monogram.
const CompanyLogo = ({ isin, name, className }: Props) => {
  const logo = LOGOS[isin];
  const theme = themeOf(name);

  if (logo === undefined && theme !== undefined) {
    const { icon: Icon } = theme;
    return (
      <Icon
        aria-hidden
        className={cn('size-4 shrink-0 text-muted-foreground', className)}
      />
    );
  }
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
