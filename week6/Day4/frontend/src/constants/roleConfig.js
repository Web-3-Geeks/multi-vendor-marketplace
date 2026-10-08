import {
  BarChart3,
  Boxes,
  CreditCard,
  LayoutDashboard,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tags,
  Users,
} from 'lucide-react'
import { ROLES } from './roles'

export const FEATURES = [
  { label: 'Browse marketplace', roles: [ROLES.CUSTOMER, ROLES.VENDOR, ROLES.ADMIN] },
  { label: 'Place orders', roles: [ROLES.CUSTOMER, ROLES.VENDOR, ROLES.ADMIN] },
  { label: 'Create products', roles: [ROLES.VENDOR, ROLES.ADMIN] },
  { label: 'Manage own products', roles: [ROLES.VENDOR, ROLES.ADMIN] },
  { label: 'Manage own vendor orders', roles: [ROLES.VENDOR, ROLES.ADMIN] },
  { label: 'Manage all products', roles: [ROLES.ADMIN] },
  { label: 'Manage users', roles: [ROLES.ADMIN] },
  { label: 'Manage vendors', roles: [ROLES.ADMIN] },
  { label: 'Manage payments', roles: [ROLES.ADMIN] },
]

export const ROLE_CONFIG = {
  [ROLES.CUSTOMER]: {
    label: 'Customer',
    title: 'Customer Dashboard',
    tagline: 'Discover products from trusted independent vendors.',
    hero: 'from-indigo-700 via-blue-600 to-sky-400',
    accentText: 'text-indigo-600',
    accentSoft: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    navSection: 'Shopping',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, active: true },
      { label: 'Browse products', icon: ShoppingBag, to: '/products' },
      { label: 'Cart', icon: ShoppingCart, to: '/cart' },
      { label: 'My orders', icon: Package, to: '/orders' },
    ],
  },
  [ROLES.VENDOR]: {
    label: 'Vendor',
    title: 'Vendor Dashboard',
    tagline: 'Manage your store, your products and your orders.',
    hero: 'from-emerald-700 via-teal-600 to-cyan-400',
    accentText: 'text-emerald-600',
    accentSoft: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    navSection: 'Store',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, active: true },
      { label: 'My products', icon: Boxes, to: '/vendor#products' },
      { label: 'Orders', icon: Package, to: '/vendor#orders' },
      { label: 'Earnings', icon: BarChart3, to: '/vendor#earnings' },
    ],
  },
  [ROLES.ADMIN]: {
    label: 'Admin',
    title: 'Admin Dashboard',
    tagline: 'Oversee users, vendors and everything happening on the platform.',
    hero: 'from-slate-900 via-slate-700 to-amber-500',
    accentText: 'text-amber-600',
    accentSoft: 'bg-amber-50 text-amber-700 ring-amber-200',
    navSection: 'Management',
    nav: [
      { label: 'Overview', icon: LayoutDashboard, active: true },
      { label: 'Orders', icon: Package, to: '/admin#orders' },
      { label: 'Payments', icon: CreditCard, to: '/admin#payments' },
      { label: 'Vendors', icon: Store, to: '/admin#vendors' },
      { label: 'Products', icon: Boxes, to: '/products' },
      { label: 'Categories', icon: Tags, to: '/admin#categories' },
      { label: 'Users', icon: Users },
    ],
  },
}
