# Dependency Maintenance

Flight Scout has no npm package dependencies. Node.js itself still needs security updates: update `.nvmrc`, the `engines.node` range in `package.json`, and the setup documentation together. CI reads `.nvmrc`. The current baseline is Node.js 24.22.2 LTS.

## Python Dependencies

`src/providers/fli/requirements.txt` declares `flights` and the minimum patched versions of the virtual environment's installation/build tools. `requirements.lock` is the generated, exact dependency set with distribution hashes, including platform markers for Windows. Keep both files committed.

`npm run setup` installs the lockfile with `pip --require-hashes`. Running setup again updates an existing `.venv` to the locked versions, including pip and setuptools. It does not remove unrelated packages already installed in that environment.

The provider is temporarily an immutable source archive at upstream commit `5c092f12e10db925f68768d97cb08cb7fdcbbacc`, with its SHA-256 in the lockfile. That commit restores the Google search-page transport and raises an error for missing search payloads. The published `flights==0.9.0` release uses a retired RPC path and silently converts its error response into empty inventory. Replace the source pin only when a published release includes the transport fix and passes the adapter regression and live checks. Advisory scans cannot fully verify an unreleased source build; review the pinned source as well.

After upgrading an existing installation, preview the selected searches with `npm run plan:refresh-plan -- plans/<plan-id>/plan.json --mode standard`, then force that refresh with `npm run plan:refresh -- plans/<plan-id>/plan.json --mode standard --live --force` so cached empty responses from the old provider are not reused.

## Update And Audit

Use Python 3.11 and keep maintenance tools separate from the application's `.venv`. The commands below use POSIX virtual-environment paths; on Windows use the corresponding `Scripts` executables.

```bash
python3.11 -m venv work/dependency-tools
work/dependency-tools/bin/python -m pip install uv==0.13.6 pip-audit==2.10.1
work/dependency-tools/bin/uv pip compile src/providers/fli/requirements.txt \
  --universal --python-version 3.11 --generate-hashes --upgrade \
  --output-file src/providers/fli/requirements.lock \
  --custom-compile-command 'uv pip compile src/providers/fli/requirements.txt --universal --python-version 3.11 --generate-hashes --output-file src/providers/fli/requirements.lock'
work/dependency-tools/bin/pip-audit --no-deps --disable-pip \
  -r src/providers/fli/requirements.lock
npm run setup
.venv/bin/python -m pip check
.venv/bin/python -m pip freeze --all > work/installed-requirements.txt
work/dependency-tools/bin/pip-audit --no-deps --disable-pip \
  -r work/installed-requirements.txt
npm test
npm run guard:bloat
npm run release:audit
```

Review the lockfile diff and resolve advisory findings before committing. A clean audit means no known advisories were found at that time; it does not guarantee that every code path is safe. The installed-environment audit also catches leftover packages that are absent from the lockfile.

Finally, run one small live flight search for a future date to verify the provider with the updated dependencies. Automated tests use fixtures and cannot establish that Google Flights still accepts live requests.
