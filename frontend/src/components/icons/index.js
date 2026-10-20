import React, { forwardRef } from 'react'
import {
  Squares2X2Icon,
  UsersIcon,
  UserGroupIcon,
  UserIcon,
  UserCircleIcon,
  UserPlusIcon,
  BuildingOffice2Icon,
  BuildingOfficeIcon,
  BriefcaseIcon,
  TableCellsIcon,
  RectangleStackIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ReceiptPercentIcon,
  DocumentChartBarIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  BookOpenIcon,
  WalletIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ArrowDownLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon,
  Cog6ToothIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  PencilSquareIcon,
  CheckIcon,
  CheckCircleIcon,
  CheckBadgeIcon,
  XMarkIcon,
  XCircleIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  WrenchScrewdriverIcon,
  ArrowRightOnRectangleIcon,
  Bars3Icon,
  BookmarkIcon,
  BookmarkSlashIcon,
  EyeIcon,
  EyeSlashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  ClockIcon,
  CalendarIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  GlobeAltIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  EllipsisHorizontalIcon,
  EllipsisVerticalIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  TagIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  HashtagIcon,
  ArrowTopRightOnSquareIcon,
  PaperClipIcon,
  PhotoIcon,
  BellIcon,
  FolderIcon,
  CubeIcon,
  QueueListIcon,
  BoltIcon,
  DocumentDuplicateIcon,
  PrinterIcon,
  CurrencyDollarIcon,
  RocketLaunchIcon,
  PlayIcon,
  LockClosedIcon,
  StopIcon
} from '@heroicons/react/24/outline'

/**
 * Premium Heroicon Wrapper
 * Provides seamless drop-in compatibility for size, color, strokeWidth, className, and style
 */
export const wrapIcon = (HeroIcon, displayName) => {
  const IconComponent = forwardRef(({ size = 20, color, strokeWidth, className = '', style, ...props }, ref) => {
    const computedSize = typeof size === 'number' ? `${size}px` : size

    const combinedStyle = {
      width: computedSize,
      height: computedSize,
      minWidth: computedSize,
      flexShrink: 0,
      ...(color ? { color } : {}),
      ...(style || {})
    }

    return React.createElement(HeroIcon, {
      ref,
      style: combinedStyle,
      className,
      ...(strokeWidth !== undefined ? { strokeWidth } : {}),
      ...props
    })
  })

  IconComponent.displayName = displayName || HeroIcon.displayName || 'HeroIcon'
  return IconComponent
}

