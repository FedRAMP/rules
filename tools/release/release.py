#!/usr/bin/env python3
"""Prepare and publish the 2026 rules distribution; never edit canonical inputs."""
import argparse
import datetime as dt
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import zipfile

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry

BASE = "fedramp-consolidated-rules"
RULES = f"{BASE}.json"
SCHEMA = f"{BASE}.schema.json"
MIN_RULES = f"{BASE}.min.json"
MIN_SCHEMA = f"{BASE}.schema.min.json"
FILES = {RULES, SCHEMA, MIN_RULES, MIN_SCHEMA}
VERSION = re.compile(r"2026\.\d{2}\.\d{2}(?:\.\d{2,})?")
MAX_FILE = 50 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys rather than silently changing the release contract."""


def mapping(loader, node):
    pairs = loader.construct_pairs(node)
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate YAML key: {key}")
        result[key] = value
    return result


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, mapping)


def json_load(data):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    def invalid(value):
        raise ValueError(f"Invalid JSON number: {value}")
    return json.loads(data, object_pairs_hook=pairs, parse_constant=invalid)


def version_key(version):
    require(isinstance(version, str) and VERSION.fullmatch(version),
            f"Invalid 2026 version: {version!r}")
    parts = tuple(map(int, version.split('.')))
    dt.date(*parts[:3])
    return parts[:3] + (parts[3] if len(parts) == 4 else 0,)


def minify(data):
    return json.dumps(json_load(data), ensure_ascii=False, separators=(',', ':'),
                      allow_nan=False).encode('utf-8')


def validate(rules, schema, version):
    document, contract = json_load(rules), json_load(schema)
    Draft202012Validator.check_schema(contract)
    # Registry has no network retriever: external references cannot fetch resources.
    Draft202012Validator(contract, format_checker=FormatChecker(),
                         registry=Registry()).validate(document)
    require(document['info']['version'] == version, "Archive/dataset version mismatch")
    date = dt.date.fromisoformat(document['info']['last_updated'])
    require(date == dt.date(*version_key(version)[:3]), "Version and last_updated dates differ")
    return document


def changelog_entries(path, info, publish):
    data = yaml.load(path.read_text(), Loader=UniqueLoader)
    require(isinstance(data, dict) and set(data) == {BASE}, "Invalid changelog root")
    entries = data[BASE]
    require(isinstance(entries, list) and entries, "Changelog must contain entries")
    previous = None
    for entry in entries:
        require(isinstance(entry, dict), "Changelog entry must be a mapping")
        require({'version', 'last_updated', 'release', 'rules', 'schema'} <= entry.keys(),
                "Missing required changelog fields")
        require(set(entry) <= {'version', 'last_updated', 'release', 'rules', 'schema',
                               'tooling', 'contributors'}, "Unknown changelog fields")
        key = version_key(entry['version'])
        require(previous is None or previous > key, "Versions must be unique and newest first")
        previous = key
        require(type(entry['release']) is bool, "release must be a boolean")
        require(isinstance(entry['last_updated'], str), "last_updated must be a quoted string")
        require(dt.date.fromisoformat(entry['last_updated']) == dt.date(*key[:3]),
                "Changelog date must match version date")
        for field in ('rules', 'schema', 'tooling', 'contributors'):
            values = entry.get(field, [])
            require(isinstance(values, list) and all(isinstance(x, str) and x.strip() for x in values),
                    f"{field} must be an array of nonempty strings")
        require(all(re.fullmatch(r'@[A-Za-z0-9][A-Za-z0-9-]*', x)
                    for x in entry.get('contributors', [])), "Invalid contributor handle")
    current = entries[0]
    require(current['version'] == info['version'] and current['last_updated'] == info['last_updated'],
            "Newest changelog metadata must match rules JSON")
    require(not publish or current['release'], "Real publication requires release: true")
    included = [current]
    for entry in entries[1:]:
        if entry['release']:
            break
        included.append(entry)
    return included


def render_notes(entries):
    lines = [
        'For additional information on this release, please review the '
        '[FedRAMP Consolidated Rules for 2026 Changelog]'
        '(https://www.fedramp.gov/2026/changelog).',
        '',
    ]
    contributors = {}
    for entry in entries:
        lines += [f"## {entry['version']}", '']
        for key, title in [('rules', 'Rules Changes'), ('schema', 'Schema And Structure Changes')]:
            if entry[key]:
                lines += [f'### {title}', '']
                lines += [f'- {text}' for text in entry[key]] + ['']
        for handle in entry.get('contributors', []):
            contributors.setdefault(handle.lower(), handle)
    if contributors:
        lines += ['## Contributors', '', ', '.join(contributors.values()), '']
    return '\n'.join(lines)


def make_zip(rules, schema):
    version = json_load(rules)['info']['version']
    version_key(version)
    prefix = f'fcr-{version}/'
    buffer = io.BytesIO()
    # Fixed timestamps, permissions and stored bytes make reruns byte-identical.
    with zipfile.ZipFile(buffer, 'w', compression=zipfile.ZIP_STORED) as archive:
        for name, data in [(RULES, rules), (SCHEMA, schema),
                           (MIN_RULES, minify(rules)), (MIN_SCHEMA, minify(schema))]:
            item = zipfile.ZipInfo(prefix + name, date_time=(1980, 1, 1, 0, 0, 0))
            item.create_system = 3
            item.external_attr = 0o100644 << 16
            archive.writestr(item, data)
    return buffer.getvalue()


def read_zip(data, version):
    version_key(version)
    require(len(data) <= MAX_FILE * 4, "Release ZIP too large")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        names = archive.namelist()
        # Retain support for previously published four-file, root-level ZIPs.
        prefix = '' if set(names) == FILES else f'fcr-{version}/'
        require(len(names) == len(FILES) and set(names) == {prefix + name for name in FILES},
                "Unexpected ZIP contents")
        for item in archive.infolist():
            require(item.file_size <= MAX_FILE and not item.is_dir() and
                    (item.external_attr >> 16) & 0o170000 in (0, 0o100000),
                    "Unsafe or oversized ZIP entry")
        files = {name: archive.read(prefix + name) for name in FILES}
    validate(files[RULES], files[SCHEMA], version)
    require(files[MIN_RULES] == minify(files[RULES]) and
            files[MIN_SCHEMA] == minify(files[SCHEMA]), "Minified files differ from originals")
    return files


def prepare(root, output, commit, publish=False, ref=''):
    require(re.fullmatch('[0-9a-f]{40}', commit), "Expected full commit SHA")
    require(not publish or ref == 'refs/heads/main', "Real publication requires main")
    rules = (root / RULES).read_bytes()
    schema = (root / 'schemas' / SCHEMA).read_bytes()
    info = json_load(rules)['info']
    validate(rules, schema, info['version'])
    entries = changelog_entries(root / 'CHANGELOG.yml', info, publish)
    output.mkdir(parents=True, exist_ok=True)
    filename = f"{BASE}-{info['version']}.zip"
    (output / filename).write_bytes(make_zip(rules, schema))
    (output / 'release-notes.md').write_text(render_notes(entries))
    manifest = dict(version=info['version'], commit=commit, asset=filename,
                    included_versions=[entry['version'] for entry in entries])
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    return manifest


class GitHub:
    def __init__(self, repository):
        require(re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repository), "Invalid repository")
        self.repository = repository

    def api(self, path, method='GET', payload=None, optional=False, binary=False):
        command = ['gh', 'api', f'repos/{self.repository}/{path}', '--method', method,
                   '-H', 'X-GitHub-Api-Version: 2022-11-28']
        if binary:
            command += ['-H', 'Accept: application/octet-stream']
        if payload is not None:
            command += ['--input', '-']
        result = subprocess.run(command, input=json.dumps(payload).encode() if payload is not None else None,
                                capture_output=True, timeout=120)
        if result.returncode:
            if optional and '(HTTP 404)' in result.stderr.decode():
                return None
            detail = result.stderr.decode().strip()
            try:
                response = json_load(result.stdout)
            except (ValueError, UnicodeDecodeError):
                response = {}
            message = response.get('message', '') if isinstance(response, dict) else ''
            if message and message not in detail:
                detail += f' Response: {message}'
            raise RuntimeError(f'GitHub API {method} repos/{self.repository}/{path}: {detail}')
        return result.stdout if binary else json_load(result.stdout) if result.stdout else None

    def releases(self):
        result = []
        page = 1
        while True:
            batch = self.api(f'releases?per_page=100&page={page}')
            result.extend(batch)
            if len(batch) < 100:
                return result
            page += 1

    def tag(self, name):
        ref = self.api(f'git/ref/tags/{name}', optional=True)
        if ref is None:
            return None
        obj = ref['object']
        for _ in range(8):
            if obj['type'] == 'commit':
                return obj['sha']
            require(obj['type'] == 'tag', 'Tag must resolve to a commit')
            obj = self.api(f"git/tags/{obj['sha']}")['object']
        raise ValueError('Tag nesting too deep')

    def asset(self, release, version, allow_unfinished=False):
        assets = self.api(f"releases/{release['id']}/assets?per_page=100")
        require(len(assets) <= 1, f'Unexpected assets on {version}')
        if not assets:
            return None
        asset = assets[0]
        require(asset['name'] == f'{BASE}-{version}.zip', f'Unexpected asset on {version}')
        if allow_unfinished and asset['state'] != 'uploaded':
            return None
        require(asset['state'] == 'uploaded', f'Incomplete asset on {version}')
        require(asset['size'] <= MAX_FILE * 4, 'Release asset too large')
        return self.api(f"releases/assets/{asset['id']}", binary=True)

    def upload(self, version, path, replace=False):
        subprocess.run(['gh', 'release', 'upload', version, str(path), '--repo', self.repository]
                       + (['--clobber'] if replace else []),
                       check=True, timeout=120)


def write_pages(directory, archives):
    require(not directory.exists() or not any(directory.iterdir()), 'Pages output must be empty')
    directory.mkdir(parents=True, exist_ok=True)
    latest = max(archives, key=version_key)
    for version, files in archives.items():
        (directory / f'{BASE}-{version}.json').write_bytes(files[MIN_RULES])
        (directory / f'{BASE}-{version}.schema.json').write_bytes(files[MIN_SCHEMA])
    (directory / f'{BASE}-2026.json').write_bytes(archives[latest][MIN_RULES])
    (directory / f'{BASE}-2026.schema.json').write_bytes(archives[latest][MIN_SCHEMA])
    lines = [
        '<!doctype html>',
        '<html lang="en">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        '<title>FedRAMP Consolidated Rules for 2026</title>',
        '</head>',
        '<body>',
        '<h1>FedRAMP Consolidated Rules for 2026</h1>',
        '<p>Download the machine-readable rules and their JSON Schema. All JSON files are minified.</p>',
        '<h2>Current Release</h2>',
        f'<p>Version {latest}. These links update when a new release is published.</p>',
        '<ul>',
    ]
    for suffix in ('.json', '.schema.json'):
        name = f'{BASE}-2026{suffix}'
        lines.append(f'<li><a href="{name}">{name}</a></li>')
    lines += ['</ul>', '<h2>Versioned Releases</h2>',
              '<p>Use these links to pin a specific release.</p>']
    for version in sorted(archives, key=version_key, reverse=True):
        lines += [f'<h3>{version}</h3>', '<ul>']
        for suffix in ('.json', '.schema.json'):
            name = f'{BASE}-{version}{suffix}'
            lines.append(f'<li><a href="{name}">{name}</a></li>')
        lines.append('</ul>')
    lines += ['</body>', '</html>']
    (directory / 'index.html').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def publish(github, output, pages, dry_run=False, force=False):
    manifest = json_load((output / 'manifest.json').read_bytes())
    version, commit = manifest['version'], manifest['commit']
    key = version_key(version)
    notes = (output / 'release-notes.md').read_text()
    candidate = (output / manifest['asset']).read_bytes()
    archives = {version: read_zip(candidate, version)}
    existing = github.api(f'releases/tags/{version}', optional=True)
    target = github.tag(version)
    require(force or target in (None, commit), 'Existing version tag points to a different commit')
    existing_asset = None
    if existing:
        require(not force or not existing.get('immutable', False),
                'GitHub marks this release immutable; force replacement is unavailable')
        require(force or (target == commit and existing['name'] == version and existing['body'] == notes
                and not existing['prerelease']), 'Existing release metadata conflicts')
        existing_asset = github.asset(existing, version, allow_unfinished=force)
        require(force or existing_asset is None or existing_asset == candidate, 'Existing release asset differs')
        require(force or existing['draft'] or existing_asset is not None, 'Published release has no asset')
    published_commits = set()
    for release in github.releases():
        name = release['tag_name']
        if release['draft'] or release['prerelease'] or not VERSION.fullmatch(name):
            continue
        require(version_key(name) <= key, 'A newer version is already published; refusing rollback')
        release_commit = github.tag(name)
        require(release_commit is not None or (force and name == version),
                f'Missing historical tag: {name}')
        published_commits.add(release_commit)
        if name != version:
            data = github.asset(release, name)
            require(data is not None, f'Missing historical ZIP: {name}')
            archives[name] = read_zip(data, name)
    alias = github.tag('2026')
    # A deleted release can leave its moving tag behind. Explicit force mode
    # repairs that orphan too, after the newer-release check above has passed.
    require(force or alias is None or alias == commit or alias in published_commits,
            '2026 tag does not point to a known release; use force replacement to repair it')
    write_pages(pages, archives)  # Complete validation and Pages staging before mutation.
    if dry_run:
        replacement = (f' Force replacement enabled for {version}: dated tag, release notes, ZIP, '
                       '2026 alias and Pages would be reissued.' if force else '')
        return ('Dry run: validated notes, ZIP and Pages preview; no tags, releases or deployments changed.'
                + replacement)
    if force and existing:
        # Withdraw the mutable release while replacing its content; retain its ID.
        github.api(f"releases/{existing['id']}", 'PATCH',
                   dict(name=version, body=notes, target_commitish=commit, draft=True, prerelease=False))
        existing['draft'] = True
    if target is None:
        github.api('git/refs', 'POST', {'ref': f'refs/tags/{version}', 'sha': commit})
    elif force and target != commit:
        github.api(f'git/refs/tags/{version}', 'PATCH', {'sha': commit, 'force': True})
    if existing is None:
        existing = github.api('releases', 'POST', dict(tag_name=version, target_commitish=commit,
                              name=version, body=notes, draft=True, prerelease=False))
    if force or existing_asset is None:
        if force:
            github.upload(version, output / manifest['asset'], replace=True)
        else:
            github.upload(version, output / manifest['asset'])
        require(github.asset(existing, version) == candidate, 'Uploaded asset verification failed')
    if existing['draft']:
        github.api(f"releases/{existing['id']}", 'PATCH', {'draft': False, 'make_latest': 'true'})
    # Normal retries only repair pointers; explicit force mode replaces the selected version.
    if alias is None:
        github.api('git/refs', 'POST', {'ref': 'refs/tags/2026', 'sha': commit})
    elif alias != commit:
        github.api('git/refs/tags/2026', 'PATCH', {'sha': commit, 'force': True})
    action = 'force-replaced' if force else 'published'
    return f'Release {version} {action} and 2026 tag updated. Pages deployment is pending.'


def summary(output, status):
    manifest = json_load((output / 'manifest.json').read_bytes())
    text = (f"## Release preparation\n\n{status}\n\n"
            f"- Commit: `{manifest['commit']}`\n"
            f"- Included versions: {', '.join(manifest['included_versions'])}\n"
            f"- Asset: `{manifest['asset']}`\n"
            f"- ZIP files: {', '.join(sorted(FILES))}\n\n"
            + (output / 'release-notes.md').read_text())
    print(text)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as stream:
            stream.write(text + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--pages', type=Path, required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--ref', default='')
    parser.add_argument('--repository', required=True)
    parser.add_argument('--publish', action='store_true')
    parser.add_argument('--force', action='store_true',
                        help='Replace the selected version, including its dated tag, notes and ZIP')
    args = parser.parse_args()
    try:
        prepare(args.root, args.output, args.commit, args.publish, args.ref)
        status = publish(GitHub(args.repository), args.output, args.pages, dry_run=not args.publish, force=args.force)
        summary(args.output, status)
    except Exception as error:
        status = f'Failed: {error}. Publication may be partial if this was a real run; inspect tags/releases and rerun the same commit.'
        if (args.output / 'manifest.json').exists():
            summary(args.output, status)
        else:
            print(status, file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
