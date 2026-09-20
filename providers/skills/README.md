# Provider skill checkouts

Optional skill packs are shallow-cloned here by `scripts/install-providers.ps1`.

## Ponytail (implementation discipline)

After checkout exists at `providers/skills/ponytail`:

```powershell
# From AI-Coding-System root
node providers\skills\ponytail\scripts\cursor-hooks.js install
```

Project-scoped hooks instead of global:

```powershell
node providers\skills\ponytail\scripts\cursor-hooks.js install --project
```

Requires `node` on PATH. Cursor reloads `hooks.json` on save; open a new chat for rules to apply.

Uninstall ponytail hook entries only:

```powershell
node providers\skills\ponytail\scripts\cursor-hooks.js uninstall
```

If a workspace `.cursor/rules/ponytail.mdc` rule is present, hooks stay quiet — remove that rule to let hooks manage the level.

Install checkout if missing:

```powershell
.\scripts\install-providers.ps1
```

Or manually:

```powershell
git clone --depth 1 https://github.com/DietrichGebert/ponytail.git providers\skills\ponytail
```
