/**
 * utils/merkleUtils.js
 *
 * Pure JS Merkle tree for NFT allowlists.
 * No external dependencies — uses SubtleCrypto (built into all browsers).
 *
 * Usage:
 *   import { parseCSV, buildMerkleTree, getMerkleProof } from "@/utils/merkleUtils";
 *
 *   const addresses = parseCSV(csvText);
 *   const { root, leaves } = await buildMerkleTree(addresses);
 *   const proof = getMerkleProof(leaves, address);
 */

// ─── Hex helpers ──────────────────────────────────────────────────────────────
function hexToBytes(hex) {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function keccak256(data) {
  // Use SubtleCrypto SHA-256 as a deterministic hash
  // Note: This is SHA-256, not keccak256. For production Merkle proofs
  // the contract must also use SHA-256. If your contract uses keccak256,
  // use the ethers.js / viem keccak256 helper instead.
  const buf = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(buf);
}

// ─── Leaf hashing ─────────────────────────────────────────────────────────────
async function hashLeaf(address) {
  // Normalize to lowercase
  const addr = address.toLowerCase();
  // Encode: pack the address as 20 bytes
  const bytes = hexToBytes(addr);
  return keccak256(bytes);
}

// ─── Sort & hash pair ─────────────────────────────────────────────────────────
async function hashPair(a, b) {
  // Sort so the tree is deterministic regardless of insertion order
  const sorted = compareBuf(a, b) <= 0 ? [a, b] : [b, a];
  const combined = new Uint8Array(sorted[0].length + sorted[1].length);
  combined.set(sorted[0], 0);
  combined.set(sorted[1], sorted[0].length);
  return keccak256(combined);
}

function compareBuf(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

// ─── Build tree ───────────────────────────────────────────────────────────────
export async function buildMerkleTree(addresses) {
  if (!addresses || addresses.length === 0) {
    return { root: "0x0000000000000000000000000000000000000000000000000000000000000000", leaves: [], layers: [] };
  }

  // Deduplicate and normalize
  const unique = [...new Set(addresses.map(a => a.trim().toLowerCase()))].filter(a => isValidAddress(a));

  // Hash all leaves
  const leaves = await Promise.all(unique.map(addr => hashLeaf(addr)));

  // Build layers bottom-up
  const layers = [leaves];
  let current = leaves;

  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        next.push(await hashPair(current[i], current[i + 1]));
      } else {
        // Odd leaf: carry up
        next.push(current[i]);
      }
    }
    layers.push(next);
    current = next;
  }

  const root = bytesToHex(current[0]);

  return { root, leaves, layers, addresses: unique };
}

// ─── Get proof for one address ────────────────────────────────────────────────
export function getMerkleProof(layers, leafIndex) {
  const proof = [];
  let idx = leafIndex;

  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    if (siblingIdx < layer.length) {
      proof.push(bytesToHex(layer[siblingIdx]));
    }
    idx = Math.floor(idx / 2);
  }

  return proof;
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
/**
 * Parses a CSV or plain text file containing Ethereum addresses.
 * Handles:
 *   - One address per line
 *   - Comma-separated addresses
 *   - Headers (skips non-address rows automatically)
 *   - Whitespace/empty lines
 *   - Mixed case
 *
 * Returns: array of lowercased valid addresses
 */
export function parseCSV(text) {
  const lines = text.split(/[\n\r]+/);
  const addresses = [];

  for (const line of lines) {
    const parts = line.split(",");
    for (const part of parts) {
      const trimmed = part.trim();
      if (isValidAddress(trimmed)) {
        addresses.push(trimmed.toLowerCase());
      }
    }
  }

  return [...new Set(addresses)]; // deduplicate
}

// ─── Validate Ethereum address ────────────────────────────────────────────────
export function isValidAddress(addr) {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ─── Format helpers ───────────────────────────────────────────────────────────
export function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

/**
 * Build a complete allowlist object ready to save to Supabase.
 * Returns: { root, count, addresses, proofs }
 */
export async function buildAllowlist(addresses) {
  const { root, leaves, layers, addresses: clean } = await buildMerkleTree(addresses);

  const proofs = {};
  clean.forEach((addr, i) => {
    proofs[addr] = getMerkleProof(layers, i);
  });

  return {
    root,
    count:     clean.length,
    addresses: clean,
    proofs,
  };
}
