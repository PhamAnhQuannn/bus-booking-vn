---
name: better-sqlite3-rebuild
description: Use when seeing errors about better-sqlite3 native module, NODE_MODULE_VERSION mismatch, "was compiled against a different Node.js version", or similar native binding errors.
output_size:
  XS: 10m
  S: 10m
  M: 15m
  L: 15m
  XL: 15m
---

# better-sqlite3 Rebuild

## Why you'd care

A NODE_MODULE_VERSION mismatch crashes the dev server before any of your code runs, and the error message names a number nobody can decode at a glance. This is the two-line recipe so you don't lose half an hour to Stack Overflow each time you bump Node.

When you encounter errors related to `better-sqlite3` and Node.js version mismatches (e.g. `NODE_MODULE_VERSION` mismatch, "was compiled against a different Node.js version", native module load failures), proactively fix by running:

```sh
npm rebuild
```

Do this without asking the user first - just rebuild and retry.
