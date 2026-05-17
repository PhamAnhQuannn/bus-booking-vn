---
name: firmware-attestation-design
description: Firmware integrity + attestation design — NIST SP 800-193 Platform Firmware Resiliency, TPM 2.0 measured/secure boot, SLSA L3+ build provenance, signed SBOM (CMS), sigstore/in-toto attestations, UEFI Secure Boot DBX cadence. Outputs to `docs/inception/firmware-attestation-<project>.md`. Reads `/project-classify` to skip XS/S/M. Upstream: `/counterfeit-screening-program`, `/sbom-generate`, `/supply-chain-risk-pre`. Downstream: `/zero-trust-posture`, `/audit-log-design`. Use when user says "secure boot", "measured boot", "TPM attestation", "NIST 800-193", "PFR", "SLSA", "sigstore", "in-toto", "DBX", "/firmware-attestation-design".
output_size:
  XS: skip
  S: skip
  M: skip
  L: 4h
  XL: 8h
---

# /firmware-attestation-design — Secure/Measured Boot, TPM 2.0, SLSA L3+ Provenance

## Why you'd care

Unsigned firmware is the supply-chain attack surface auditors will hammer in any defense / regulated procurement. Without measured-boot + signed-SBOM provenance, you fail the technical evaluation before the contract conversation even starts.

> **Why you'd care:** Modern targeted attacks (LoJax, MoonBounce, BlackLotus, CosmicStrand, MosaicAggressor) compromise firmware **below** the OS where EDR cannot see them. NIST SP 800-193 makes firmware resiliency (Protect / Detect / Recover) the floor expectation for any device handling sensitive data, federal systems (post-EO 14028), or critical-infrastructure. Skip attestation and a compromised firmware persists across OS reinstall, disk wipe, and even motherboard replacement (via NIC option ROM).

> **Effort caveat:** `XL: 8h` covers *design only* (boot-chain spec, key-hierarchy plan, attestation server topology, SBOM-signing pipeline, DBX cadence policy). Actual implementation: **6–18 months** for greenfield embedded product (silicon vendor coordination, key-ceremony, HSM integration, OTA infrastructure, vendor-firmware update pipeline); **3–9 months** for x86 server fleet retrofit. Field operations: HSM ($30k–$200k), code-signing service ($50k–$300k/yr), attestation-server infra ($20k–$100k/mo at fleet scale). Multiply pre-scoping hours by ~50–150× for build-out.

Invoke as `/firmware-attestation-design`. L+ only — embedded systems / IoT-at-scale / critical-infrastructure / regulated devices.

## Pre-flight
1. Read `docs/classify/<project>.md`.
   - XS/S/M → SKIP (consumer-app TPM/SecureBoot use is OS-vendor-provided, not designed)
2. Read `docs/inception/sbom-<project>.md` if SBOM scoped.
3. Read `docs/inception/cgd-<project>.md` if safety-critical overlap.
4. Read `docs/inception/counterfeit-<project>.md` if hardware-supply-chain overlap.

## Inputs
- Platform class (x86 server / ARM SoC / RISC-V MCU / FPGA / GPU).
- Silicon vendor (Intel, AMD, NXP, ST, Microchip, Nordic, Espressif, NVIDIA, Xilinx).
- Threat model (nation-state physical / nation-state remote / opportunistic / insider).
- Regulatory driver (EO 14028 / NIST 800-193 / DISA STIG / IEC 62443 / DO-326A / FDA Pre-Market Cyber).
- Fleet size + OTA cadence.
- Existing root-of-trust position (silicon HRoT, TPM 2.0, OTP fuses, custom).

## Process

