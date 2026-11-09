// Usernames power the short public link: wrapapp.com.au/[username]
// Rules (matched by the DB constraint): 3–30 chars, lowercase letters, numbers, dots, underscores.

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/

// Words that can never be usernames, because they are (or may become) app routes
// or would be confusing. App routes always win over /[username], so a clash
// would just make that user's link unreachable — blocking them avoids that.
// Never allowed for anyone (app routes / confusing words)
export const RESERVED_USERNAMES = new Set([
  'admin', 'api', 'app', 'auth', 'community', 'components', 'create-dip', 'createdip',
  'dashboard', 'dip', 'dips', 'explore', 'messages', 'message', 'privacy', 'reset-password',
  'terms', 'tools', 'user', 'users', 'wdywt', 'wishlist', 'login', 'logout', 'signin',
  'signup', 'register', 'join', 'settings', 'profile', 'profiles', 'about', 'help',
  'support', 'contact', 'home', 'static', 'public', 'assets', 'images', 'image', 'wraps',
  'wrap', 'collection', 'notifications', 'search', 'new', 'edit', 'null', 'undefined',
  'www', 'mail', 'robots.txt', 'sitemap.xml', 'favicon.ico',
  'manifest.json', 'sw.js', '_next',
])

// Brand words: only super_admin accounts may use these
export const BRAND_USERNAMES = new Set([
  'wrapapp', 'wrap.app', 'wrap_app', 'wrapapp.au', 'wrapapp.com.au', 'wrapapp.official', 'dipdesk',
])

export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^@/, '')
}

// Returns why a username can't be used, or null if it's OK to check availability / save.
// isAdmin = super_admin (may use brand words).
export function usernameProblem(username: string, opts: { isAdmin?: boolean } = {}): string | null {
  if (!username) return 'Choose a username.'
  if (username.length < 3) return 'At least 3 characters.'
  if (username.length > 30) return '30 characters at most.'
  if (!USERNAME_PATTERN.test(username)) return 'Only lowercase letters, numbers, dots and underscores.'
  if (/^[._]|[._]$/.test(username)) return 'Can’t start or end with a dot or underscore.'
  if (RESERVED_USERNAMES.has(username)) return 'That word is reserved for the app.'
  if (BRAND_USERNAMES.has(username) && !opts.isAdmin) return 'That name is reserved for WrapApp.'
  return null
}

// Automatic usernames are created in the database (public.generate_username +
// the profiles_set_username trigger). Keep RESERVED_USERNAMES / BRAND_USERNAMES
// above in step with the reserved list inside generate_username.
