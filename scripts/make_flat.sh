#!/usr/bin/env bash

rm -rf flat/*
ROOT=contracts/
TOKEN=Token/
TOKEN_FULL="$ROOT""$TOKEN"
FLAT=flat/

iterate_sources() {
	for FILE in "$1"*.sol; do
	    [ -f "$FILE" ] || break
	    echo $FILE
	    ./node_modules/.bin/poa-solidity-flattener $FILE $2
	done
}

iterate_sources $ROOT $FLAT

mkdir -p $FLAT$TOKEN;
iterate_sources $TOKEN_FULL $FLAT$TOKEN
