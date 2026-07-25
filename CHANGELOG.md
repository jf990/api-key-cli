# Change log

This file tracks changes made by each version release.

## v1.1.1 25-July-2026

- Update/improve all exit codes ([#6](https://github.com/jf990/api-key-cli/issues/6)).
- Add `-a privchk` command to match privileges expected on an API key and on the subscription ([#5](https://github.com/jf990/api-key-cli/issues/5)).
- Add `-a refchk` command to match an expected referrer on an API key and it passes server validation ([#4](https://github.com/jf990/api-key-cli/issues/4)).
- update certain commands (privchk, inspect) to accept a referrer argument -r to have the request include the referer header ([#8](https://github.com/jf990/api-key-cli/issues/8)).

## v1.0.2 10-June-2026

- Adds new action `-a expired` that will generate a list of your api keys sorted in order of expiration, and show the keys are expired or how many days until expiration.

## v1.0.0 29-May-2026

- Initial release.
