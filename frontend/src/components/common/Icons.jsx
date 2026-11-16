function Icon({ children, size = 20, className = '', ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
}

export const GridIcon = (p) => <Icon {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></Icon>
export const LayersIcon = (p) => <Icon {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></Icon>
export const UsersIcon = (p) => <Icon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Icon>
export const RefreshIcon = (p) => <Icon {...p}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></Icon>
export const FileIcon = (p) => <Icon {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Icon>
export const CreditCardIcon = (p) => <Icon {...p}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></Icon>
export const ShieldIcon = (p) => <Icon {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Icon>
export const SettingsIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Icon>
export const TrendingUpIcon = (p) => <Icon {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></Icon>
export const DollarIcon = (p) => <Icon {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></Icon>
export const AlertIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Icon>
export const PlusIcon = (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Icon>
export const EditIcon = (p) => <Icon {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></Icon>
export const TrashIcon = (p) => <Icon {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></Icon>
export const DownloadIcon = (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Icon>
export const LogOutIcon = (p) => <Icon {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Icon>
export const SunIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></Icon>
export const MoonIcon = (p) => <Icon {...p}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></Icon>
export const BellIcon = (p) => <Icon {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Icon>
export const ChevronLeftIcon = (p) => <Icon {...p}><polyline points="15 18 9 12 15 6"/></Icon>
export const ChevronRightIcon = (p) => <Icon {...p}><polyline points="9 18 15 12 9 6"/></Icon>
export const CheckIcon = (p) => <Icon {...p}><polyline points="20 6 9 17 4 12"/></Icon>
export const XIcon = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>
export const MenuIcon = (p) => <Icon {...p}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></Icon>
export const UserIcon = (p) => <Icon {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Icon>
export const BarChartIcon = (p) => <Icon {...p}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></Icon>
export const ArrowUpIcon = (p) => <Icon {...p}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></Icon>
export const ArrowDownIcon = (p) => <Icon {...p}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></Icon>
export const RefundIcon = (p) => <Icon {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.67"/></Icon>
export const BuildingIcon = (p) => <Icon {...p}><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="2"/><line x1="15" y1="2" x2="15" y2="22"/><line x1="4" y1="7" x2="9" y2="7"/><line x1="4" y1="12" x2="9" y2="12"/><line x1="4" y1="17" x2="9" y2="17"/><line x1="15" y1="7" x2="20" y2="7"/><line x1="15" y1="12" x2="20" y2="12"/><line x1="15" y1="17" x2="20" y2="17"/></Icon>

export const EyeIcon = (p) => <Icon {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Icon>

export const SendIcon = (p) => <Icon {...p}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></Icon>
export const CloseIcon = (p) => <Icon {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></Icon>
export const RotateCcwIcon = (p) => <Icon {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.67"/></Icon>
export const BotIcon = (p) => <Icon {...p}><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/><path d="M9 18v-2h6v2"/></Icon>
export const LoaderIcon = (p) => <Icon {...p}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></Icon>
export const AlertCircleIcon = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></Icon>
export const SparklesIcon = (p) => <Icon {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></Icon>

export const HeartIcon = (p) => <Icon {...p}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></Icon>

export const ZapIcon = (p) => <Icon {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></Icon>

export const WalkingBotIcon = (p) => (
  <Icon {...p} viewBox="0 0 100 100" style={{ transform: 'scale(0.8)' }}>
    <defs>
      {/* White glossy body gradient */}
      <linearGradient id="botBodyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="50%" stopColor="#f0f4f8" />
        <stop offset="100%" stopColor="#dce3eb" />
      </linearGradient>
      {/* Yellow accent gradient */}
      <linearGradient id="botAccentGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#D4A800" />
        <stop offset="100%" stopColor="#F5C518" />
      </linearGradient>
      {/* Black face screen gradient */}
      <linearGradient id="botFaceGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#1a1a2e" />
        <stop offset="100%" stopColor="#0f0f1a" />
      </linearGradient>
      {/* Eye glow */}
      <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#D4A800" />
        <stop offset="100%" stopColor="#F5C518" />
      </radialGradient>
      {/* Body shine */}
      <linearGradient id="bodyShine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="rgba(255,255,255,0)" />
        <stop offset="40%" stopColor="rgba(255,255,255,0.6)" />
        <stop offset="60%" stopColor="rgba(255,255,255,0.6)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </linearGradient>
    </defs>

    {/* Antenna */}
    <line x1="50" y1="8" x2="50" y2="18" strokeWidth="3" strokeLinecap="round" className="walking-bot-antenna" stroke="url(#botAccentGrad)" />
    <circle cx="50" cy="8" r="4" fill="url(#botAccentGrad)" className="walking-bot-antenna-ball" />

    {/* Head - white glossy with black face screen */}
    <rect x="28" y="16" width="44" height="38" rx="12" fill="url(#botBodyGrad)" stroke="#c8d0db" strokeWidth="1.5" className="walking-bot-head" />
    {/* Face screen - black */}
    <rect x="33" y="21" width="34" height="26" rx="6" fill="url(#botFaceGrad)" className="walking-bot-face-screen" />
    {/* Eyes - glowing yellow */}
    <circle cx="42" cy="32" r="5" fill="url(#eyeGlow)" className="walking-bot-eye" filter="drop-shadow(0 0 4px #D4A800)" />
    <circle cx="58" cy="32" r="5" fill="url(#eyeGlow)" className="walking-bot-eye" filter="drop-shadow(0 0 4px #D4A800)" />
    {/* Eye inner highlight */}
    <circle cx="40" cy="30" r="1.5" fill="#fff" opacity="0.9" className="walking-bot-eye-highlight" />
    <circle cx="56" cy="30" r="1.5" fill="#fff" opacity="0.9" className="walking-bot-eye-highlight" />

    {/* Body - white glossy */}
    <rect x="22" y="52" width="56" height="38" rx="10" fill="url(#botBodyGrad)" stroke="#c8d0db" strokeWidth="1.5" className="walking-bot-body" />
    {/* Body shine overlay */}
    <rect x="24" y="54" width="52" height="34" rx="9" fill="url(#bodyShine)" opacity="0.5" />
    {/* Chest display - yellow accent */}
    <rect x="40" y="62" width="20" height="16" rx="4" fill="url(#botAccentGrad)" opacity="0.2" stroke="url(#botAccentGrad)" strokeWidth="1.5" className="walking-bot-display" />
    <line x1="45" y1="70" x2="55" y2="70" stroke="url(#botAccentGrad)" strokeWidth="2" strokeLinecap="round" className="walking-bot-display-line" />
    {/* Yellow accent stripes on chest */}
    <line x1="30" y1="68" x2="38" y2="68" stroke="url(#botAccentGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
    <line x1="62" y1="68" x2="70" y2="68" stroke="url(#botAccentGrad)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

    {/* Arms - white glossy with yellow accents */}
    <g className="walking-bot-left-arm">
      <path d="M22 58 Q14 65 10 78" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M22 58 Q14 65 10 78" stroke="#c8d0db" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.3" />
      <circle cx="10" cy="78" r="7" fill="url(#botBodyGrad)" stroke="#c8d0db" strokeWidth="1.5" />
      <circle cx="10" cy="78" r="3.5" fill="url(#botAccentGrad)" />
    </g>
    <g className="walking-bot-right-arm">
      <path d="M78 58 Q86 65 90 78" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M78 58 Q86 65 90 78" stroke="#c8d0db" strokeWidth="11" strokeLinecap="round" fill="none" opacity="0.3" />
      <circle cx="90" cy="78" r="7" fill="url(#botBodyGrad)" stroke="#c8d0db" strokeWidth="1.5" />
      <circle cx="90" cy="78" r="3.5" fill="url(#botAccentGrad)" />
    </g>

    {/* Legs - white glossy with yellow feet */}
    <g className="walking-bot-left-leg">
      <path d="M38 90 Q38 98 34 102" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M38 90 Q38 98 34 102" stroke="#c8d0db" strokeWidth="13" strokeLinecap="round" fill="none" opacity="0.3" />
      <ellipse cx="34" cy="102" rx="9" ry="5.5" fill="url(#botBodyGrad)" stroke="#c8d0db" strokeWidth="1.5" />
      <ellipse cx="34" cy="102" rx="5.5" ry="3.5" fill="url(#botAccentGrad)" />
    </g>
    <g className="walking-bot-right-leg">
      <path d="M62 90 Q62 98 66 102" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" fill="none" />
      <path d="M62 90 Q62 98 66 102" stroke="#c8d0db" strokeWidth="13" strokeLinecap="round" fill="none" opacity="0.3" />
      <ellipse cx="66" cy="102" rx="9" ry="5.5" fill="url(#botBodyGrad)" stroke="#c8d0db" strokeWidth="1.5" />
      <ellipse cx="66" cy="102" rx="5.5" ry="3.5" fill="url(#botAccentGrad)" />
    </g>

    {/* Side accent dots - yellow */}
    <circle cx="20" cy="62" r="3" fill="url(#botAccentGrad)" className="walking-bot-bolt" />
    <circle cx="80" cy="62" r="3" fill="url(#botAccentGrad)" className="walking-bot-bolt" />
    <circle cx="20" cy="76" r="3" fill="url(#botAccentGrad)" className="walking-bot-bolt" />
    <circle cx="80" cy="76" r="3" fill="url(#botAccentGrad)" className="walking-bot-bolt" />
  </Icon>
)