1. **Authoritative source stack**:
   - **NIST SP 800-193** (May 2018) — Platform Firmware Resiliency Guidelines (PFR): **Protect / Detect / Recover** triad.
   - **NIST SP 800-147B** — BIOS Protection Guidelines for Servers.
   - **NIST SP 800-155** — BIOS Integrity Measurement Guidelines.
   - **NIST SP 800-160 Vol 1 + Vol 2** — Systems Security Engineering / Cyber Resiliency.
   - **NIST SP 800-218** — Secure Software Development Framework (SSDF) v1.1 (post-EO 14028).
   - **EO 14028 + OMB M-22-18 + M-23-16** — federal SSDF/SBOM/attestation mandate (GSA SAFE form).
   - **TCG TPM 2.0 Library Spec** (Part 1 Architecture / Part 2 Structures / Part 3 Commands).
   - **TCG PC Client Platform Firmware Profile** — TPM-event-log + PCR usage on x86.
   - **TCG DICE Layered Architecture** — Device Identifier Composition Engine for resource-constrained.
   - **UEFI Specification §32 (Secure Boot)** — db / dbx / KEK / PK hierarchy.
   - **SLSA v1.0** (slsa.dev) — Supply-chain Levels for Software Artifacts (Levels 1–4 across Build, Source, Dependencies).
   - **in-toto Attestation Framework** + **in-toto Layout Spec**.
   - **Sigstore** — cosign / Rekor (transparency log) / Fulcio (CA) — keyless signing.
   - **CycloneDX 1.6** / **SPDX 3.0** — SBOM formats; signing per **JSF (JSON Signature Format)** or **CMS (RFC 5652)**.
   - **FIPS 140-3** — crypto module validation (replaces 140-2 in 2026 federal use).
   - **CNSA 2.0** (Sep 2022) — post-quantum federal crypto suite (ML-KEM/ML-DSA timeline).

2. **Establish the Root of Trust (RoT)** — pick + document:
   - **Silicon HRoT (preferred)**:
     - Intel Boot Guard + CSME + PTT (firmware TPM) or discrete TPM 2.0.
     - AMD Platform Secure Boot (PSB) + ASP / fTPM.
     - ARM TrustZone + CryptoCell or PSA-Certified Level 2/3.
     - NXP HABv4 / AHAB / EdgeLock.
     - ST STM32Trust.
     - Nordic Cellular IoT with KMU + IAK.
     - Espressif ESP32 Secure Boot v2 + Flash Encryption.
   - **Immutable boot code** — burned to mask ROM or one-time-programmable (OTP) fuses; cannot be modified post-fab.
   - **Public-key hash** stored in fuses, full key in flash, verified by ROM at boot.
   - **Anti-rollback counter** (OTP-based) prevents downgrade to vulnerable firmware versions.

3. **Boot-chain design** — Secure Boot vs Measured Boot (use both):
   - **Secure Boot (enforcement)**:
     - Each stage verifies signature of next stage before transferring control.
     - Halt or recovery on failure (per NIST 800-193 "Protect" + "Recover").
     - Chain: ROM → BL1 → BL2 → BL31 (ATF) → BL33 (UEFI / U-Boot) → OS loader → kernel → initramfs → rootfs → app.
   - **Measured Boot (forensics + remote attestation)**:
     - Each stage hashes the next + extends a TPM PCR before launching.
     - PCR-extend operation: PCR[n] = SHA-256(PCR[n] || measurement).
     - **PCR allocation** (TCG PC Client profile):
       - PCR 0 — UEFI firmware code
       - PCR 1 — UEFI firmware config (BIOS settings)
       - PCR 2 — UEFI option ROM code (NIC, GPU, RAID)
       - PCR 3 — UEFI option ROM config
       - PCR 4 — UEFI boot manager code + MBR/GPT
       - PCR 5 — boot loader config
       - PCR 6 — host-platform events (transitions, S-states)
       - PCR 7 — Secure Boot policy (db / dbx / KEK / PK changes)
       - PCR 8–15 — OS use (Linux IMA, Windows BitLocker)
       - PCR 17–22 — Dynamic Root of Trust (DRTM via Intel TXT / AMD SKINIT)
     - PCR-event-log archived to /sys/kernel/security/tpm0/binary_bios_measurements (Linux) or Win Event Log.

