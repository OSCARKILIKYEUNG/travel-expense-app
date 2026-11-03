/**
 * Journal drawing set — core fine-liner icons (`src/journal/art/core.jsx`).
 * First-party inline SVGs, 24×24 viewBox, 1.5px currentColor stroke, round caps/joins, fill none.
 * Zero raw hex colours; accessible by default (`aria-hidden="true"` unless `title` is supplied).
 */

function SvgBase({ className = 'h-6 w-6', title, children, ...rest }) {
  const hasTitle = typeof title === 'string' && title.trim().length > 0;
  const a11yProps = hasTitle
    ? { role: 'img' }
    : { 'aria-hidden': 'true' };

  return (
    <svg
      {...a11yProps}
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 select-none ${className}`.trim()}
      {...rest}
    >
      {hasTitle ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function CalendarIcon(props) {
  return (
    <SvgBase {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5 H20.5" />
      <path d="M8 3 V6.5 M16 3 V6.5" />
      <path d="M8 13.5 H8.5 M12 13.5 H12.5 M16 13.5 H16.5 M8 17 H8.5 M12 17 H12.5" />
    </SvgBase>
  );
}

export function BookIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M5 3.5 H17.5 A1.5 1.5 0 0 1 19 5 V19 A1.5 1.5 0 0 1 17.5 20.5 H5 Z" />
      <path d="M8.5 3.5 V20.5" />
      <path d="M11.5 8.5 H16 M11.5 12.2 H15.2" />
    </SvgBase>
  );
}

export function ChartIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M3.5 19.5 H20.5" />
      <rect x="5.5" y="12" width="3.2" height="7.5" />
      <rect x="10.4" y="7" width="3.2" height="12.5" />
      <rect x="15.3" y="9.8" width="3.2" height="9.7" />
    </SvgBase>
  );
}

export function GearIcon(props) {
  return (
    <SvgBase {...props}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 3.5 V5.8 M12 18.2 V20.5 M3.5 12 H5.8 M18.2 12 H20.5 M6 6 L7.6 7.6 M16.4 16.4 L18 18 M18 6 L16.4 7.6 M7.6 16.4 L6 18" />
    </SvgBase>
  );
}

export function CameraIcon(props) {
  return (
    <SvgBase {...props}>
      <rect x="3" y="6.5" width="18" height="13" rx="2" />
      <path d="M7.5 6.5 L9 4.2 H15 L16.5 6.5" />
      <circle cx="12" cy="13" r="3.4" />
      <path d="M17.5 9.5 H18.2" />
    </SvgBase>
  );
}

export function PencilIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M4.2 19.8 L8 18.8 L18.6 8.2 L15.8 5.4 L5.2 16 L4.2 19.8 Z" />
      <path d="M13.6 7.6 L16.4 10.4" />
      <path d="M4 20.5 H19.5" />
    </SvgBase>
  );
}

export function PinIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M12 20.5 C12 20.5 17.5 14.8 17.5 9.8 A5.5 5.5 0 1 0 6.5 9.8 C6.5 14.8 12 20.5 12 20.5 Z" />
      <circle cx="12" cy="9.8" r="1.9" />
    </SvgBase>
  );
}

export function SearchIcon(props) {
  return (
    <SvgBase {...props}>
      <circle cx="10.5" cy="10.5" r="5.8" />
      <path d="M15 15 L19.8 19.8" />
    </SvgBase>
  );
}

export function FilterIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M3.5 7.5 H6.5 M11.1 7.5 H20.5" />
      <circle cx="8.8" cy="7.5" r="2.3" />
      <path d="M3.5 16.5 H12.9 M17.5 16.5 H20.5" />
      <circle cx="15.2" cy="16.5" r="2.3" />
    </SvgBase>
  );
}

export function RepayIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M4 8.5 H19.5 L16 5" />
      <path d="M19.5 8.5 L16 12" />
      <path d="M20 15.5 H4.5 L8 12" />
      <path d="M4.5 15.5 L8 19" />
    </SvgBase>
  );
}

export function BowlIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M7.5 5.5 L19.5 4 M7.5 8.5 L19.5 7.5" />
      <path d="M4.5 12 H19.5 C19.5 17.2 16.2 20 12 20 C7.8 20 4.5 17.2 4.5 12 Z" />
      <path d="M9 20.5 H15" />
    </SvgBase>
  );
}

export function TrainIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M9.5 4.5 L12 2.5 L14.5 4.5" />
      <rect x="6" y="4.5" width="12" height="14" rx="2.5" />
      <path d="M6 11.5 H18" />
      <circle cx="9.2" cy="15.2" r="0.9" />
      <circle cx="14.8" cy="15.2" r="0.9" />
      <path d="M8.2 18.5 L6.2 21.2 M15.8 18.5 L17.8 21.2" />
    </SvgBase>
  );
}

export function BagIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M5.5 8.5 H18.5 L17.3 20 H6.7 Z" />
      <path d="M9 8.5 V6.5 A3 3 0 0 1 15 6.5 V8.5" />
    </SvgBase>
  );
}

export function BedIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M3.5 7.5 V19 M20.5 11.5 V19 M3.5 15.5 H20.5" />
      <path d="M6 15.5 V12.2 A1.2 1.2 0 0 1 7.2 11 H10.5 A1.2 1.2 0 0 1 11.7 12.2 V15.5" />
      <path d="M11.7 12 H18.5 A2 2 0 0 1 20.5 14 V15.5" />
    </SvgBase>
  );
}

export function TicketIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M3.5 8.5 A1.5 1.5 0 0 1 5 7 H19 A1.5 1.5 0 0 1 20.5 8.5 V10.2 A1.8 1.8 0 0 0 20.5 13.8 V15.5 A1.5 1.5 0 0 1 19 17 H5 A1.5 1.5 0 0 1 3.5 15.5 V13.8 A1.8 1.8 0 0 0 3.5 10.2 Z" />
      <path d="M14.8 7.5 V9.2 M14.8 11.2 V12.8 M14.8 14.8 V16.5" />
    </SvgBase>
  );
}

export function StarIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M12 3.8 L14.5 9.1 L20.3 9.8 L16 13.8 L17.2 19.5 L12 16.5 L6.8 19.5 L8 13.8 L3.7 9.8 L9.5 9.1 Z" />
    </SvgBase>
  );
}

export function DotIcon(props) {
  return (
    <SvgBase {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" />
    </SvgBase>
  );
}

export function CheckboxIcon(props) {
  return (
    <SvgBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </SvgBase>
  );
}

export function CheckboxCheckedIcon(props) {
  return (
    <SvgBase {...props}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M7.2 12.4 L10.5 15.6 L17.2 7.6" />
    </SvgBase>
  );
}

export function TriangleDownIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M6.5 8.5 L17.5 8.5 L12 16.5 Z" />
    </SvgBase>
  );
}

export function PushpinIcon(props) {
  return (
    <SvgBase {...props}>
      <circle cx="12" cy="7.5" r="3.8" />
      <path d="M8.5 11.3 H15.5" />
      <path d="M12 11.3 V20.2" />
    </SvgBase>
  );
}

export function SunIcon(props) {
  return (
    <SvgBase {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3.2 V5.4 M12 18.6 V20.8 M3.2 12 H5.4 M18.6 12 H20.8 M5.8 5.8 L7.3 7.3 M16.7 16.7 L18.2 18.2 M18.2 5.8 L16.7 7.3 M7.3 16.7 L5.8 18.2" />
    </SvgBase>
  );
}

export function CloudIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M6.5 17.5 H17.5 A3.5 3.5 0 0 0 18 10.6 A5 5 0 0 0 8.3 9.2 A4 4 0 0 0 6.5 17.5 Z" />
    </SvgBase>
  );
}

export function RainIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M6.5 14.5 H17.5 A3.2 3.2 0 0 0 18 8.2 A4.5 4.5 0 0 0 8.5 7 A3.6 3.6 0 0 0 6.5 14.5 Z" />
      <path d="M8.5 17.2 L7.3 20.2 M12.5 17.2 L11.3 20.2 M16.5 17.2 L15.3 20.2" />
    </SvgBase>
  );
}

export function SuitcaseIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M9.2 7.5 V5.2 A1.2 1.2 0 0 1 10.4 4 H13.6 A1.2 1.2 0 0 1 14.8 5.2 V7.5" />
      <rect x="4" y="7.5" width="16" height="12" rx="2" />
      <path d="M8.5 7.5 V19.5 M15.5 7.5 V19.5" />
      <path d="M7.5 19.5 V21 M16.5 19.5 V21" />
    </SvgBase>
  );
}

export function PlaneIcon(props) {
  return (
    <SvgBase {...props}>
      <path d="M20.5 4.2 L3.8 10.6 L10 13.2 L12.8 19.6 L15.3 14.2 L20.5 4.2 Z" />
      <path d="M20.5 4.2 L10 13.2" />
    </SvgBase>
  );
}

export function CompassIcon(props) {
  return (
    <SvgBase {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 5.5 L13.8 10.2 L18.5 12 L13.8 13.8 L12 18.5 L10.2 13.8 L5.5 12 L10.2 10.2 Z" />
    </SvgBase>
  );
}

/** Map of all 27 core journal fine-liner icons. */
export const CORE_ICONS = {
  calendar: CalendarIcon,
  book: BookIcon,
  chart: ChartIcon,
  gear: GearIcon,
  camera: CameraIcon,
  pencil: PencilIcon,
  pin: PinIcon,
  search: SearchIcon,
  filter: FilterIcon,
  repay: RepayIcon,
  bowl: BowlIcon,
  train: TrainIcon,
  bag: BagIcon,
  bed: BedIcon,
  ticket: TicketIcon,
  star: StarIcon,
  dot: DotIcon,
  checkbox: CheckboxIcon,
  checkboxChecked: CheckboxCheckedIcon,
  triangleDown: TriangleDownIcon,
  pushpin: PushpinIcon,
  sun: SunIcon,
  cloud: CloudIcon,
  rain: RainIcon,
  suitcase: SuitcaseIcon,
  plane: PlaneIcon,
  compass: CompassIcon,
};

/** Category key -> core icon name mapping covering every key of categoryPalette in tokens.js. */
export const CATEGORY_ICON_NAME = {
  飲食: 'bowl',
  交通: 'train',
  購物: 'bag',
  住宿: 'bed',
  娛樂: 'ticket',
  其他: 'star',
  未分類: 'dot',
};

/**
 * Category key -> icon component covering every key of `categoryPalette` in `src/theme/tokens.js`.
 */
export const CATEGORY_ICON = {
  飲食: BowlIcon,
  交通: TrainIcon,
  購物: BagIcon,
  住宿: BedIcon,
  娛樂: TicketIcon,
  其他: StarIcon,
  未分類: DotIcon,
};

/**
 * Renders a journal fine-liner icon by core name (`"bowl"`) or category key (`"飲食"`).
 */
export function JournalIcon({ name = 'dot', className = 'h-6 w-6', title, ...rest }) {
  const IconComp = CORE_ICONS[name] || CATEGORY_ICON[name] || DotIcon;
  return <IconComp className={className} title={title} {...rest} />;
}
