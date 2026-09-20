### Task 0: Initialize git (if missing)

**Files:**
- Create: `.git/` via `git init`
- Modify: none (`.gitignore` already exists)

- [ ] **Step 1: Check for `.git`**

Run (PowerShell):
```powershell
Test-Path C:\AI-Coding-System\.git
```
Expected: `False` (currently) or `True` if already initialized.

- [ ] **Step 2: Init if missing**

```powershell
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System init
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System add -A
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System status
```

- [ ] **Step 3: Initial commit of current baseline (only if no commits yet)**

```powershell
& "C:\Program Files\Git\bin\git.exe" -C C:\AI-Coding-System commit -m "chore: baseline AI Coding System before provider facade"
```

Do not force if user already has commits. Skip if `git log` already has history.

---