4. **UEFI Secure Boot key hierarchy** (x86):
   - **PK (Platform Key)** — owner of the platform (OEM or enterprise). 1 key. Stored in NVRAM, signed update only.
   - **KEK (Key Exchange Key)** — usually OEM + Microsoft (UEFI Forum CA). Authorizes db/dbx updates.
   - **db (Allow DB)** — signers + hashes of allowed boot binaries.
   - **dbx (Forbidden DB)** — revoked signers/hashes (BlackLotus added bootmgr SHA-256s in 2023 Microsoft updates).
   - **MOK (Machine Owner Key)** — Linux shim's parallel chain for owner-controlled keys.
   - **Custom key ownership recommendation for enterprise / federal**: clear factory keys; install enterprise PK + KEK; manage db/dbx via configuration management (MDT / Intune / Salt / Ansible).
   - **DBX update cadence**: monthly minimum (Microsoft publishes via Windows Update + UEFI Forum); track Linux fwupd / LVFS for revocations.

5. **TPM 2.0 attestation design** — remote attestation flow:
   - **Endorsement Key (EK)** — burned by TPM vendor; uniquely identifies the TPM (and indirectly the device).
   - **EK certificate** — vendor-signed; verifiable via vendor root CA.
   - **Attestation Identity Key (AIK) / Attestation Key (AK)** — derived; used for signing quotes (privacy-preserving alias for EK).
   - **Quote operation**: TPM signs (PCR_selection || PCR_digest || nonce) with AK; verifier checks signature, replays event-log to recompute PCR digest, decides trust.
   - **Attestation server topology**:
     - **Verifier**: server that validates quotes against expected PCR values (golden values per build).
     - **Privacy CA / DAA**: issues AIK certificates (TCG IWG protocol or modern DAA — Direct Anonymous Attestation).
     - **Policy engine**: ties attestation result to network admission (NAC / Zero Trust gate) + sealed-secret release.
   - **Implementations / stacks**:
     - **Keylime** (CNCF) — open-source TPM attestation framework; popular for HPC/cloud.
     - **Intel TSC + AMT** for client.
     - **Microsoft Azure Attestation Service / Intune Device Health**.
     - **AWS Nitro Attestation** (for Nitro Enclaves, not generic).
     - **Confidential Computing Consortium attestation projects** — Veraison, Trustee.
   - **DICE (resource-constrained alternative)** — layered key derivation; each layer derives identity from its measurement + previous Compound Device Identifier. Used in ARM TrustZone-M, RIOT-MP, microcontrollers.

6. **NIST SP 800-193 PFR triad — implement all three**:
   - **Protect**: integrity of firmware code + critical data (boot-block immutable, signed updates, anti-rollback).
   - **Detect**: corruption detection during boot (hash-verify) and at runtime (periodic re-measurement, integrity manifests).
   - **Recover**: auto-restore from a "gold" image / backup region on detected corruption.
     - **A/B partitions** for OTA dual-bank rollback.
     - **Recovery firmware** in write-protected region (e.g., Intel Boot Guard ACM).
     - **Out-of-band manageability** for remote re-image (BMC/IPMI/Redfish if compromised host).

