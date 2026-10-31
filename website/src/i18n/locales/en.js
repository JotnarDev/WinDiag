// English copy for the whole page. Keep keys in sync with the other locales.
export default {
  meta: {
    title: 'WinDiag — Hardware diagnostics for Windows',
    description:
      'Free Windows app for any laptop or desktop: test the display, keys, battery, disk and ports, bring drivers and BIOS up to date, and get the PC ready to hand over.'
  },

  nav: {
    tests: 'Tests',
    tools: 'Tools',
    drivers: 'Drivers',
    faq: 'FAQ',
    download: 'Download',
    skip: 'Skip to content',
    theme: 'Theme',
    themes: { system: 'System', light: 'Light', dark: 'Dark' },
    language: 'Language'
  },

  hero: {
    lines: ['Test it. Fix it.', 'Hand it over.'],
    sentence:
      'WinDiag is a free hardware diagnostics app for any Windows laptop or desktop. It tests the screen, keys, battery, disk and ports, then brings drivers and BIOS up to date.',
    download: 'Download for Windows',
    meta: 'Version {version} · Windows 10 and 11, 64-bit · Free and open source',
    tryIt: 'Press any key on your keyboard. This is the real keyboard test.',
    tryItTouch: 'Tap the keys. On a laptop, WinDiag reads the real keyboard.'
  },

  keyboard: {
    window: 'WinDiag',
    page: 'Keyboard & mouse',
    tested: 'Keys tested',
    of: '{done} of {total}',
    last: 'Last key',
    none: 'None yet',
    reset: 'Reset',
    done: 'Every key works.',
    nav: {
      overview: 'Overview',
      display: 'Display',
      touch: 'Touch',
      keyboard: 'Keyboard & mouse',
      battery: 'Battery',
      disk: 'Disk health'
    }
  },

  field: {
    caption: 'A Toughbook CF-19 at a solar test site. WinDiag runs on any Windows PC, from an office desktop to a laptop like this one.',
    credit: 'Photo: Bill Haofei Gong, CC BY-SA 4.0'
  },

  board: {
    title: 'Eight tests in one window',
    sentence: 'A sample run on a laptop. Select a test to see what it checks; on a desktop, skip the ones it has no hardware for.',
    sample: 'Sample results',
    status: { pass: 'Passed', attention: 'Check', running: 'Running' },
    tryDisplay: 'Try it on this screen',
    displayHint: 'Space or → next colour · ← back · Esc to exit',
    rows: [
      {
        id: 'display',
        name: 'Display',
        facts: ['5 solid colours', 'Full screen', 'No dead pixels'],
        status: 'pass',
        detail:
          'Fills the screen with solid colours to find dead or stuck pixels, light bleed and uneven backlight. Space or the arrow keys move between colours.'
      },
      {
        id: 'touch',
        name: 'Touch',
        facts: ['10 touch points', 'Edge gestures off', 'Trail drawn'],
        status: 'pass',
        detail:
          'Draws the trail of every finger to check accuracy, continuity and multi-touch. Windows edge gestures are blocked while the test runs.'
      },
      {
        id: 'keyboard',
        name: 'Keyboard & mouse',
        facts: ['84 of 84 keys', '3 mouse buttons', 'Win key held'],
        status: 'pass',
        detail:
          'Keys are matched by physical position, so any layout works. The Windows key, Print Screen, Esc, Alt+Tab and the lock keys are tested instead of obeyed.'
      },
      {
        id: 'audio',
        name: 'Audio & camera',
        facts: ['Left and right', 'Mic responding', 'Camera preview'],
        status: 'pass',
        detail: 'A camera preview, a live microphone level and a test tone for each speaker channel.'
      },
      {
        id: 'battery',
        name: 'Battery',
        facts: ['Health 87 %', '312 cycles', '39.2 of 45 Wh'],
        status: 'pass',
        detail:
          'On a laptop: charge, status, health (actual against design capacity), cycle count and charge history for each battery. One click saves the Windows battery report.'
      },
      {
        id: 'disk',
        name: 'Disk health',
        facts: ['Wear 6 %', '41 °C', '9,214 hours on'],
        status: 'pass',
        detail:
          "Estimates the main disk's remaining life from Windows reliability counters: wear, temperature, power-on hours and errors."
      },
      {
        id: 'ports',
        name: 'USB ports',
        facts: ['3 of 4 ports', 'USB-C working', '1 port left'],
        status: 'attention',
        detail:
          'Detects every USB-A and USB-C port and checks that each one recognises a device. Plug a stick into each port in turn until all of them answer.'
      },
      {
        id: 'wireless',
        name: 'Wireless & peripherals',
        facts: ['Wi-Fi 6E', '4G EM7511', 'GPS and smart card'],
        status: 'pass',
        detail:
          'Wi-Fi, Bluetooth, mobile broadband, smart card reader, GPS and barcode scanner, whenever the PC has them.'
      }
    ],
    portsPhoto: 'The rear ports of a Toughbook CF-30.'
  },

  tools: {
    title: 'The settings a technician wants',
    sentence: 'Real switches from WinDiag, and what each one does. Flip one to try it.',
    on: 'On',
    off: 'Off',
    rows: [
      {
        id: 'update',
        line: 'Keep Windows Update off while you work.',
        result: 'Nothing updates halfway through a test. WinDiag still searches it for drivers when you ask.',
        on: true
      },
      {
        id: 'keys',
        line: 'Block system keys in the keyboard test.',
        result: 'Win, Print Screen, Alt+Tab and Caps Lock are tested, not obeyed.',
        on: true
      },
      {
        id: 'generation',
        line: 'Offer a BIOS from the same generation only.',
        result: 'An FZ-55 MK2 is offered V2.xx updates, never a V1 or V3.',
        on: false
      },
      {
        id: 'charger',
        line: 'Check the charger before a BIOS update.',
        result: 'Nothing starts on battery, and BitLocker is suspended for one restart.',
        on: false
      },
      {
        id: 'specs',
        line: 'Copy the spec sheet for the ticket.',
        result: 'Model, serial, processor, memory, disk, battery, BIOS and Windows in one paste.',
        on: false
      }
    ]
  },

  flow: {
    title: 'Every driver source, one list',
    sentence:
      'Your own folder or server share, Windows Update, and the catalogs of Dell, HP and Lenovo. WinDiag offers the newest driver any of them has.',
    steps: [
      { lead: 'First, choose where drivers come from.' },
      { lead: 'Then compare the PC with all of them.' },
      { lead: 'Last, update the BIOS safely.' }
    ],
    sourcesLabel: 'Compare with',
    sources: {
      folder: {
        name: 'Driver folder or catalog',
        detail: 'Your own drivers. Nothing leaves the network.'
      },
      windowsUpdate: {
        name: 'Windows Update',
        detail: 'Drivers Microsoft publishes for this hardware. Works even with updates off.'
      },
      makers: {
        name: 'Manufacturer catalogs',
        detail: 'Dell, HP and Lenovo, checked against the maker’s signature. Skipped on this Panasonic.'
      }
    },
    catalogLabel: 'Driver catalog',
    browse: 'Browse…',
    catalogLoaded: 'Catalog loaded',
    catalogFacts: '1,284 drivers · 46 BIOS entries · read in 0.4 s',
    compare: 'Compare drivers',
    comparing: 'Comparing with every source…',
    noSources: 'Turn on at least one source to compare.',
    updates: 'Updates available',
    missing: 'Missing drivers',
    notFound: 'No driver found',
    upToDate: 'Up to date',
    update: 'Update',
    updateAll: 'Update all',
    install: 'Install',
    support: 'Panasonic support',
    supportDetail: 'Drivers and BIOS for the FZ-55, from the maker.',
    openSupport: 'Open support site',
    searchCatalog: 'Search the catalog',
    from: 'from',
    sourceNames: { folder: 'your folder', windowsUpdate: 'Windows Update' },
    copy: 'Copy',
    copied: 'Copied',
    biosEntry: 'The BIOS entry in the catalog',
    biosTitle: 'BIOS update',
    installed: 'Installed',
    inCatalog: 'In the catalog',
    checks: [
      'AC adapter connected',
      'Generation MK2 matches the V2.xx line',
      'BitLocker will be suspended for one restart'
    ],
    updateBios: 'Update BIOS…',
    guide: 'Read the driver guide'
  },

  rugged: {
    titleLines: ['Any Windows PC.', 'Rugged ones too.'],
    sentence:
      "WinDiag works on laptops and desktops of every brand. Rugged laptops get extra care: the model names technicians use and the right BIOS for each generation. Below, the latest BIOS for each, checked on 29 October 2026.",
    guide: 'Set up a driver folder',
    windows: 'Windows reports',
    shown: 'WinDiag shows',
    latestBios: 'Latest BIOS',
    ec: 'EC {version}',
    inBios: 'EC inside the BIOS',
    brands: [
      { id: 'panasonic', name: 'Panasonic', line: 'Toughbook' },
      { id: 'getac', name: 'Getac', line: 'Rugged notebooks' },
      { id: 'dell', name: 'Dell', line: 'Latitude Rugged' }
    ],
    photos: {
      panasonic: 'Panasonic Toughbook CF-19, the convertible rugged laptop.',
      getac: 'Getac B360 on show in Bangalore, 2026.',
      dell: 'Dell Latitude Rugged tablet and laptop at Dell EMC World.'
    },
    panasonicNote: 'Windows stores the generation as a suffix; WinDiag shows the name technicians use.'
  },

  faq: {
    title: 'Questions',
    items: [
      {
        q: 'Is WinDiag really free?',
        a: 'Yes. It is free for any use, with no account, no trial and no ads. The source code is on GitHub under the MIT licence.'
      },
      {
        q: 'What do I need to run it?',
        a: 'Windows 10 or 11, 64-bit, and administrator rights. It runs well on 4 GB of RAM and at 150 % display scaling.'
      },
      {
        q: 'Why does Windows show a SmartScreen warning?',
        a: "The installer isn't code-signed yet. Choose More info, then Run anyway. The release files are built by GitHub Actions from the public source."
      },
      {
        q: 'Does it need the internet?',
        a: 'Not for the tests: they run offline. Drivers can come from a folder, a USB drive or a server share on your network, with no internet at all. Windows Update and the Dell, HP and Lenovo catalogs need a connection.'
      },
      {
        q: 'Can I run it from a USB drive?',
        a: 'Yes. Each release has an installer and a portable zip. Extract the zip anywhere and run windiag-fluent.exe.'
      },
      {
        q: 'Does it work on desktops and on any brand?',
        a: 'Yes. It runs on any Windows 10 or 11 PC, laptop or desktop. Skip the tests for hardware a PC does not have, such as a battery or a touch screen. Panasonic, Getac and Dell rugged laptops get extra care: model names, BIOS generations and radios such as 4G and GPS.'
      },
      {
        q: 'Can it delete user accounts?',
        a: 'Only while Sysprep is open, and never the built-in accounts. The profile folder is kept on disk.'
      }
    ]
  },

  cta: {
    title: 'Your next PC, tested',
    sentence: 'Download WinDiag and test your next laptop or desktop before it leaves the bench.',
    filesTitle: 'Two ways to run it',
    files: [
      { name: 'Installer', detail: 'Installs in one click, with Start menu and desktop shortcuts and an uninstaller.' },
      { name: 'Portable zip', detail: 'Unzip it onto a USB drive and run it on any PC on the bench.' }
    ],
    requirements: 'Windows 10 or 11, 64-bit. No account, no internet needed.',
    download: 'Download for Windows',
    github: 'View the source on GitHub'
  },

  footer: {
    statement: 'WinDiag is free and open source, built for the technician’s bench.',
    legal: 'MIT licence · Not affiliated with Microsoft, Panasonic, Getac or Dell.',
    links: 'Links',
    linkItems: {
      releases: 'All releases',
      changelog: "What's new",
      guide: 'Driver guide',
      issues: 'Report a problem'
    },
    release: 'Latest release',
    releaseLine: 'Version {version}',
    releaseDate: 'Released {date}',
    help: 'Found a bug?',
    helpLink: 'Open an issue on GitHub',
    invite: 'Get WinDiag',
    credits: 'Photographs'
  }
}
