// The release notes shown in Settings → About come straight from
// CHANGELOG.md, so the file is the only place they're written.
import changelogText from '../../../../CHANGELOG.md?raw'

const plain = (text) => text.replace(/\*\*|`/g, '').trim()

/** [{ version, date, groups: [{ title, items: [string] }] }], newest first. */
function parseChangelog(text) {
  const releases = []
  let release = null
  let group = null
  for (const line of text.split(/\r?\n/)) {
    const heading = /^## +([\d.]+)(?:\s+—\s+(.+))?/.exec(line)
    if (heading) {
      release = { version: heading[1], date: heading[2]?.trim() ?? null, groups: [] }
      releases.push(release)
      group = null
    } else if (release && line.startsWith('### ')) {
      group = { title: plain(line.slice(4)), items: [] }
      release.groups.push(group)
    } else if (group && /^- /.test(line)) {
      group.items.push(plain(line.slice(2)))
    }
  }
  return releases
}

export const RELEASES = parseChangelog(changelogText)
