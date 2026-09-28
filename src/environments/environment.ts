// Production build. The back-office is served next to the API behind one
// reverse proxy, so API calls stay same-origin (the refresh cookie is
// SameSite=Strict). Change apiUrl only together with that deployment.
export const environment = {
  production: true,
  apiUrl: '/api',
  // PrimeUI license key (https://primeui.dev/licenses). Verified offline by
  // PrimeNG; not a secret. Without it PrimeNG shows an "Invalid license" notice.
  primeLicense: undefined as string | undefined,
};
