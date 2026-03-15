// Poseidon2 Hash Function Implementation
// Reference: https://github.com/HorizenLabs/poseidon2
//
// This module provides native (circuit-free) implementations of Poseidon2
// hash functions with CRH (Collision-Resistant Hash) traits.

pub mod instances;
pub mod params;
pub mod sponge; // Publicly expose sponge module for Poseidon2Sponge
pub mod utils;

pub mod constraints;

use crate::Error;
use ark_ff::PrimeField;
use ark_std::marker::PhantomData;
use crate::gadget::hashes::{CRHScheme, NToOneCRHScheme, TwoToOneCRHScheme};
use params::Poseidon2Params;
use sponge::Poseidon2Sponge;
use std::borrow::Borrow;

/// Poseidon2 CRH implementation for single-input hashing
///
/// # Example
/// ```ignore
/// let params = get_poseidon2_bn254_params();
/// let input = vec![Fr::from(1), Fr::from(2)];
/// let hash = Poseidon2Hash::<Fr>::evaluate(&params, input.as_slice())?;
/// ```
pub struct Poseidon2Hash<F: PrimeField> {
    _phantom: PhantomData<F>,
}

impl<F: PrimeField> CRHScheme for Poseidon2Hash<F> {
    type Input = [F];
    type Output = F;
    type Parameters = Poseidon2Params<F>;

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        input: T,
    ) -> Result<Self::Output, Error> {
        let mut sponge = Poseidon2Sponge::new(parameters);
        sponge.absorb(input.borrow())?;
        let outputs = sponge.squeeze_field_elements(1)?;
        Ok(outputs[0])
    }
}

/// Poseidon2 CRH for Merkle tree compression (two-input to one-output)
///
/// Uses Davies-Meyer compression: C(left, right) = P([left, right])[0] + left
/// Requires t=2 parameters.
///
/// # Example
/// ```ignore
/// let params = get_poseidon2_bn254_t2_params();
/// let hash = Poseidon2TwoToOneCRH::<Fr>::compress(&params, &left, &right)?;
/// ```
pub struct Poseidon2TwoToOneCRH<F: PrimeField> {
    _phantom: PhantomData<F>,
}

impl<F: PrimeField> TwoToOneCRHScheme for Poseidon2TwoToOneCRH<F> {
    type Input = F;
    type Output = F;
    type Parameters = Poseidon2Params<F>;

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        left: T,
        right: T,
    ) -> Result<Self::Output, Error> {
        Self::compress(parameters, left.borrow(), right.borrow())
    }

    fn compress<T: Borrow<Self::Output>>(
        parameters: &Self::Parameters,
        left: T,
        right: T,
    ) -> Result<Self::Output, Error> {
        assert_eq!(
            parameters.t, 2,
            "TwoToOneCRH requires t=2 params; got t={}",
            parameters.t
        );
        Poseidon2Hash::<F>::compress_davies_meyer(parameters, &[*left.borrow(), *right.borrow()])
    }
}

/// Poseidon2 CRH for N-input to one-output hashing
///
/// Uses Davies-Meyer compression: C(inputs) = P(inputs)[0] + inputs[0]
/// Requires t=N parameters.
///
/// # Example
/// ```ignore
/// let params = get_poseidon2_bn254_t4_params();
/// let inputs = [Fr::from(1), Fr::from(2), Fr::from(3), Fr::from(4)];
/// let hash = Poseidon2NToOneCRH::<4, Fr>::compress(&params, &inputs)?;
/// ```
pub struct Poseidon2NToOneCRH<const N: usize, F: PrimeField> {
    _phantom: PhantomData<F>,
}

impl<const N: usize, F: PrimeField> NToOneCRHScheme<N> for Poseidon2NToOneCRH<N, F> {
    type Input = F;
    type Output = F;
    type Parameters = Poseidon2Params<F>;

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        inputs: &[T; N],
    ) -> Result<Self::Output, Error> {
        let borrowed: Vec<F> = inputs.iter().map(|x| *x.borrow()).collect();
        Self::compress(parameters, &borrowed.try_into().unwrap())
    }

    fn compress<T: Borrow<Self::Output>>(
        parameters: &Self::Parameters,
        inputs: &[T; N],
    ) -> Result<Self::Output, Error> {
        assert_eq!(
            parameters.t, N,
            "NToOneCRH<{}> requires t={} params; got t={}",
            N, N, parameters.t
        );
        let vals: Vec<F> = inputs.iter().map(|x| *x.borrow()).collect();
        Poseidon2Hash::<F>::compress_davies_meyer(parameters, &vals)
    }
}

