# Local project brains

This directory holds **per-user** ACS project state (`projects/<id>/context/`,
reviews, temp). It is **not** committed to GitHub.

Each developer/machine registers their own products:

```text
register_project → creates projects/<id>/ + updates state/registry.json
list_projects    → shows only what is registered on this machine
```

Clone ACS, run the MCP server, then register workspaces you care about. Do not
copy another user's `projects/` or `state/registry.json` into the shared repo.
