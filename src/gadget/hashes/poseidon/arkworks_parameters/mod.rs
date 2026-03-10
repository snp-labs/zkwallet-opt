pub mod bls_12_377;
pub mod bls_12_381;
pub mod bn254;

use ark_ff::PrimeField;
/**
 * Vec<F> -> Vec<Vec<F>>
 * RC_s = (R_f + R_p) × t
 * ark = (full_rounds + partial_rounds) × (rate + 1)
 */
// 원소의 개수가 rows * cols인 벡터를 rows x cols 행렬로 변환
pub fn unflatten_vec<F: PrimeField>(vec: Vec<F>, rows: usize, cols: usize) -> Vec<Vec<F>> {
    assert_eq!(vec.len(), rows * cols, "Invalid dimensions");
    vec.chunks(cols).map(|chunk| chunk.to_vec()).collect()
}