impl<F: PrimeField> Poseidon2Hash<F> {
    /// Core Poseidon2 permutation (for testing and advanced use)
    ///
    /// This is a low-level function. Most applications should use
    /// `Poseidon2Sponge` for variable-length hashing instead.
    pub fn permutation(params: &Poseidon2Params<F>, input: &[F]) -> Result<Vec<F>, Error> {
        let t = params.t;
        assert_eq!(input.len(), t, "input length must equal state width");
        Self::permutation_internal(params, input)
    }

    /// Poseidon2 Davies-Meyer compression: C(x) = P(x)[0] + x[0]
    ///
    /// The feed-forward `+ x[0]` prevents the preimage attack that exists with pure
    /// truncation: without it, an attacker given target y could pick arbitrary z and
    /// compute x = P⁻¹([y, z]) to find a valid preimage. The feed-forward term
    /// creates a fixed-point equation that makes this infeasible.
    ///
    /// # Note on pure truncation
    /// `C(x) = P(x)[0]` alone is insecure when len(inputs) == t because P⁻¹ is
    /// efficiently computable for Poseidon2. The only secure truncation-only approach
    /// is sponge mode where some state elements are fixed (e.g., capacity = 0).
    pub fn compress_davies_meyer(params: &Poseidon2Params<F>, inputs: &[F]) -> Result<F, Error> {
        assert_eq!(
            inputs.len(),
            params.t,
            "inputs length must match state width t"
        );
        let state = Self::permutation(params, inputs)?;
        Ok(state[0] + inputs[0])
    }

    /// Internal permutation implementation
    fn permutation_internal(params: &Poseidon2Params<F>, input: &[F]) -> Result<Vec<F>, Error> {
        let mut state = input.to_vec();

        // Initial matrix multiplication (mandatory for Poseidon2)
        Self::matmul_external(&mut state, params);

        let rf_begin = params.rounds_f_beginning;
        let rp = params.rounds_p;
        let rf_end = params.rounds_f_end;

        // Full rounds (first half)
        for r in 0..rf_begin {
            Self::add_rc_full(&mut state, &params.round_constants[r]);
            Self::sbox_full(&mut state, params.d);
            Self::matmul_external(&mut state, params);
        }

        // Partial rounds
        for r in rf_begin..(rf_begin + rp) {
            state[0].add_assign(&params.round_constants[r][0]);
            state[0] = Self::sbox_p(state[0], params.d);
            Self::matmul_internal(&mut state, params);
        }

        // Full rounds (second half)
        for r in (rf_begin + rp)..(rf_begin + rp + rf_end) {
            Self::add_rc_full(&mut state, &params.round_constants[r]);
            Self::sbox_full(&mut state, params.d);
            Self::matmul_external(&mut state, params);
        }

        Ok(state)
    }

    // ========== Permutation Helper Functions ==========

    fn add_rc_full(state: &mut [F], rc: &[F]) {
        for (i, &c) in rc.iter().enumerate() {
            state[i].add_assign(&c);
        }
    }

    fn sbox_p(x: F, d: usize) -> F {
        x.pow(&[d as u64])
    }

    fn sbox_full(state: &mut [F], d: usize) {
        for elem in state.iter_mut() {
            *elem = elem.pow(&[d as u64]);
        }
    }

    fn matmul_external(state: &mut [F], params: &Poseidon2Params<F>) {
        let t = params.t;

        match t {
            2 => {
                let sum = state[0] + state[1];
                let tmp0 = state[0];
                state[0] = tmp0 + sum;
                state[1] = tmp0 + state[1] + sum;
            }
            3 => {
                // Circulant matrix: [2, 1, 1; 1, 2, 1; 1, 1, 2]
                let sum = state[0] + state[1] + state[2];
                let tmp0 = state[0];
                let tmp1 = state[1];
                let tmp2 = state[2];
                state[0] = tmp0 + sum;
                state[1] = tmp1 + sum;
                state[2] = tmp2 + sum;
            }
            4 | 8 | 12 | 16 | 20 | 24 => {
                Self::matmul_m4(state);
                if t > 4 {
                    let t4 = t / 4;
                    let mut stored = vec![F::zero(); 4];
                    for l in 0..4 {
                        stored[l] = state[l];
                        for j in 1..t4 {
                            stored[l].add_assign(&state[4 * j + l]);
                        }
                    }
                    for i in 0..state.len() {
                        state[i].add_assign(&stored[i % 4]);
                    }
                }
            }
            _ => panic!("unsupported state width: {}", t),
        }
    }

