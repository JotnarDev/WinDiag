/*
 * The apps the home edition offers, installed with winget, Windows' own app
 * installer. Free (or with a free version), well known and safe. Only these
 * can be installed from the Apps page.
 *
 * source: 'winget' (default) or 'msstore'. An entry with `packages` installs
 * several packages under one name.
 */

export const APP_GROUPS = [
  { id: 'productivity', title: 'Everyday' },
  { id: 'gaming', title: 'Gaming' },
  { id: 'design', title: 'Design' },
  { id: 'development', title: 'Development' }
]

const app = (group, id, name, text, extra = {}) => ({ group, id, name, text, ...extra })

export const APP_CATALOG = [
  app('productivity', 'Google.Chrome', 'Google Chrome', 'Web browser.'),
  app('productivity', 'Mozilla.Firefox', 'Firefox', 'Web browser that blocks trackers.'),
  app(
    'productivity',
    'TheDocumentFoundation.LibreOffice',
    'LibreOffice',
    'Documents, spreadsheets and presentations, free. Opens Word and Excel files.'
  ),
  app(
    'productivity',
    'Adobe.Acrobat.Reader.64-bit',
    'Adobe Acrobat Reader',
    'Open, fill and sign PDFs.'
  ),
  app('productivity', '7zip.7zip', '7-Zip', 'Open .zip, .rar and .7z files.'),
  app('productivity', 'VideoLAN.VLC', 'VLC', 'Plays almost any video or audio file.'),
  app('productivity', '9NKSQGP7F2NH', 'WhatsApp', 'Messages and calls, from the Microsoft Store.', {
    source: 'msstore'
  }),
  app('productivity', 'Zoom.Zoom', 'Zoom', 'Video calls and meetings.'),
  app('productivity', 'Mozilla.Thunderbird', 'Thunderbird', 'Email and calendar.'),
  app('productivity', 'Bitwarden.Bitwarden', 'Bitwarden', 'Free password manager.'),
  app('productivity', 'Google.GoogleDrive', 'Google Drive', 'Keep your files in the cloud.'),
  app(
    'productivity',
    'Microsoft.PowerToys',
    'PowerToys',
    'Handy extras from Microsoft: resize images, pick colours, rename many files.'
  ),

  app('gaming', 'Valve.Steam', 'Steam', 'Game store and library.'),
  app(
    'gaming',
    'EpicGames.EpicGamesLauncher',
    'Epic Games Launcher',
    'Game store, with free games every week.'
  ),
  app('gaming', 'GOG.Galaxy', 'GOG Galaxy', 'Game store with DRM-free games.'),
  app('gaming', 'ElectronicArts.EADesktop', 'EA app', 'Games from Electronic Arts.'),
  app('gaming', 'Ubisoft.Connect', 'Ubisoft Connect', 'Games from Ubisoft.'),
  app('gaming', 'Blizzard.BattleNet', 'Battle.net', 'Games from Blizzard and Activision.'),
  app('gaming', 'Playnite.Playnite', 'Playnite', 'All your game libraries in one place.'),
  app('gaming', 'Discord.Discord', 'Discord', 'Voice and text chat.'),
  app('gaming', 'OBSProject.OBSStudio', 'OBS Studio', 'Record and stream your games.'),
  app(
    'gaming',
    'Guru3D.Afterburner',
    'MSI Afterburner',
    'See FPS and temperatures while you play.'
  ),
  app(
    'gaming',
    'windiag.game-runtimes',
    'Game runtimes',
    'Visual C++ 2015–2022 (32 and 64-bit) and .NET Desktop Runtime 8. Many games won’t start without them.',
    {
      packages: [
        'Microsoft.VCRedist.2015+.x64',
        'Microsoft.VCRedist.2015+.x86',
        'Microsoft.DotNet.DesktopRuntime.8'
      ]
    }
  ),

  app('design', 'GIMP.GIMP.3', 'GIMP', 'Photo editing.'),
  app('design', 'KDE.Krita', 'Krita', 'Digital painting and illustration.'),
  app(
    'design',
    'Inkscape.Inkscape',
    'Inkscape',
    'Vector graphics, a free alternative to Illustrator.'
  ),
  app('design', 'Figma.Figma', 'Figma', 'Interface and graphic design.'),
  app('design', 'dotPDN.PaintDotNet', 'Paint.NET', 'Simple image editing.'),
  app('design', 'darktable.darktable', 'darktable', 'Develop RAW photos.'),
  app('design', 'BlenderFoundation.Blender', 'Blender', '3D modelling, animation and rendering.'),
  app('design', 'KDE.Kdenlive', 'Kdenlive', 'Video editing.'),
  app('design', 'Audacity.Audacity', 'Audacity', 'Record and edit audio.'),
  app('design', 'Scribus.Scribus', 'Scribus', 'Page layout, a free alternative to InDesign.'),
  app('design', 'ShareX.ShareX', 'ShareX', 'Screenshots and screen recording.'),

  app('development', 'Microsoft.VisualStudioCode', 'Visual Studio Code', 'Code editor.'),
  app('development', 'Git.Git', 'Git', 'Version control, from the terminal.'),
  app('development', 'GitHub.GitHubDesktop', 'GitHub Desktop', 'Version control with a window.'),
  app('development', 'Microsoft.WindowsTerminal', 'Windows Terminal', 'Modern terminal with tabs.'),
  app('development', 'Microsoft.PowerShell', 'PowerShell 7', 'The current PowerShell.'),
  app('development', 'OpenJS.NodeJS.LTS', 'Node.js LTS', 'JavaScript runtime.'),
  app('development', 'Python.Python.3.14', 'Python 3', 'Python programming language.'),
  app('development', 'Docker.DockerDesktop', 'Docker Desktop', 'Containers.'),
  app('development', 'Bruno.Bruno', 'Bruno', 'Test APIs, free and without an account.'),
  app('development', 'Notepad++.Notepad++', 'Notepad++', 'Light text and code editor.'),
  app('development', 'astral-sh.uv', 'uv', 'Fast Python package and project manager.')
]

/** The winget packages behind a catalog entry. */
export const packagesOf = (entry) =>
  (entry.packages ?? [entry.id]).map((id) => ({ id, source: entry.source ?? 'winget' }))
