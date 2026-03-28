#!/bin/sh
set -eu

if [ -z "${RTC_CANDIDATE:-}" ]; then
  echo "RTC_CANDIDATE is required" >&2
  exit 1
fi

if [ -z "${HOOKS_URL:-}" ]; then
  echo "HOOKS_URL is required" >&2
  exit 1
fi

sed \
  -e "s|{{RTC_CANDIDATE}}|${RTC_CANDIDATE}|g" \
  -e "s|{{HOOKS_URL}}|${HOOKS_URL}|g" \
  /conf/srs.conf.template > /usr/local/srs/conf/srs.conf

exec ./objs/srs -c /usr/local/srs/conf/srs.conf
