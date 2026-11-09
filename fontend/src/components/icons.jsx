import * as Lu from 'react-icons/lu'

// Global icon scale. Bump this to make every icon in the app larger/smaller.
const ICON_SCALE = 1.25

// Wrap a react-icons component so any explicit numeric `size` prop is scaled.
// Icons without an explicit size inherit `1em` (font size) and get a scaled default.
function scaled(IconComponent) {
  return function ScaledIcon({ size, ...props }) {
    const nextSize =
      typeof size === 'number'
        ? Math.round(size * ICON_SCALE)
        : size ?? `${ICON_SCALE}em`
    return <IconComponent size={nextSize} {...props} />
  }
}

export const Mail = scaled(Lu.LuMail)
export const Lock = scaled(Lu.LuLock)
export const User = scaled(Lu.LuUser)
export const Phone = scaled(Lu.LuPhone)
export const Bell = scaled(Lu.LuBell)
export const Home = scaled(Lu.LuHouse)
export const Activity = scaled(Lu.LuActivity)
export const Chart = scaled(Lu.LuChartColumn)
export const Mic = scaled(Lu.LuMic)
export const Dumbbell = scaled(Lu.LuDumbbell)
export const Send = scaled(Lu.LuSend)
export const Chat = scaled(Lu.LuMessageSquare)
export const Settings = scaled(Lu.LuSettings)
export const ChevronRight = scaled(Lu.LuChevronRight)
export const ArrowLeft = scaled(Lu.LuArrowLeft)
export const Check = scaled(Lu.LuCheck)
export const Plus = scaled(Lu.LuPlus)
export const Search = scaled(Lu.LuSearch)
export const AlertTriangle = scaled(Lu.LuTriangleAlert)
export const LogOut = scaled(Lu.LuLogOut)
export const Trash = scaled(Lu.LuTrash)
export const Camera = scaled(Lu.LuCamera)
export const MapPin = scaled(Lu.LuMapPin)
export const Clock = scaled(Lu.LuClock)
export const Hospital = scaled(Lu.LuHospital)
export const Users = scaled(Lu.LuUsers)
export const ShieldCheck = scaled(Lu.LuShieldCheck)
export const Award = scaled(Lu.LuAward)
export const Flame = scaled(Lu.LuFlame)
export const Refresh = scaled(Lu.LuRefreshCw)
export const Gamepad = scaled(Lu.LuGamepad2)
