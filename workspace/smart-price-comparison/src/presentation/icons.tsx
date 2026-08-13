import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const Icon = ({ children, ...props }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {children}
  </svg>
);

export const MarkIcon = (props: IconProps) => <Icon {...props}><path d="M4 18.5 9.2 13l3.2 3.1L20 7.5"/><path d="M14.5 7.5H20V13"/></Icon>;
export const DashboardIcon = (props: IconProps) => <Icon {...props}><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="4" rx="2"/><rect x="14" y="11" width="7" height="10" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></Icon>;
export const MenuIcon = (props: IconProps) => <Icon {...props}><path d="M5 3v18M5 8h5a3 3 0 0 0 0-6H5M16 3v7M20 3v7M18 3v18M16 10h4"/></Icon>;
export const ScanIcon = (props: IconProps) => <Icon {...props}><path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M7 12h10"/></Icon>;
export const ArrowIcon = (props: IconProps) => <Icon {...props}><path d="m9 18 6-6-6-6"/></Icon>;
export const PlusIcon = (props: IconProps) => <Icon {...props}><path d="M12 5v14M5 12h14"/></Icon>;
export const TrashIcon = (props: IconProps) => <Icon {...props}><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></Icon>;
export const StoreIcon = (props: IconProps) => <Icon {...props}><path d="M4 10v11h16V10M3 4h18l-2 6a3 3 0 0 1-4 0 3 3 0 0 1-6 0 3 3 0 0 1-4 0L3 4Z"/><path d="M9 21v-6h6v6"/></Icon>;
export const UsersIcon = (props: IconProps) => <Icon {...props}><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a5 5 0 0 1 10 0v2M16 4a3 3 0 0 1 0 6M17 13a5 5 0 0 1 4 5v2"/></Icon>;
export const CartIcon = (props: IconProps) => <Icon {...props}><path d="M3 4h2l2 11h11l2-7H6M9 20h.01M17 20h.01"/></Icon>;
export const TrendIcon = (props: IconProps) => <Icon {...props}><path d="m3 17 6-6 4 4 8-9"/><path d="M15 6h6v6"/></Icon>;
export const TagIcon = (props: IconProps) => <Icon {...props}><path d="m20 13-7 7L4 11V4h7l9 9Z"/><circle cx="8.5" cy="8.5" r="1"/></Icon>;
export const CameraIcon = (props: IconProps) => <Icon {...props}><path d="M4 7h3l2-3h6l2 3h3v13H4V7Z"/><circle cx="12" cy="13" r="4"/></Icon>;
