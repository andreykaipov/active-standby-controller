#!/bin/sh
trap 'jobs -p | xargs kill -TERM' INT TERM HUP
node dist/main.js &
wait