7. **Signed SBOM + build provenance — SLSA Levels**:
   - **SLSA L1** — build process documented; provenance generated.
   - **SLSA L2** — version-controlled source; hosted build service; signed provenance.
   - **SLSA L3** — source + build platforms hardened; **non-falsifiable** provenance; isolated builds (no shared state).
   - **SLSA L4** — two-party review; hermetic + reproducible builds. (Deprecated as a level in v1.0 but ethos preserved.)
   - **SBOM**:
     - Generate per build — CycloneDX 1.6 or SPDX 3.0.
     - Include: components + versions + hashes + licenses + supplier + relationship (vex + dependency tree).
     - Sign: detached CMS (RFC 5652) signature, or JSF, or in-toto attestation envelope.
     - Submit to: customer (per contract) + internal artifact registry + (if federal) GSA SAFE form per OMB M-22-18.
   - **in-toto layout** — declarative supply-chain policy; each step (clone, build, test, sign) produces a link metadata file; final verifier replays + checks.
   - **Sigstore**:
     - **cosign** — sign container/blob with ephemeral keys + OIDC identity binding.
     - **Fulcio** — short-lived (10 min) certificate CA.
     - **Rekor** — append-only transparency log (analogous to CT logs).
     - Keyless flow eliminates long-term key custody — appropriate for L2/L3 build infra.

8. **Code-signing key management**:
   - **HSM-backed keys** (FIPS 140-3 Level 2 minimum; Level 3 for federal) — Thales Luna, AWS CloudHSM, Azure Dedicated HSM, YubiHSM 2 (low end).
   - **Key ceremony** — multi-party (m-of-n) with auditor + ceremony script + video + signed transcript.
   - **Separate keys per environment** (dev / staging / prod / customer-specific signing).
   - **Rotation cadence** — annual prod root recommended; intermediate every 90 days; signing certs every 30 days for sigstore-like ephemeral.
   - **Revocation paths** — CRL + OCSP for x.509; Rekor + transparency for cosign; dbx for UEFI.
   - **Post-quantum readiness (CNSA 2.0)** — plan dual-signing (RSA-3072 + ML-DSA) transition window FY2025–FY2030 per NSA timeline.

9. **DBX / revocation cadence policy**:
   - **Track** UEFI Forum dbx releases + Microsoft KB monthly.
   - **Track** LVFS / fwupd for Linux-side advisories.
   - **Apply within SLA**:
     - Critical (active in-the-wild exploit, e.g., BlackLotus): 7 days.
     - High: 30 days.
     - Medium: 60 days.
     - Low: next quarterly cycle.
   - **Distribute** via MDT, Intune, Salt, Ansible, fwupd, BMC fleet manager.
   - **Validate** post-deployment via remote attestation PCR 7 delta.

10. **Threat model — adversary classes + countermeasures**:
    - **Remote network attacker**: signed updates + rollback protection + measured-boot attestation.
    - **Malicious insider (operator)**: HSM dual-control + audit log + separation-of-duties + signed configs.
    - **Supply-chain attacker (build infra)**: SLSA L3+ isolated builds + transparency log + reproducible builds.
    - **Supply-chain attacker (third-party dep)**: SBOM + dep-policy gate + sigstore verify-blob + VEX consumption.
    - **Physical attacker (device theft / lab access)**: anti-tamper + side-channel-resistant key store + secure-erase on tamper.
    - **Nation-state physical (e.g., evil-maid)**: DRTM (Intel TXT / AMD SKINIT) + hardware-fused PK + early-PCR seal of OS keys + bind to platform.
    - **Post-quantum future**: plan dual-sig (CNSA 2.0).

11. **Regulatory mapping**:
    - **Federal civilian (post-EO 14028)**: NIST 800-218 SSDF + NIST 800-193 PFR + signed SBOM (M-22-18 / M-23-16) + GSA SAFE form attestations.
    - **DoD**: DFARS 252.204-7012 + CMMC 2.0 + DISA STIG / SRG.
    - **FDA medical-device (Pre-Market Cyber 2023)**: SBOM mandatory; software bill + signed updates + vuln-management.
    - **Aviation (DO-326A / DO-356A)**: cybersecurity airworthiness; signed software loads (DO-200B + DO-178C).
    - **Auto (UNECE R155 + ISO/SAE 21434)**: type-approval CSMS + signed OTA.
    - **Industrial (IEC 62443-4-1/-4-2)**: secure-development lifecycle + level-tiered controls.
    - **EU CRA (Cyber Resilience Act, 2027 effective)**: secure-by-default + signed updates + 24-mo support floor + 24-hour vuln-report.

