// `ng serve` proxies /api to the NestJS API on :3000 (proxy.conf.json).
export const environment = {
  production: false,
  apiUrl: '/api',
  // PrimeUI license key (https://primeui.dev/licenses). Verified offline by
  // PrimeNG; not a secret. Without it PrimeNG shows an "Invalid license" notice.
  primeLicense: undefined as string | undefined,
};
