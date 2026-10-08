export const ROLES = Object.freeze({
  CUSTOMER: 'CUSTOMER',
  VENDOR: 'VENDOR',
  ADMIN: 'ADMIN',
})

export const ROLE_HOME = Object.freeze({
  [ROLES.CUSTOMER]: '/customer',
  [ROLES.VENDOR]: '/vendor',
  [ROLES.ADMIN]: '/admin',
})
