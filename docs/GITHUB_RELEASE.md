# GitHub Release Prep

Use this checklist before the first public push.

## What Should Be Public

- Source code in `src/`, `scripts/`, `skills/`, `docs/`, `examples/`, and `test/`.
- Sanitized test fixtures.
- Screenshots in `docs/assets/` that do not show personal trip data.
- Setup docs that explain the local FLI workflow.

## What Should Stay Local

The following folders are ignored and should not be committed:

- `.venv/`
- `.env`
- `cache/`
- `outputs/`
- `plans/`
- `trips/`
- `work/`

These folders contain local setup, generated dashboards, cached provider data, saved personal plans, and working notes.

## Pre-Push Check

Run:

```bash
npm test
npm run guard:bloat
npm run release:audit
```

The release audit checks the public tree for private local paths, obvious API-style tokens, unsanitized booking-token fixtures, and required ignore rules.

## First Push

If this folder is not already a Git repository:

```bash
git init -b main
git add .
git status
git commit -m "Initial public release"
```

Create an empty GitHub repository. Because this project already has a README and `.gitignore`, do not initialize the GitHub repository with generated defaults.

Then add the remote and push:

```bash
git remote add origin <remote-url>
git push -u origin main
```

GitHub CLI is also fine:

```bash
gh repo create --source=. --public --push
```

Pick `--private` instead of `--public` if you want a private tester repo first.

## Release Notes

For a first tester release, summarize:

- What the app does.
- How to run setup.
- How to install the Codex skill.
- Example prompts.
- Known limits: this is flight research, not booking.
- Privacy note: generated personal plans stay local and ignored.

## License

Add a `LICENSE` file before publishing if other people should be allowed to copy, modify, or redistribute the project. MIT is a common default for small developer tools, but choose the license you actually want.
