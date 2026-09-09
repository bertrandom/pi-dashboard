#!/usr/bin/env bash
# Wait until internet connectivity is confirmed.
#
# Fast path: checks every 2s for up to WAIT_FOR_NETWORK_TIMEOUT seconds
#            (handles normal boot where internet is usually quick).
# Slow path: if fast path expires, retries every WAIT_FOR_INTERNET_RETRY
#            seconds forever — covers post-outage scenarios where the
#            router itself takes several minutes to reconnect.
set -e

LOCAL_TIMEOUT="${WAIT_FOR_NETWORK_TIMEOUT:-90}"
RETRY_S="${WAIT_FOR_INTERNET_RETRY:-300}"

_has_internet() {
    ping -c1 -W3 8.8.8.8 >/dev/null 2>&1 \
        || ping -c1 -W3 1.1.1.1 >/dev/null 2>&1
}

# Fast path
END=$((SECONDS + LOCAL_TIMEOUT))
while [ "$SECONDS" -lt "$END" ]; do
    if _has_internet; then
        exit 0
    fi
    sleep 2
done

# Slow path: retry every 5 minutes until internet is reachable
while true; do
    echo "No internet connectivity; retrying in ${RETRY_S}s..." >&2
    sleep "$RETRY_S"
    if _has_internet; then
        exit 0
    fi
done