12. **Cost + headcount**:
    - **Firmware-security engineer (1–3 FTE)**: $200k–$600k loaded.
    - **HSM** (FIPS 140-3 L2): $30k–$100k capex; $5k–$20k/yr maintenance.
    - **HSM** (FIPS 140-3 L3 / Network): $50k–$200k.
    - **Code-signing service (CI integration, key ceremony, audit)**: $50k–$300k/yr.
    - **Attestation server infra** (Keylime / Azure Attestation / custom): $20k–$100k/mo at fleet scale.
    - **SBOM tooling + signing pipeline**: $30k–$150k Y1 + $20k–$80k/yr.
    - **Penetration test (firmware-focused, e.g., Eclypsium, NCC Group, IOActive)**: $80k–$250k per engagement.
    - **Initial build-out Y1**: $1M–$3M; Y2+ run-rate: $500k–$1.5M.

13. **Failure modes + design red flags**:
    - PK left as factory (Microsoft default) on federal-deployed system — adversary can sign payload via Microsoft KEK chain.
    - PCR-event-log archived but never validated against golden values.
    - SBOM generated but never signed / consumed.
    - Code-signing key on a developer laptop (no HSM, no ceremony).
    - Rollback counter not enforced — downgrade attack lands an old vulnerable build.
    - DRTM (TXT/SKINIT) available but not used.
    - DBX update cadence beyond 60 days — known revocations bypassed.
    - Post-quantum migration not scheduled (CNSA 2.0 deadlines approaching).

## Output

Write `docs/inception/firmware-attestation-<project>.md`:

```markdown
# Firmware Integrity + Attestation Design — <project>
**Date:** <YYYY-MM-DD>
**Platform class:** ARM Cortex-A (Yocto Linux) + Cortex-M (Zephyr) coprocessor
**Fleet size at GA:** 50,000 units → 500,000 in 36 mo
**Regulatory driver:** FDA Pre-Market Cyber + IEC 62443-4-1/4-2 + EU CRA (effective 2027)
**Threat model class:** Remote network + supply-chain + opportunistic-physical (lab access)

## 1. Authoritative source stack
| Standard | Cite | Applies to |
|---|---|---|
| NIST SP 800-193 | NIST 2018 | PFR triad |
| NIST SP 800-218 SSDF | NIST 2022 | SDLC framework |
| TCG TPM 2.0 Library | TCG | TPM API + PCRs |
| TCG DICE Layered | TCG | Constrained device id |
| UEFI Spec §32 | UEFI Forum | Secure Boot (x86 sister boards) |
| SLSA v1.0 | OpenSSF | Build provenance |
| in-toto Spec | in-toto | Layout + link metadata |
| Sigstore | OpenSSF | Keyless signing + Rekor |
| FIPS 140-3 | NIST 2019 | Crypto module |
| CNSA 2.0 | NSA 2022 | Post-quantum federal timeline |
| FDA Pre-Market Cyber 2023 | FDA | Medical device cybersecurity |
| EU CRA | EU 2024 | Effective 2027 |

## 2. Root-of-Trust selection
- **Cortex-A SoC**: NXP i.MX 8M Plus + HABv4 immutable ROM + signed BL1/BL2 + OP-TEE + Cortex-M as secure element
- **Cortex-M coprocessor**: Nordic nRF9160 KMU + Identity & Attestation Key (IAK) per PSA-Certified Level 2
- **Discrete TPM 2.0**: Infineon SLB9670 over SPI for measured-boot PCRs
- **Anti-rollback**: OTP fuse counter (max 32 firmware revisions per device life)

## 3. Boot chain (Secure + Measured)
| Stage | Verifier | Signed by | PCR extended |
|---|---|---|---|
| Mask ROM | (immutable) | n/a | n/a |
| BL1 (HABv4) | ROM | OEM PK in fuses | PCR 0 |
| BL2 (ATF BL2) | BL1 | OEM BL2 key | PCR 0 |
| BL31 (ATF BL31 / EL3) | BL2 | OEM ATF key | PCR 0 |
| BL33 (U-Boot) | BL31 | OEM boot key | PCR 0 |
| U-Boot env / config | U-Boot | env signing key | PCR 1 |
| Kernel + DTB | U-Boot FIT verify | kernel signing key | PCR 4 |
| initramfs | kernel IMA | initramfs key | PCR 8 |
| rootfs | dm-verity | rootfs hash tree | PCR 9 |
| app container | container runtime + cosign | app team key (Fulcio) | PCR 10 |

## 4. Key hierarchy
| Key | Storage | Backed by | Rotation |
|---|---|---|---|
| OEM PK (root) | i.MX OTP fuses | n/a (one-shot fuse) | never |
| BL2/BL31/BL33 signing | HSM (Thales Luna L3) | offline backup HSM | 24 mo |
| Kernel + DTB | HSM | same | 12 mo |
| initramfs + rootfs | HSM | same | 12 mo |
| App container (cosign) | Sigstore Fulcio (ephemeral) | Rekor TL | 10 min cert |
| Attestation AK (per device) | TPM 2.0 internal | EK cert | device life |

## 5. SLSA target + build provenance
- **Target**: SLSA L3 across all firmware artifacts by Y2 Q2
- **Source**: GitHub.com + signed commits (gitsign / Sigstore) + branch protection + 2-party review
- **Build**: GitHub-hosted runners isolated, ephemeral, with OIDC-bound Fulcio signing
- **Provenance**: SLSA v1.0 attestation generated per build, in-toto envelope, stored in Rekor + internal Sigstum log
- **Hermetic builds**: target Y3 (Bazel migration + dep-pinning + offline-mirror)

## 6. SBOM signing pipeline
- **Format**: CycloneDX 1.6 (preferred) + SPDX 3.0 (for federal/FDA submission)
- **Generation**: Syft + custom firmware-component plugin (component + version + hash + license + supplier + VEX)
- **Signing**: detached CMS (RFC 5652) for x.509 chain + JSF inline for keyless cosign envelope
- **Distribution**:
  - Customer: signed CycloneDX + JSON sig attached to each release
  - Federal (FDA / GSA): SPDX + GSA SAFE form attestation per OMB M-23-16
  - Internal artifact registry: stored with build attestation + Rekor entry

## 7. TPM 2.0 attestation flow
- **EK**: Infineon SLB9670 vendor-burned; EK cert verified vs Infineon root CA at provisioning
- **AK**: TPM2_CreatePrimary + ActivateCredential flow; AK cert issued by internal Privacy CA (m-TLS to attestation server)
- **Quote SLA**: every 24 h + on-demand (NAC trigger); nonce-based
- **Verifier**: Keylime cluster (3 nodes HA) per region (US / EU / APAC)
- **Golden PCR values**: maintained per firmware build in CI; auto-published to attestation server
- **Failure action**: device dropped from production network; quarantine VLAN; remote recovery triggered

## 8. NIST SP 800-193 PFR mapping
| Triad element | Mechanism | Validation |
|---|---|---|
| Protect | OTP fuses + signed updates + anti-rollback | quarterly pen-test |
| Detect | TPM PCR re-measurement + dm-verity + IMA + periodic attestation | continuous |
| Recover | A/B partitions + recovery-firmware in write-protected region + remote BMC re-image | quarterly DR drill |

## 9. DBX / revocation cadence
- UEFI dbx tracking (sister x86 boards): monthly via Microsoft Catalog + UEFI Forum CSV
- LVFS / fwupd subscription for Linux-side advisories
- SLA: critical 7d / high 30d / medium 60d / low quarterly
- Post-deploy validation via attestation PCR 7 delta

## 10. Post-quantum readiness (CNSA 2.0)
- Inventory current signing: RSA-3072 (firmware), ECDSA-P384 (PK fuses)
- ML-DSA-65 prototype on dev branch by 2026 Q3
- Dual-signature production rollout target: 2027 Q1 (per CNSA 2.0 firmware deadline)
- ML-KEM-768 for TLS to attestation server: 2026 Q4

## 11. Cost roll-up Y1 / Y2 / Y3
| Item | Y1 | Y2 | Y3 |
|---|--:|--:|--:|
| Firmware-security FTE (loaded) | $450k (2 FTE) | $675k (3) | $900k (4) |
| HSM (Thales L3 + backup) | $180k capex | $20k maint | $20k |
| Code-signing service (CI + ceremony) | $120k | $90k | $90k |
| Attestation server infra (Keylime HA) | $300k | $600k (scale) | $1.1M |
| SBOM tooling + Sigstore infra | $80k | $40k | $40k |
| Firmware pen-test (Eclypsium-tier) | $180k | $200k | $220k |
| **Annual** | **$1.31M** | **$1.62M** | **$2.37M** |

## 12. Key ceremony schedule
- Initial ceremony (OEM PK fuse cert + L3 HSM init): Y1 Q1 — 3-party + auditor + video
- Annual key audit: Q1 each year
- Intermediate refresh: 90-day rolling (automated via HSM)
- Sigstore Fulcio: continuous (10-min ephemeral)

## 13. Threat model coverage matrix
| Adversary | Countermeasure(s) | Residual risk |
|---|---|---|
| Remote network | Secure Boot + signed update + rollback ctr | low |
| Supply-chain build | SLSA L3 + Rekor + reproducible (Y3) | medium → low |
| Supply-chain dep | SBOM + cosign verify-blob + dep-policy gate | medium |
| Insider operator | HSM dual-ctrl + audit + SoD | low |
| Physical lab access | anti-tamper + key-store side-channel-resistant + secure-erase | medium |
| Nation-state physical | + DRTM equivalent on Cortex-A (OP-TEE measured) | medium-high |
| Post-quantum future | dual-sig roadmap (2026–2027) | mitigated by 2027 |

## 14. Failure-mode + red-flag audit
- [ ] PK fuses burned with OEM-only chain (no MS factory residue)
- [ ] PCR golden values published + attestation enforced (not advisory)
- [ ] SBOM signed + customers consume (not just generated)
- [ ] All signing in HSM (no laptop keys)
- [ ] Rollback counter enforced + monitored
- [ ] DRTM-equivalent used where available
- [ ] DBX SLA met past 12 mo
- [ ] PQ migration scheduled

## 15. 90-day design-execution plan
1. RoT + boot-chain spec frozen + reviewed (week 1–4)
2. PK + key-hierarchy ceremony script drafted (week 2–6)
3. HSM procurement + L3 model selected (week 4–8)
4. SBOM generation + Syft + signing pipeline POC (week 4–10)
5. Sigstore + GitHub OIDC build attestation POC (week 6–10)
6. Keylime POC against dev fleet (week 8–12)
7. Pen-test scope + vendor RFP (Eclypsium / NCC / IOActive) (week 10–12)
```

## Verification
- [ ] Root of Trust source documented (silicon HRoT vs discrete) with anti-rollback path.
- [ ] Boot chain enumerated stage-by-stage with both Secure Boot (verify) and Measured Boot (PCR-extend).
- [ ] UEFI key hierarchy planned with custom PK ownership (not factory default) where applicable.
- [ ] TPM 2.0 attestation flow defined: EK → AK → quote → verifier → policy action.
- [ ] SLSA target level (L2/L3) declared + build-provenance + SBOM signing pipeline specified.
- [ ] DBX / revocation cadence + post-quantum (CNSA 2.0) timeline included.
- [ ] PFR triad (Protect / Detect / Recover) per NIST SP 800-193 explicitly addressed.