// -------------------------------------------------------------
// Official Heroicon Names (wrapped with size/color/style support)
// -------------------------------------------------------------
export const Squares2X2 = wrapIcon(Squares2X2Icon, 'Squares2X2')
export const UserGroup = wrapIcon(UserGroupIcon, 'UserGroup')
export const UsersHero = wrapIcon(UsersIcon, 'UsersHero')
export const UserHero = wrapIcon(UserIcon, 'UserHero')
export const UserCircle = wrapIcon(UserCircleIcon, 'UserCircle')
export const UserPlusHero = wrapIcon(UserPlusIcon, 'UserPlusHero')
export const BuildingOffice2 = wrapIcon(BuildingOffice2Icon, 'BuildingOffice2')
export const BuildingOffice = wrapIcon(BuildingOfficeIcon, 'BuildingOffice')
export const BriefcaseHero = wrapIcon(BriefcaseIcon, 'BriefcaseHero')
export const TableCells = wrapIcon(TableCellsIcon, 'TableCells')
export const RectangleStack = wrapIcon(RectangleStackIcon, 'RectangleStack')
export const CreditCardHero = wrapIcon(CreditCardIcon, 'CreditCardHero')
export const ShieldCheckHero = wrapIcon(ShieldCheckIcon, 'ShieldCheckHero')
export const DocumentText = wrapIcon(DocumentTextIcon, 'DocumentText')
export const ReceiptPercent = wrapIcon(ReceiptPercentIcon, 'ReceiptPercent')
export const DocumentChartBar = wrapIcon(DocumentChartBarIcon, 'DocumentChartBar')
export const BanknotesHero = wrapIcon(BanknotesIcon, 'BanknotesHero')
export const BuildingLibrary = wrapIcon(BuildingLibraryIcon, 'BuildingLibrary')
export const BookOpenHero = wrapIcon(BookOpenIcon, 'BookOpenHero')
export const WalletHero = wrapIcon(WalletIcon, 'WalletHero')
export const ArrowTrendingUp = wrapIcon(ArrowTrendingUpIcon, 'ArrowTrendingUp')
export const ArrowTrendingDown = wrapIcon(ArrowTrendingDownIcon, 'ArrowTrendingDown')
export const ArrowDownRightHero = wrapIcon(ArrowDownRightIcon, 'ArrowDownRightHero')
export const ArrowUpRightHero = wrapIcon(ArrowUpRightIcon, 'ArrowUpRightHero')
export const ArrowDownLeftHero = wrapIcon(ArrowDownLeftIcon, 'ArrowDownLeftHero')
export const ArrowsUpDownHero = wrapIcon(ArrowsUpDownIcon, 'ArrowsUpDownHero')
export const ArrowUpHero = wrapIcon(ArrowUpIcon, 'ArrowUpHero')
export const ArrowDownHero = wrapIcon(ArrowDownIcon, 'ArrowDownHero')
export const Cog6Tooth = wrapIcon(Cog6ToothIcon, 'Cog6Tooth')
export const AdjustmentsHorizontal = wrapIcon(AdjustmentsHorizontalIcon, 'AdjustmentsHorizontal')
export const MagnifyingGlass = wrapIcon(MagnifyingGlassIcon, 'MagnifyingGlass')
export const PlusHero = wrapIcon(PlusIcon, 'PlusHero')
export const MinusHero = wrapIcon(MinusIcon, 'MinusHero')
export const TrashHero = wrapIcon(TrashIcon, 'TrashHero')
export const PencilSquare = wrapIcon(PencilSquareIcon, 'PencilSquare')
export const CheckHero = wrapIcon(CheckIcon, 'CheckHero')
export const CheckCircleHero = wrapIcon(CheckCircleIcon, 'CheckCircleHero')
export const CheckBadgeHero = wrapIcon(CheckBadgeIcon, 'CheckBadgeHero')
export const XMark = wrapIcon(XMarkIcon, 'XMark')
export const XCircleHero = wrapIcon(XCircleIcon, 'XCircleHero')
export const ArrowPath = wrapIcon(ArrowPathIcon, 'ArrowPath')
export const ArrowDownTray = wrapIcon(ArrowDownTrayIcon, 'ArrowDownTray')
export const ArrowUpTray = wrapIcon(ArrowUpTrayIcon, 'ArrowUpTray')
export const WrenchScrewdriver = wrapIcon(WrenchScrewdriverIcon, 'WrenchScrewdriver')
export const ArrowRightOnRectangle = wrapIcon(ArrowRightOnRectangleIcon, 'ArrowRightOnRectangle')
export const Bars3 = wrapIcon(Bars3Icon, 'Bars3')
export const Bookmark = wrapIcon(BookmarkIcon, 'Bookmark')
export const BookmarkSlash = wrapIcon(BookmarkSlashIcon, 'BookmarkSlash')
export const EyeHero = wrapIcon(EyeIcon, 'EyeHero')
export const EyeSlash = wrapIcon(EyeSlashIcon, 'EyeSlash')
export const ChevronDownHero = wrapIcon(ChevronDownIcon, 'ChevronDownHero')
export const ChevronRightHero = wrapIcon(ChevronRightIcon, 'ChevronRightHero')
export const ChevronLeftHero = wrapIcon(ChevronLeftIcon, 'ChevronLeftHero')
export const ChevronUpHero = wrapIcon(ChevronUpIcon, 'ChevronUpHero')
export const ClockHero = wrapIcon(ClockIcon, 'ClockHero')
export const CalendarHero = wrapIcon(CalendarIcon, 'CalendarHero')
export const CalendarDaysHero = wrapIcon(CalendarDaysIcon, 'CalendarDaysHero')
export const ExclamationTriangle = wrapIcon(ExclamationTriangleIcon, 'ExclamationTriangle')
export const ExclamationCircleHero = wrapIcon(ExclamationCircleIcon, 'ExclamationCircleHero')
export const InformationCircle = wrapIcon(InformationCircleIcon, 'InformationCircle')
export const GlobeAlt = wrapIcon(GlobeAltIcon, 'GlobeAlt')
export const ShieldExclamation = wrapIcon(ShieldExclamationIcon, 'ShieldExclamation')
export const SparklesHero = wrapIcon(SparklesIcon, 'SparklesHero')
export const EllipsisHorizontal = wrapIcon(EllipsisHorizontalIcon, 'EllipsisHorizontal')
export const EllipsisVertical = wrapIcon(EllipsisVerticalIcon, 'EllipsisVertical')
export const ArrowLeftHero = wrapIcon(ArrowLeftIcon, 'ArrowLeftHero')
export const ArrowRightHero = wrapIcon(ArrowRightIcon, 'ArrowRightHero')
export const TagHero = wrapIcon(TagIcon, 'TagHero')
export const PhoneHero = wrapIcon(PhoneIcon, 'PhoneHero')
export const Envelope = wrapIcon(EnvelopeIcon, 'Envelope')
export const MapPinHero = wrapIcon(MapPinIcon, 'MapPinHero')
export const Hashtag = wrapIcon(HashtagIcon, 'Hashtag')
export const ArrowTopRightOnSquare = wrapIcon(ArrowTopRightOnSquareIcon, 'ArrowTopRightOnSquare')
export const PaperClipHero = wrapIcon(PaperClipIcon, 'PaperClipHero')
export const PhotoHero = wrapIcon(PhotoIcon, 'PhotoHero')
export const BellHero = wrapIcon(BellIcon, 'BellHero')
export const FolderHero = wrapIcon(FolderIcon, 'FolderHero')
export const CubeHero = wrapIcon(CubeIcon, 'CubeHero')
export const QueueList = wrapIcon(QueueListIcon, 'QueueList')
export const BoltHero = wrapIcon(BoltIcon, 'BoltHero')
export const DocumentDuplicate = wrapIcon(DocumentDuplicateIcon, 'DocumentDuplicate')
export const PrinterHero = wrapIcon(PrinterIcon, 'PrinterHero')
export const CurrencyDollarHero = wrapIcon(CurrencyDollarIcon, 'CurrencyDollarHero')
export const RocketLaunchHero = wrapIcon(RocketLaunchIcon, 'RocketLaunchHero')
export const PlayHero = wrapIcon(PlayIcon, 'PlayHero')
export const LockClosedHero = wrapIcon(LockClosedIcon, 'LockClosedHero')
export const StopHero = wrapIcon(StopIcon, 'StopHero')

