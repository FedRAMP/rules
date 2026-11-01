import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import yaml
import release as r

SHA = 'a' * 40
OLD_SHA = 'b' * 40
V = '2026.11.02.01'
OLD = '2026.10.01.01'
SCHEMA = json.dumps({'$schema': 'https://json-schema.org/draft/2020-12/schema',
                     'type': 'object', 'required': ['info']}).encode()


def rules(version=V):
    return json.dumps({'info': {'version': version, 'last_updated': version[:10].replace('.', '-')}},
                      indent=2).encode()


def entry(version=V, released=True):
    return dict(version=version, last_updated=version[:10].replace('.', '-'), release=released,
                rules=['Rule [link](https://example.com)'], schema=['Schema change'],
                tooling=['Hidden tooling'], contributors=['@Example'])


class FakeGitHub:
    def __init__(self):
        self.tags = {}
        self.records = {}
        self.assets = {}
        self.writes = []
        self.fail_upload = False
        self.fail_alias = False

    def api(self, path, method='GET', payload=None, optional=False, binary=False):
        if method == 'GET':
            assert path.startswith('releases/tags/')
            return copy.deepcopy(self.records.get(path.removeprefix('releases/tags/')))
        self.writes.append((path, method, payload))
        if path == 'git/refs':
            name = payload['ref'].removeprefix('refs/tags/')
            if name == '2026' and self.fail_alias:
                raise RuntimeError('Simulated alias failure')
            self.tags[name] = payload['sha']
        elif path.startswith('git/refs/tags/'):
            name = path.removeprefix('git/refs/tags/')
            if name == '2026' and self.fail_alias:
                raise RuntimeError('Simulated alias failure')
            self.tags[name] = payload['sha']
        elif path == 'releases':
            record = dict(payload, id=len(self.records) + 1)
            self.records[payload['tag_name']] = record
            return copy.deepcopy(record)
        elif path.startswith('releases/'):
            record = next(x for x in self.records.values() if str(x['id']) == path.split('/')[1])
            record.update(payload)
        else:
            raise AssertionError(path)

    def tag(self, name):
        return self.tags.get(name)

    def asset(self, record, version, allow_unfinished=False):
        return self.assets.get(version)

    def upload(self, version, path, replace=False):
        if self.fail_upload:
            raise RuntimeError('Simulated upload failure')
        self.writes.append(('upload', version))
        self.assets[version] = path.read_bytes()

    def releases(self):
        return copy.deepcopy(list(self.records.values()))

    def seed(self, version=OLD, commit=OLD_SHA):
        self.tags[version] = commit
        self.tags['2026'] = commit
        self.records[version] = dict(id=len(self.records) + 1, tag_name=version,
                                    name=version, body='old notes', draft=False, prerelease=False)
        self.assets[version] = r.make_zip(rules(version), SCHEMA)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / 'schemas').mkdir()
        (self.root / r.RULES).write_bytes(rules())
        (self.root / 'schemas' / r.SCHEMA).write_bytes(SCHEMA)
        self.output = self.root / 'output'
        self.github = FakeGitHub()
        self.set_entries([entry()])

    def set_entries(self, entries):
        (self.root / 'CHANGELOG.yml').write_text(yaml.safe_dump({r.BASE: entries}))

    def prepare(self, publish=False, ref='refs/heads/main'):
        return r.prepare(self.root, self.output, SHA, publish, ref)

    def publish(self, dry_run=False, directory='pages'):
        return r.publish(self.github, self.output, self.root / directory, dry_run)

    def test_rollup_boundary_and_contributors(self):
        pending = entry('2026.11.01.01', False)
        pending['contributors'] = ['@example', '@Another']
        self.set_entries([entry(), pending, entry(OLD), entry('2026.09.01.01', False)])
        manifest = self.prepare()
        self.assertEqual(manifest['included_versions'], [V, '2026.11.01.01'])
        notes = (self.output / 'release-notes.md').read_text()
        self.assertIn('@Example, @Another', notes)
        self.assertNotIn('Hidden tooling', notes)
        self.assertNotIn(OLD, notes)
        self.assertIn('[link](https://example.com)', notes)

    def test_first_release_includes_all_pending_entries(self):
        self.set_entries([entry(), entry('2026.11.01.01', False), entry(OLD, False)])
        self.assertEqual(len(self.prepare()['included_versions']), 3)

    def test_release_and_branch_eligibility(self):
        self.set_entries([entry(released=False)])
        self.prepare(ref='refs/heads/develop')
        with self.assertRaisesRegex(ValueError, 'release: true'):
            self.prepare(publish=True)
        with self.assertRaisesRegex(ValueError, 'requires main'):
            self.prepare(publish=True, ref='refs/heads/develop')

    def test_invalid_changelogs(self):
        invalid = []
        for key, value in [('release', 'false'), ('rules', 'text'), ('last_updated', '2026-11-01'),
                           ('version', '2026.02.30.01'), ('contributors', ['not-a-handle'])]:
            item = entry()
            item[key] = value
            invalid.append([item])
        missing = entry()
        del missing['release']
        invalid += [[missing], [entry(), entry()], [entry(OLD), entry()]]
        for entries in invalid:
            with self.subTest(entries=entries):
                self.set_entries(entries)
                with self.assertRaises(ValueError):
                    self.prepare()

    def test_duplicate_yaml_and_json_keys(self):
        (self.root / 'CHANGELOG.yml').write_text(f'{r.BASE}: []\n{r.BASE}: []\n')
        with self.assertRaisesRegex(ValueError, 'Duplicate YAML'):
            self.prepare()
        with self.assertRaisesRegex(ValueError, 'Duplicate JSON'):
            r.json_load('{"a": 1, "a": 2}')

    def test_numeric_version_order(self):
        self.assertGreater(r.version_key('2026.11.02.100'), r.version_key('2026.11.02.99'))
        self.assertEqual(r.version_key('2026.11.02'), r.version_key('2026.11.02.00'))

    def test_zip_is_deterministic_and_preserves_original_bytes(self):
        manifest = self.prepare()
        data = (self.output / manifest['asset']).read_bytes()
        self.prepare()
        self.assertEqual(data, (self.output / manifest['asset']).read_bytes())
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            self.assertEqual(set(archive.namelist()), {f'fcr-{V}/{name}' for name in r.FILES})
        files = r.read_zip(data, V)
        self.assertEqual(set(files), r.FILES)
        self.assertEqual(files[r.RULES], rules())
        self.assertEqual(files[r.SCHEMA], SCHEMA)
        self.assertEqual(json.loads(files[r.MIN_RULES]), json.loads(rules()))
        self.assertNotIn(b'\n', files[r.MIN_RULES])

    def test_schema_validation_and_uri_formats(self):
        contract = json.dumps({'type': 'object', 'properties': {'url': {'format': 'uri'}}}).encode()
        bad = json.loads(rules())
        bad['url'] = 'not a uri'
        with self.assertRaises(Exception):
            r.validate(json.dumps(bad).encode(), contract, V)
        with self.assertRaises(Exception):
            r.validate(b'{}', SCHEMA, V)

    def test_malformed_zip_and_minified_mismatch(self):
        for name, content in [('../escape', b'bad'), (r.MIN_RULES, b'{}')]:
            data = io.BytesIO()
            with zipfile.ZipFile(data, 'w') as archive:
                archive.writestr(r.RULES, rules())
                archive.writestr(r.SCHEMA, SCHEMA)
                archive.writestr(r.MIN_SCHEMA, r.minify(SCHEMA))
                archive.writestr(name, content)
            with self.assertRaises(ValueError):
                r.read_zip(data.getvalue(), V)

    def test_legacy_root_archives_and_wrong_version_directory(self):
        files = r.read_zip(r.make_zip(rules(), SCHEMA), V)
        for prefix in ('', f'fcr-{OLD}/', '../', f'fcr-{V}/nested/'):
            with self.subTest(prefix=prefix):
                data = io.BytesIO()
                with zipfile.ZipFile(data, 'w') as archive:
                    for name, content in files.items():
                        archive.writestr(prefix + name, content)
                if prefix == '':
                    self.assertEqual(r.read_zip(data.getvalue(), V), files)
                else:
                    with self.assertRaisesRegex(ValueError, 'Unexpected ZIP contents'):
                        r.read_zip(data.getvalue(), V)

    def test_dry_run_does_not_mutate_github(self):
        self.github.seed()
        self.prepare()
        self.publish(dry_run=True)
        self.assertEqual(self.github.writes, [])
        pages = self.root / 'pages'
        self.assertEqual(len(list(pages.iterdir())), 7)
        self.assertEqual((pages / f'{r.BASE}-2026.json').read_bytes(), r.minify(rules()))
        self.assertEqual((pages / f'{r.BASE}-{OLD}.json').read_bytes(), r.minify(rules(OLD)))
        self.assertTrue(all(p.suffix == '.json' or p.name == 'index.html' for p in pages.iterdir()))
        index = (pages / 'index.html').read_text()
        for path in pages.glob('*.json'):
            self.assertIn(f'href="{path.name}"', index)
        self.assertLess(index.index(f'<h3>{V}</h3>'), index.index(f'<h3>{OLD}</h3>'))
        self.assertNotIn('<script', index)

    def test_publish_and_idempotent_retry(self):
        self.prepare(True)
        self.publish()
        self.assertFalse(self.github.records[V]['draft'])
        self.assertEqual(self.github.tags['2026'], SHA)
        self.assertEqual(self.github.records[V]['make_latest'], 'true')
        count = len(self.github.writes)
        self.publish(directory='retry')
        self.assertEqual(len(self.github.writes), count)

    def test_resume_after_upload_failure(self):
        self.prepare(True)
        self.github.fail_upload = True
        with self.assertRaises(RuntimeError):
            self.publish()
        self.assertTrue(self.github.records[V]['draft'])
        self.assertNotIn('2026', self.github.tags)
        self.github.fail_upload = False
        self.publish(directory='retry')
        self.assertFalse(self.github.records[V]['draft'])

    def test_resume_after_alias_failure(self):
        self.prepare(True)
        self.github.fail_alias = True
        with self.assertRaises(RuntimeError):
            self.publish()
        self.assertFalse(self.github.records[V]['draft'])
        self.github.fail_alias = False
        self.publish(directory='retry')
        self.assertEqual(self.github.tags['2026'], SHA)

    def test_tag_notes_and_asset_conflicts(self):
        self.prepare(True)
        self.publish()
        for field in ('tag', 'body', 'asset'):
            with self.subTest(field=field):
                gh = copy.deepcopy(self.github)
                if field == 'tag':
                    gh.tags[V] = OLD_SHA
                elif field == 'body':
                    gh.records[V]['body'] = 'edited'
                else:
                    gh.assets[V] = b'changed'
                gh.writes = []
                with self.assertRaises(ValueError):
                    r.publish(gh, self.output, self.root / field)
                self.assertEqual(gh.writes, [])

    def test_newer_release_and_missing_history_block_before_writes(self):
        self.prepare(True)
        for version in (OLD, '2026.12.01.01'):
            gh = FakeGitHub()
            gh.seed(version)
            if version == OLD:
                del gh.assets[OLD]
            with self.assertRaises(ValueError):
                r.publish(gh, self.output, self.root / version)
            self.assertEqual(gh.writes, [])

    def test_ignore_drafts_prereleases_and_unrelated_tags(self):
        self.prepare()
        for version, changes in [('2026.12.01.01', {'draft': True}),
                                 ('2026.12.02.01', {'prerelease': True}),
                                 ('v1.0.0', {})]:
            self.github.records[version] = dict(tag_name=version, draft=False, prerelease=False) | changes
        self.publish(dry_run=True)
        self.assertEqual(len(list((self.root / 'pages').iterdir())), 5)

    def test_force_replaces_current_version_and_preserves_history(self):
        self.github.seed()
        historical = self.github.assets[OLD]
        self.github.seed(V, 'c' * 40)
        self.github.assets[V] = b'old archive layout'
        original_id = self.github.records[V]['id']
        self.prepare(True)
        r.publish(self.github, self.output, self.root / 'force', force=True)
        self.assertEqual(self.github.tags[V], SHA)
        self.assertEqual(self.github.tags['2026'], SHA)
        self.assertEqual(self.github.records[V]['id'], original_id)
        self.assertEqual(self.github.records[V]['body'], (self.output / 'release-notes.md').read_text())
        self.assertFalse(self.github.records[V]['draft'])
        self.assertEqual(self.github.assets[V], (self.output / f'{r.BASE}-{V}.zip').read_bytes())
        self.assertEqual(self.github.assets[OLD], historical)
        self.assertTrue((self.root / 'force' / f'{r.BASE}-{OLD}.json').is_file())

    def test_force_dry_run_previews_conflicts_without_writes(self):
        self.github.seed(V, OLD_SHA)
        self.prepare()
        status = r.publish(self.github, self.output, self.root / 'force', dry_run=True, force=True)
        self.assertIn('Force replacement enabled', status)
        self.assertEqual(self.github.writes, [])
        self.assertEqual(self.github.tags[V], OLD_SHA)

    def test_force_repairs_orphan_alias_without_existing_release(self):
        self.prepare(True)
        for dated_tag_exists in (False, True):
            with self.subTest(dated_tag_exists=dated_tag_exists):
                gh = FakeGitHub()
                gh.tags['2026'] = OLD_SHA
                if dated_tag_exists:
                    gh.tags[V] = SHA
                with self.assertRaisesRegex(ValueError, '2026 tag does not point'):
                    r.publish(gh, self.output, self.root / f'normal-{dated_tag_exists}')
                self.assertEqual(gh.writes, [])
                r.publish(gh, self.output, self.root / f'preview-{dated_tag_exists}',
                          dry_run=True, force=True)
                self.assertEqual(gh.writes, [])
                self.assertEqual(gh.tags['2026'], OLD_SHA)
                r.publish(gh, self.output, self.root / f'force-{dated_tag_exists}', force=True)
                self.assertEqual(gh.tags[V], SHA)
                self.assertEqual(gh.tags['2026'], SHA)
                self.assertFalse(gh.records[V]['draft'])

    def test_force_recovers_after_failed_upload_and_alias_update(self):
        for failure in ('fail_upload', 'fail_alias'):
            with self.subTest(failure=failure):
                gh = FakeGitHub()
                gh.seed(V, OLD_SHA)
                self.prepare(True)
                setattr(gh, failure, True)
                with self.assertRaises(RuntimeError):
                    r.publish(gh, self.output, self.root / failure, force=True)
                self.assertEqual(gh.tags[V], SHA)
                self.assertEqual(gh.tags['2026'], OLD_SHA)
                setattr(gh, failure, False)
                r.publish(gh, self.output, self.root / (failure + '-retry'), force=True)
                self.assertEqual(gh.tags['2026'], SHA)
                self.assertFalse(gh.records[V]['draft'])

    def test_force_does_not_override_newer_or_immutable_releases(self):
        self.prepare(True)
        for immutable in (True, False):
            gh = FakeGitHub()
            gh.seed(V, OLD_SHA)
            if immutable:
                gh.records[V]['immutable'] = True
            else:
                gh.seed('2026.12.01.01')
            with self.assertRaisesRegex(ValueError, 'immutable|newer version'):
                r.publish(gh, self.output, self.root / str(immutable), force=True)
            self.assertEqual(gh.writes, [])

    def test_force_can_retry_an_unfinished_asset_upload(self):
        gh = r.GitHub('example/rules')
        asset = dict(name=f'{r.BASE}-{V}.zip', state='starter')
        with patch.object(gh, 'api', return_value=[asset]):
            with self.assertRaisesRegex(ValueError, 'Incomplete asset'):
                gh.asset({'id': 1}, V)
            self.assertIsNone(gh.asset({'id': 1}, V, allow_unfinished=True))

    def test_upload_replacement_uses_explicit_clobber_flag(self):
        gh = r.GitHub('example/rules')
        with patch('release.subprocess.run') as run:
            gh.upload(V, Path('asset.zip'))
            self.assertNotIn('--clobber', run.call_args.args[0])
            gh.upload(V, Path('asset.zip'), replace=True)
            self.assertIn('--clobber', run.call_args.args[0])

    def test_release_pagination(self):
        github = r.GitHub('example/rules')
        with patch.object(github, 'api', side_effect=[[{}] * 100, [{}]]) as api:
            self.assertEqual(len(github.releases()), 101)
            self.assertEqual(api.call_args_list[1].args[0], 'releases?per_page=100&page=2')

    def test_annotated_tag_resolution(self):
        github = r.GitHub('example/rules')
        with patch.object(github, 'api', side_effect=[{'object': {'type': 'tag', 'sha': OLD_SHA}},
                                                     {'object': {'type': 'commit', 'sha': SHA}}]):
            self.assertEqual(github.tag(V), SHA)


if __name__ == '__main__':
    unittest.main()
