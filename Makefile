# web-estate: the shared verb set. Scripts are canonical (package.json);
# this Makefile mirrors them so every repo answers to the same verbs.
# CI calls `make ci` and nothing else.

.PHONY: build test lint fmt fmt-check coverage contract ci

build:
	bun run build

test:
	bun run test

lint:
	bun run lint

fmt:
	bun run fmt

fmt-check:
	bun run fmt-check

coverage:
	bun run coverage

contract:
	bun run contract

ci:
	bun run ci