// -------------------------------------------------------------
// Ergonomic Enterprise Aliases (Drop-in upgrade for Lucide names)
// -------------------------------------------------------------
export const LayoutDashboard = Squares2X2
export const Users = UserGroup
export const User = UserIcon ? wrapIcon(UserIcon, 'User') : UserCircle
export const UserCog = UserCircle
export const UserPlus = UserPlusHero
export const Building = BuildingOffice
export const Building2 = BuildingOffice2
export const Briefcase = BriefcaseHero
export const FileSpreadsheet = TableCells
export const Layers = RectangleStack
export const CreditCard = CreditCardHero
export const ShieldCheck = ShieldCheckHero
export const Receipt = ReceiptPercent
export const FileBarChart = DocumentChartBar
export const Banknote = BanknotesHero
export const Landmark = BuildingLibrary
export const BookOpen = BookOpenHero
export const Wallet = WalletHero
export const TrendingUp = ArrowTrendingUp
export const TrendingDown = ArrowTrendingDown
export const ArrowDownRight = ArrowDownRightHero
export const ArrowUpRight = ArrowUpRightHero
export const ArrowDownLeft = ArrowDownLeftHero
export const ArrowUpDown = ArrowsUpDownHero
export const ArrowUp = ArrowUpHero
export const ArrowDown = ArrowDownHero
export const Settings = Cog6Tooth
export const Sliders = AdjustmentsHorizontal
export const SlidersHorizontal = AdjustmentsHorizontal
export const Search = MagnifyingGlass
export const Plus = PlusHero
export const Minus = MinusHero
export const Trash2 = TrashHero
export const Trash = TrashHero
export const Edit = PencilSquare
export const Edit2 = PencilSquare
export const Check = CheckHero
export const CheckCircle = CheckCircleHero
export const CheckCircle2 = CheckCircleHero
export const CheckCheck = CheckBadgeHero
export const CheckSquare = CheckBadgeHero
export const Square = StopHero
export const X = XMark
export const XCircle = XCircleHero
export const RefreshCw = ArrowPath
export const RotateCcw = ArrowPath
export const Loader = ArrowPath
export const Download = ArrowDownTray
export const CloudUpload = ArrowUpTray
export const Wrench = WrenchScrewdriver
export const HardHat = WrenchScrewdriver
export const Construction = WrenchScrewdriver
export const Rocket = RocketLaunchHero
export const Play = PlayHero
export const Lock = LockClosedHero
export const LogOut = ArrowRightOnRectangle
export const Menu = Bars3
export const Pin = Bookmark
export const PinOff = BookmarkSlash
export const Eye = EyeHero
export const EyeOff = EyeSlash
export const ChevronDown = ChevronDownHero
export const ChevronRight = ChevronRightHero
export const ChevronLeft = ChevronLeftHero
export const ChevronUp = ChevronUpHero
export const Clock = ClockHero
export const Calendar = CalendarHero
export const CalendarDays = CalendarDaysHero
export const AlertCircle = ExclamationCircleHero
export const AlertTriangle = ExclamationTriangle
export const Info = InformationCircle
export const Globe = GlobeAlt
export const Shield = ShieldCheckHero
export const Sparkles = SparklesHero
export const MoreHorizontal = EllipsisHorizontal
export const MoreVertical = EllipsisVertical
export const ArrowLeft = ArrowLeftHero
export const ArrowRight = ArrowRightHero
export const Tag = TagHero
export const Phone = PhoneHero
export const Mail = Envelope
export const MapPin = MapPinHero
export const Hash = Hashtag
export const ExternalLink = ArrowTopRightOnSquare
export const Paperclip = PaperClipHero
export const Image = PhotoHero
export const ImageIcon = PhotoHero
export const Bell = BellHero
export const FileText = DocumentText
export const Save = CheckCircleHero
export const Filter = AdjustmentsHorizontal
export const Folder = FolderHero
export const Box = CubeHero
export const ListOrdered = QueueList
export const Activity = BoltHero
export const Copy = DocumentDuplicate
export const Printer = PrinterHero
export const DollarSign = CurrencyDollarHero

