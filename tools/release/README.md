# Rules releases

The **Release FedRAMP Consolidated Rules** workflow is manual. Pushes and tool changes never publish a
release. It operates in whichever repository contains it; it does not publish
from this fork into another repository.

## One-time repository setup

1. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
2. Allow the `github-pages` environment to deploy from `main`. Retain any desired
   environment review rules.
3. Ensure repository/organization policy permits the workflow's `GITHUB_TOKEN`
   to create releases and dated tags and update the `2026` tag. Tag rulesets must
   permit these operations; the workflow uses only `GITHUB_TOKEN` and does not
   bypass rulesets. No separately created token or Actions secret is configured.
4. Merge the workflow into the default branch so GitHub exposes its manual Run
   workflow button. Production publication is restricted to `main`.

All jobs use Ubuntu 26.04 and each has a ten-minute timeout. The three-job run can
therefore exceed ten minutes overall. Runs share one concurrency group and do
not cancel an active run; GitHub may replace an older pending run with a newer
pending run. Only official GitHub actions are used, pinned to full commit SHAs.
The Python release dependencies, including transitive dependencies, are pinned
in `requirements.txt`; Python 3.13 or newer is required.

## Prepare a version

Edit the rules metadata and prepend an entry to `CHANGELOG.yml`. Versions are
`2026.MM.DD` or `2026.MM.DD.NN`, with a valid calendar date and an optional numeric
revision of at least two digits. No `v` prefix is added. Date and revision
components are compared numerically. An omitted revision is equivalent to zero;
do not record both an omitted revision and `.00` for the same date.

The changelog is newest first. Its latest `version` and quoted `last_updated`
must match the rules JSON; the date must match the version's date. The workflow
uses the recorded date and never rewrites it to the execution date.

Each entry requires `version`, `last_updated`, boolean `release`, and string
arrays `rules` and `schema`. Optional `tooling` and `contributors` are string
arrays; contributors use `@handle` syntax. Empty categories use `[]`. Unknown
fields, duplicate YAML keys, duplicate versions, and incorrect ordering fail.

Use `release: false` for interim changes. For the version being formally
published, use `release: true`. Release notes include this entry and consecutive
older false entries, stopping **before** the next true entry. That boundary is
based on the changelog, so do not mark an interim version true unless it is
intended to be a release. Notes retain Markdown, group rules/schema changes by
version, omit tooling, and deduplicate contributor handles case-insensitively.
There is no automatic contributor discovery from commits.

## Preview and publish

In **Actions → Release FedRAMP Consolidated Rules → Run workflow**, select a branch and leave
**dry_run** checked. A preview may use `release: false`. Review the job summary
and download `Rules Release Preview Files` (notes, manifest, ZIP) and `Minified Pages Preview Files`
(minified JSON collection). Previews read GitHub release/tag state and detect
conflicts, but create no tags, releases, or Pages deployments.

Commit and push the intended dataset, schema, changelog, and workflow changes to
`main`. Run again on `main` with **dry_run** unchecked to publish. The workflow
first repeats the preview, then publishes exactly the dispatched commit. By
default, reusing a published version for changed content or a different commit
is rejected. Use the explicit replacement option below for fork testing.

CLI equivalents, executed from this repository:

```sh
gh workflow run release.yml --ref main -f dry_run=true
gh run list --workflow release.yml --limit 5
# After reviewing the preview:
gh workflow run release.yml --ref main -f dry_run=false
```

Each release has one uploaded asset:
`fedramp-consolidated-rules-$VERSION.zip`. It contains exactly four files inside a `fcr-$VERSION/` directory:

- `fedramp-consolidated-rules.json` — unchanged source bytes
- `fedramp-consolidated-rules.schema.json` — unchanged source bytes from `schemas/`
- `fedramp-consolidated-rules.min.json` — compact JSON
- `fedramp-consolidated-rules.schema.min.json` — compact JSON

JSON is parsed and validated against the local Draft 2020-12 schema, including
URI/date formats. Minified files preserve JSON values and UTF-8 text. ZIP entries
have fixed metadata and use stored compression so reruns produce identical ZIP
bytes across environments. GitHub also provides its automatic full-repository
source archives; consumers should choose the named distribution asset.

## Consumer URLs and history

With `BASE_URL` set to this repository's Pages URL (shown by the deployment job),
the current release is available at:

```text
$BASE_URL/fedramp-consolidated-rules-2026.json
$BASE_URL/fedramp-consolidated-rules-2026.schema.json
```

Pinned files, for example:

```text
$BASE_URL/fedramp-consolidated-rules-2026.11.02.01.json
$BASE_URL/fedramp-consolidated-rules-2026.11.02.01.schema.json
```

Every Pages JSON is minified; the URLs do not add `.min`. Pages contains these
JSON files and a single `index.html` with a brief explanation and relative links
to the current and dated files, newest first. The index uses plain HTML with no
JavaScript, stylesheets, or external assets. ZIPs, source tools, and release
notes are not published to Pages.