    fn matmul_m4(state: &mut [F]) {
        let t4 = state.len() / 4;
        for i in 0..t4 {
            let start = i * 4;
            let mut t0 = state[start];
            t0.add_assign(&state[start + 1]);
            let mut t1 = state[start + 2];
            t1.add_assign(&state[start + 3]);
            let mut t2 = state[start + 1];
            t2.double_in_place();
            t2.add_assign(&t1);
            let mut t3 = state[start + 3];
            t3.double_in_place();
            t3.add_assign(&t0);
            let mut t4 = t1;
            t4.double_in_place();
            t4.double_in_place();
            t4.add_assign(&t3);
            let mut t5 = t0;
            t5.double_in_place();
            t5.double_in_place();
            t5.add_assign(&t2);
            let mut t6 = t3;
            t6.add_assign(&t5);
            let mut t7 = t2;
            t7.add_assign(&t4);
            state[start] = t6;
            state[start + 1] = t5;
            state[start + 2] = t7;
            state[start + 3] = t4;
        }
    }

    fn matmul_internal(state: &mut [F], params: &Poseidon2Params<F>) {
        let t = params.t;
        let mut sum = state[0];
        for i in 1..t {
            sum.add_assign(&state[i]);
        }
        // Formula: y_i = (mu_i - 1) * x_i + sum
        //
        // IMPORTANT: params.mat_internal_diag_m_1[i] is ALREADY (mu_i - 1).
        // Do NOT add F::one() here. If you do:
        //   let mu_i = params.mat_internal_diag_m_1[i] + F::one();
        //   state[i] = mu_i * state[i] + sum;
        // This computes: y_i = mu_i * x_i + sum = (2*mu_i - 1) * x_i + sum
        // which causes INCORRECT permutation output (KAT test mismatch with Horizen Labs).
        for i in 0..t {
            state[i] = params.mat_internal_diag_m_1[i] * state[i] + sum;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gadget::hashes::poseidon2::instances::bn254::{
        get_poseidon2_bn254_t2_params, get_poseidon2_bn254_t4_params,
    };
    use ark_bn254::Fr;
    use ark_ff::Zero;

    #[test]
    fn test_compress_deterministic() {
        let params = get_poseidon2_bn254_t2_params();
        let left = Fr::from(42u64);
        let right = Fr::from(100u64);

        let result1 =
            Poseidon2TwoToOneCRH::<Fr>::compress(&params, &left, &right).expect("compress 1 failed");
        let result2 =
            Poseidon2TwoToOneCRH::<Fr>::compress(&params, &left, &right).expect("compress 2 failed");

        assert_eq!(result1, result2, "compression must be deterministic");
    }

    #[test]
    fn test_compress_t2_equals_davies_meyer() {
        // Davies-Meyer: C(left, right) = P([left, right])[0] + left
        let params = get_poseidon2_bn254_t2_params();
        let left = Fr::from(1u64);
        let right = Fr::from(2u64);

        let compress_result =
            Poseidon2TwoToOneCRH::<Fr>::compress(&params, &left, &right).expect("compress failed");
        let perm_result =
            Poseidon2Hash::<Fr>::permutation(&params, &[left, right]).expect("perm failed");

        assert_eq!(
            compress_result,
            perm_result[0] + left,
            "Davies-Meyer: compress must equal P(x)[0] + x[0]"
        );
    }

    #[test]
    fn test_compress_different_inputs() {
        let params = get_poseidon2_bn254_t2_params();

        let result1 =
            Poseidon2TwoToOneCRH::<Fr>::compress(&params, &Fr::from(1u64), &Fr::from(2u64))
                .expect("compress 1 failed");
        let result2 =
            Poseidon2TwoToOneCRH::<Fr>::compress(&params, &Fr::from(2u64), &Fr::from(1u64))
                .expect("compress 2 failed");

        assert_ne!(
            result1, result2,
            "different inputs should produce different outputs"
        );
    }

    #[test]
    fn test_compress_t4_non_zero() {
        let params = get_poseidon2_bn254_t4_params();
        let inputs = [
            Fr::from(1u64),
            Fr::from(2u64),
            Fr::from(3u64),
            Fr::from(4u64),
        ];

        let result =
            Poseidon2NToOneCRH::<4, Fr>::compress(&params, &inputs).expect("compress failed");

        assert!(result != Fr::zero(), "compression result should be non-zero");
    }

    #[test]
    fn test_compress_davies_meyer_formula() {
        // Explicitly verify: C(x) = P(x)[0] + x[0]
        let params = get_poseidon2_bn254_t2_params();
        let inputs = [Fr::from(5u64), Fr::from(10u64)];

        let dm_result =
            Poseidon2Hash::<Fr>::compress_davies_meyer(&params, &inputs).expect("dm failed");
        let perm_result =
            Poseidon2Hash::<Fr>::permutation(&params, &inputs).expect("perm failed");

        assert_eq!(
            dm_result,
            perm_result[0] + inputs[0],
            "Davies-Meyer must equal P(x)[0] + x[0]"
        );
        // Also verify it differs from pure truncation
        assert_ne!(
            dm_result, perm_result[0],
            "Davies-Meyer should differ from pure truncation (unless x[0] == 0)"
        );
    }
}