export default {
  LayoutDashboard,
  Users,
  User,
  UserCog,
  UserPlus,
  Building,
  Building2,
  Briefcase,
  FileSpreadsheet,
  Layers,
  CreditCard,
  ShieldCheck,
  Receipt,
  FileBarChart,
  Banknote,
  Landmark,
  BookOpen,
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Settings,
  Sliders,
  SlidersHorizontal,
  Search,
  Plus,
  Minus,
  Trash2,
  Trash,
  Edit,
  Edit2,
  Check,
  CheckCircle,
  CheckCircle2,
  CheckCheck,
  CheckSquare,
  Square,
  X,
  XCircle,
  RefreshCw,
  RotateCcw,
  Loader,
  Download,
  CloudUpload,
  Wrench,
  HardHat,
  Construction,
  Rocket,
  Play,
  Lock,
  LogOut,
  Menu,
  Pin,
  PinOff,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Clock,
  Calendar,
  CalendarDays,
  AlertCircle,
  AlertTriangle,
  Info,
  Globe,
  Shield,
  Sparkles,
  MoreHorizontal,
  MoreVertical,
  ArrowLeft,
  ArrowRight,
  Tag,
  Phone,
  Mail,
  MapPin,
  Hash,
  ExternalLink,
  Paperclip,
  ImageIcon,
  Bell,
  FileText,
  Save,
  Filter,
  Folder,
  Box,
  ListOrdered,
  Activity,
  Copy,
  Printer,
  DollarSign
}
