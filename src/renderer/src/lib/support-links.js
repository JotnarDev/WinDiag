// Each maker's driver and BIOS download site, for what no source finds
// automatically. `maker` is tested on Win32_ComputerSystem.Manufacturer
// ("Dell Inc.", "Panasonic Corporation", "ASUSTeK COMPUTER INC."…).
// Makers with a catalog source (Dell, HP, Lenovo) are listed too: their site
// still has what the catalog leaves out.
export const SUPPORT_SITES = [
  { maker: /^dell/i, name: 'Dell', url: 'https://www.dell.com/support/home/' },
  { maker: /^(hp|hewlett)/i, name: 'HP', url: 'https://support.hp.com/drivers' },
  { maker: /^lenovo/i, name: 'Lenovo', url: 'https://pcsupport.lenovo.com/' },
  {
    maker: /^panasonic/i,
    name: 'Panasonic',
    url: 'https://dl-pc-support.connect.panasonic.com/itn/'
  },
  { maker: /^getac/i, name: 'Getac', url: 'https://support.getac.com/' },
  { maker: /^(durabook|twinhead)/i, name: 'Durabook', url: 'https://www.durabook.com/en/support/' },
  { maker: /^(zebra|xplore)/i, name: 'Zebra', url: 'https://support.zebra.com/' },
  { maker: /^microsoft/i, name: 'Microsoft Surface', url: 'https://support.microsoft.com/surface' },
  { maker: /^acer/i, name: 'Acer', url: 'https://www.acer.com/us-en/support/drivers-and-manuals' },
  { maker: /^asus/i, name: 'ASUS', url: 'https://www.asus.com/support/download-center/' },
  { maker: /^(msi|micro-star)/i, name: 'MSI', url: 'https://www.msi.com/support' },
  { maker: /^(toshiba|dynabook)/i, name: 'Dynabook', url: 'https://support.dynabook.com/' },
  { maker: /^samsung/i, name: 'Samsung', url: 'https://www.samsung.com/us/support/downloads/' },
  { maker: /^gigabyte/i, name: 'Gigabyte', url: 'https://www.gigabyte.com/Support' },
  { maker: /^razer/i, name: 'Razer', url: 'https://mysupport.razer.com/' },
  { maker: /^huawei/i, name: 'Huawei', url: 'https://consumer.huawei.com/en/support/' },
  { maker: /^medion/i, name: 'Medion', url: 'https://service.medion.com/en' },
  { maker: /^lg\b/i, name: 'LG', url: 'https://www.lg.com/us/support/software-firmware-drivers' },
  { maker: /^vaio/i, name: 'VAIO', url: 'https://support.vaio.com/' }
]

/** The maker's support site for this manufacturer, or null if it isn't listed. */
export function supportSiteFor(manufacturer) {
  const text = String(manufacturer ?? '').trim()
  if (!text) return null
  return SUPPORT_SITES.find((site) => site.maker.test(text)) ?? null
}
