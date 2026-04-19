#!/bin/sh

set -eu

repo_root="$(git rev-parse --show-toplevel)"

git -C "$repo_root" config core.hooksPath .githooks

echo "Configured Git hooks path to $repo_root/.githooks"
