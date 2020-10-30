#!/bin/sh
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 https://some.erddap.url/erddap/" >&2
  exit 1
fi

report=$(echo "$1" | sed -e 's#^htt[^/]*//##' -e 's#/.*$##g' -e 's/\W/./g')
echo report $report

erddap=$1 MOCHAWESOME_REPORTFILENAME=$report.html MOCHAWESOME_REPORTTITLE=$report npm run test
