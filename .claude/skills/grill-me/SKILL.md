---
name: grill-me
description: Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. Use when user wants to stress-test a plan, get grilled on their design, or mentions "grill me".
output_size:
  XS: skip
  S: 30m
  M: 1h
  L: 2h
  XL: 4h
---

## Why you'd care

Plans that haven't been stress-tested by someone playing devil's advocate ship with the same unresolved assumptions the author started with. The grilling forces every branch of the decision tree to a defended answer before code gets written.

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead.
