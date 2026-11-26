#!/bin/sh
# Demo reset loop (PID 1 of the `reset` container, run under tini via `init: true`).
#
#   SEED_ON_START=if-empty|always|never   what to do when the container starts
#   RESET_HOUR_UTC=3                       daily wipe + re-seed time (UTC hour)
#
# Between resets only this shell's `sleep` is in memory (~1 MB); Node starts
# just for the seed and exits afterwards.
set -u
HOUR="${RESET_HOUR_UTC:-3}"
log() { echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [reset] $*"; }

case "${SEED_ON_START:-if-empty}" in
  always)   node scheduler.js || log "Initial seed failed" ;;
  if-empty) node scheduler.js --if-empty || log "Initial seed failed" ;;
  *)        log "Skipping initial seed (SEED_ON_START=${SEED_ON_START:-})" ;;
esac

while true; do
  now=$(date -u +%s)
  next=$(( now - now % 86400 + HOUR * 3600 ))
  [ "$next" -le "$now" ] && next=$(( next + 86400 ))
  log "Next reset in $(( (next - now) / 60 )) min (${HOUR}:00 UTC)"
  sleep $(( next - now ))
  node scheduler.js || log "Reset failed"
done
