#!/bin/sh
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 https://some.erddap.url/erddap/" >&2
  exit 1
fi

erddap=$1 npm run test
