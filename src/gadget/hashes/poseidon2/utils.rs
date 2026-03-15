use ark_ff::PrimeField;

/// Convert a big-endian hex string (with or without "0x" prefix) to a field element.
///
/// Note: the Horizen Labs reference parameters represent field elements
/// as big-endian hex, so this function uses `from_be_bytes_mod_order` accordingly.
pub fn from_hex<F: PrimeField>(s: &str) -> F {
    let s = s.trim_start_matches("0x");
    F::from_be_bytes_mod_order(&hex::decode(s).expect("invalid hex string"))
}
