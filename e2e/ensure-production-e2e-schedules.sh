#!/usr/bin/env bash
# Idempotent: make the production e2e pipeline schedules of Curiosity-Corp/ignite-curiosity match git (hypervoid/admiral#123).
# Three schedules on master, each with PRODUCTION_E2E=true, 70 minutes after each ship window opens
# (07:00, 13:00, 19:00 UTC; windows last 60 minutes): 08:10, 14:10 and 20:10 UTC.
# Safe to re-run: it finds schedules by description and updates them instead of adding duplicates.
#
#   bash e2e/ensure-production-e2e-schedules.sh             # create or update, active
#   bash e2e/ensure-production-e2e-schedules.sh --inactive  # create or update, paused
#
# Needs glab signed in as a Maintainer of the project. Schedule ownership follows whoever runs it.
set -euo pipefail

project="${PRODUCTION_E2E_PROJECT:-Curiosity-Corp/ignite-curiosity}"
ref="${PRODUCTION_E2E_REF:-master}"
active=true
case "${1:-}" in
  "") ;;
  --inactive) active=false ;;
  *) echo "usage: $0 [--inactive]" >&2; exit 2 ;;
esac

command -v glab >/dev/null || { echo "glab is not installed" >&2; exit 2; }
command -v jq >/dev/null || { echo "jq is not installed" >&2; exit 2; }
enc=$(jq -rn --arg p "$project" '$p | @uri')

if ! schedules=$(glab api --paginate "projects/$enc/pipeline_schedules?per_page=100"); then
  echo "could not list the pipeline schedules of $project" >&2
  exit 1
fi

for window in 07 13 19; do
  hour=$((10#$window + 1))
  cron="10 $hour * * *"
  description="Production e2e after the $window:00 UTC ship window (hypervoid/admiral#123)"
  id=$(jq -r --arg d "$description" '[.[] | select(.description == $d)][0].id // empty' <<<"$schedules")
  if [ -z "$id" ]; then
    glab schedule create --repo "$project" --description "$description" --ref "$ref" \
      --cron "$cron" --cronTimeZone UTC --active="$active" --variable "PRODUCTION_E2E:true" >/dev/null
    echo "created: $description ($cron UTC, active=$active)"
  else
    glab api --method PUT "projects/$enc/pipeline_schedules/$id" \
      -f "ref=$ref" -f "cron=$cron" -f "cron_timezone=UTC" -f "active=$active" >/dev/null
    echo "updated: schedule $id, $description ($cron UTC, active=$active)"
  fi
done
