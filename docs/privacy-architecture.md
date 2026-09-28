# SOPET Momentum Privacy Architecture

## Data classification

- `OPERATIONAL_METADATA`: record and owner IDs, parent relationships, privacy mode, content encoding, status enums, category IDs, intervention registry IDs, booleans, numeric KPI values, target/completion dates, timestamps, counts, and migration state.
- `IDENTITY_METADATA`: email, display name, locale, timezone, account state, and role assignments.
- `SECURITY_METADATA`: password hashes, session hashes, security events, wrapped-key parameters, key versions, and recovery-configured state.
- `PRIVATE_DEVELOPMENTAL_CONTENT`: Goal title/description/why; Milestone title/description; Action and NMA wording; Readiness comments; Barrier explanation; user intervention notes; MMA wording; interruption/restart free text; KPI names, units, and notes; Weekly Review answers and draft; Lesson and Adjustment text.

Protected Goal children inherit their Goal privacy mode. Structured operational fields remain queryable. A child write for a protected Goal is rejected unless its private content uses `CLIENT_ENCRYPTED` storage.

## Cryptographic design

The browser creates a random 256-bit User Data Encryption Key (UDEK). Private JSON is encrypted with AES-256-GCM using a fresh random 96-bit IV and a 128-bit authentication tag. The versioned envelope records algorithm, key version, IV, ciphertext, AAD version, and content schema version.

AAD is canonical UTF-8 text: `sopet:<userId>:<entityType>:<entityId>:v<schemaVersion>`. IDs are stable and the web client must generate the record UUID before encryption.

A separate Privacy Vault Passphrase derives an AES-256-KW key with PBKDF2-HMAC-SHA-256, a random 128-bit salt, and 600,000 iterations. It wraps the UDEK. A random 256-bit Recovery Key independently wraps the same UDEK with its own salt. Changing either secret only rewraps the UDEK.

The unlocked UDEK is an extractable `CryptoKey` held only in application memory because Web Crypto requires extractability to rewrap the same key during passphrase and Recovery Key changes. It is never exported by application code except through AES-KW wrapping and is not written to localStorage, sessionStorage, IndexedDB, cookies, logs, or the backend. Lock and logout discard the reference; JavaScript cannot promise perfect memory zeroization.

The server stores wrapped UDEKs, salts, KDF/wrapping parameters, key versions, ciphertext, and operational metadata. It stores neither passphrases, recovery keys, raw UDEKs, nor decrypted protected content. Ordinary administrators receive operational aggregates and have no decryption endpoint or bypass key.

## Recovery and loss

The Recovery Key is displayed once. Recovery unwraps the UDEK locally and wraps it with a new passphrase-derived key. Rotation replaces the recovery-wrapped UDEK so the old key stops working. If both passphrase and Recovery Key are lost, encrypted content cannot be recovered by SOPET staff.

## AI policy

The backend resolves privacy from the owned Goal. Protected Goals require explicit per-interaction consent, purpose, and a non-empty list of shared field names. The browser sends only the selected decrypted fields. AI metadata stores identifiers, field names, provider/model, timing, token counts, and consent; prompt and response content are not persisted or logged. `HIGHLY_CONFIDENTIAL` is therefore off until each interaction is approved.

## Threat model and limitations

Browser encryption protects server-stored content from routine administrators, support and analytics staff, direct database inspection, backups, leaks, and accidental API disclosure. PostgreSQL backups contain ciphertext for protected records and backup operators should not possess UDEKs.

It does not protect an unlocked vault from a compromised device or browser, malicious extensions, malware/keyloggers, XSS, or maliciously modified frontend JavaScript. Because SOPET serves the web client, stronger operator resistance also needs restricted deployments, mandatory review, protected CI/CD, strict CSP, auditable releases, independent review, and potentially a native/auditable client. Those controls belong to later security work.

Historical backups made before a browser migration may still contain plaintext and require separate retention handling. Server-side full-text search and title sorting are unavailable for encrypted content; those operations must occur locally after unlock. Server-side plaintext export is prohibited; browser-decrypted export is not yet implemented.