The dated tag and release remain fixed unless force replacement is explicitly
selected. The `2026` Git tag and Pages aliases
advance to the latest published dated version; there is no rolling `2026`
GitHub Release. Each deployment reconstructs history from this repository's
published 2026 release ZIPs, using each version's own schema. It paginates release
discovery and excludes drafts, prereleases, and unrelated tag formats.
Unreleased versions are represented in the notes, not separate files.

Retain historical releases and their assets: they are the source of Pages
history. Missing, malformed, or oversized assets stop publication. Conflicting
bytes for the version being published also stop publication.
Each original/minified JSON member is limited to 50 MiB. Previously published four-file ZIPs with files at the archive root remain
supported when rebuilding Pages history. Other layouts require deliberate
migration. Rerunning publication of an older root-layout release with this
helper will reject the changed ZIP bytes by default; use its original workflow
revision, publish a new version, or explicitly force replacement for testing.
The new version must be at least as recent as all already published versions.

## Diagnosing GitHub permission failures

This workflow uses only the built-in `GITHUB_TOKEN`. The publishing job requests
`contents: write`; preview jobs remain read-only. API failures identify the HTTP
method, endpoint, and GitHub's error response. For a 403, inspect that operation,
the job's effective token permissions, and applicable repository rules before
changing authentication. A generic 403 alone does not establish that a separate
token is required. Do not add `actions: write` as a substitute for workflow-file
permissions; they are different capabilities.

## Force replacement for fork testing

The **Force Replace Existing Release, Tag, and Assets** checkbox defaults to off.
Select it to reissue the newest version from the commit selected at dispatch,
without incrementing the version. Start a new workflow run on `main` to use the
latest commit; **Re-run all jobs** retains the original run's commit and inputs.

With both preview and force checked, the workflow previews the replacement and
makes no remote changes. With preview unchecked and force checked, it updates
the dated tag, release name/notes, ZIP, `2026` tag, and Pages collection. Historical
versions remain intact. It also repairs a leftover `2026` tag when its release
record has been deleted. For an existing release, it retains the release ID,
temporarily makes the release
a draft, replaces the ZIP, and republishes it as latest. A failed replacement
can leave it in draft; retry with force enabled to finish.

```sh
# Preview a replacement on this fork:
gh workflow run release.yml --repo FedRAMP/rules-releasemgt --ref main \
  -f dry_run=true -f force_replace=true
# Actually replace the release on this fork:
gh workflow run release.yml --repo FedRAMP/rules-releasemgt --ref main \
  -f dry_run=false -f force_replace=true
```

Force mode still requires valid data, `main`, and `release: true` for publication.
It refuses to roll back past a newer published version. GitHub-enforced immutable
releases cannot be replaced, and tag protection rules still apply. Use new
versions for normal consumer releases: force mode deliberately changes the
contents behind previously pinned version URLs. The local helper accepts the
equivalent `--force` flag; it remains read-only unless `--publish` is also passed.

## Failures and retries

Preparation stages and validates all ZIPs and Pages files before remote writes.
Publication creates the dated tag, creates a draft release, uploads and verifies
the ZIP, publishes the release as latest, advances `2026`, and deploys Pages.
These operations are not one transaction. A failure can leave a tag, draft,
published release, or advanced alias while Pages still serves the prior data.

Use **Re-run all jobs** on the same run to retain its original commit. Matching
existing tags, notes, and ZIP bytes are accepted; without force, conflicting state fails rather
than overwriting a published release. Missing uploads on matching drafts are
resumed. A failed Pages job can also be rerun directly while its Pages artifact
is available. If it has expired, rerun all jobs to reconstruct it.

Do not manually edit published notes or assets if you want automatic retries to
succeed. A partial/unrecognized upload fails for inspection instead of being
automatically deleted. If another newer version has already shipped, rerun that
newer version to repair Pages. Correct released content by publishing a new
dated version, rather than moving dated tags or rolling `2026` backward.

## Local checks

```sh
python3 -m venv /tmp/rules-release-venv
/tmp/rules-release-venv/bin/pip install -r tools/release/requirements.txt
/tmp/rules-release-venv/bin/python -m unittest discover -s tools/release -p 'test_*.py'
# Read-only GitHub preflight; local output directories must be new/empty.
/tmp/rules-release-venv/bin/python tools/release/release.py \
  --output /tmp/rules-release-preview --pages /tmp/rules-pages-preview \
  --commit "$(git rev-parse HEAD)" --ref "$(git symbolic-ref HEAD)" \
  --repository "$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
```

Local previews use the working-tree files, which may differ from the supplied
commit. Actions always uses a clean checkout of the dispatched commit. Unit
tests simulate GitHub writes and failure recovery; they do not publish anything.
Run `bun run check` from `tools/` for the existing maintenance suite. Validate
`.github/workflows/release.yml` with actionlint; older actionlint runner catalogs
need the narrow `-ignore 'label "ubuntu-26.04" is unknown'` allowance.
