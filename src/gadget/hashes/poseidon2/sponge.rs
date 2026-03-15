// Poseidon2 Sponge Implementation
// Reference: https://github.com/HorizenLabs/poseidon2
// Architecture based on ark-crypto-primitives CryptographicSponge pattern

use crate::Error;
use ark_crypto_primitives::sponge::DuplexSpongeMode;
use ark_ff::PrimeField;
use super::params::Poseidon2Params;

/// Poseidon2 Sponge Construction
///
/// A cryptographic sponge implementing the duplex construction with:
/// - **Capacity**: 1 (security element, hidden from external input/output)
/// - **Rate**: t - 1 (public input/output section width)
/// - **Permutation**: Poseidon2 with mandatory initial matrix multiplication
///
/// # References
/// - Poseidon2 Paper: https://eprint.iacr.org/2023/323.pdf
/// - Horizen Labs Reference: https://github.com/HorizenLabs/poseidon2
///
/// # Example
/// ```ignore
/// let mut sponge = Poseidon2Sponge::new(&params);
/// sponge.absorb(&[input1, input2])?;
/// let output = sponge.squeeze_field_elements(1)?;
/// ```
#[derive(Clone)]
pub struct Poseidon2Sponge<F: PrimeField> {
    /// Sponge parameters (t, d, round counts, constants, matrices)
    pub parameters: Poseidon2Params<F>,
    /// Internal state vector [capacity || rate] = [1 || (t-1)]
    state: Vec<F>,
    /// Current duplex mode and position
    mode: DuplexSpongeMode,
}

impl<F: PrimeField> Poseidon2Sponge<F> {
    /// Create a new sponge instance initialized to zero state
    pub fn new(parameters: &Poseidon2Params<F>) -> Self {
        let t = parameters.t;
        Self {
            parameters: parameters.clone(),
            state: vec![F::zero(); t],
            mode: DuplexSpongeMode::Absorbing {
                next_absorb_index: 0,
            },
        }
    }

    /// Absorb input elements
    ///
    /// Adds input elements to the rate section (capacity remains untouched).
    /// Automatically applies the permutation when the rate section becomes full.
    ///
    /// # Errors
    /// Returns error if permutation fails
    pub fn absorb(&mut self, input: &[F]) -> Result<(), Error> {
        let rate = self.parameters.t - 1;

        for &element in input {
            // Transition from squeezing to absorbing requires implicit permutation
            if let DuplexSpongeMode::Squeezing { .. } = self.mode {
                self.permute()?;
                self.mode = DuplexSpongeMode::Absorbing {
                    next_absorb_index: 0,
                };
            }

            // Extract current absorb position
            let next_absorb_index = if let DuplexSpongeMode::Absorbing {
                next_absorb_index,
            } = self.mode
            {
                next_absorb_index
            } else {
                unreachable!()
            };

            // Add element to rate section (capacity is at state[0])
            let state_idx = 1 + next_absorb_index;
            self.state[state_idx].add_assign(&element);

            // Advance absorb position
            let next_idx = next_absorb_index + 1;

            // Permute if rate section full
            if next_idx >= rate {
                self.permute()?;
                self.mode = DuplexSpongeMode::Absorbing {
                    next_absorb_index: 0,
                };
            } else {
                self.mode = DuplexSpongeMode::Absorbing {
                    next_absorb_index: next_idx,
                };
            }
        }

        Ok(())
    }

    /// Squeeze field elements
    ///
    /// Extracts field elements from the rate section.
    /// Automatically applies the permutation when the rate is exhausted.
    /// Implicitly permutes when transitioning from absorbing mode.
    ///
    /// # Errors
    /// Returns error if permutation fails
    pub fn squeeze_field_elements(&mut self, num_elements: usize) -> Result<Vec<F>, Error> {
        let rate = self.parameters.t - 1;
        let mut result = Vec::with_capacity(num_elements);

        for _ in 0..num_elements {
            // Transition from absorbing to squeezing requires implicit permutation
            if let DuplexSpongeMode::Absorbing { .. } = self.mode {
                self.permute()?;
                self.mode = DuplexSpongeMode::Squeezing {
                    next_squeeze_index: 0,
                };
            }

            // Extract current squeeze position
            let next_squeeze_index = if let DuplexSpongeMode::Squeezing {
                next_squeeze_index,
            } = self.mode
            {
                next_squeeze_index
            } else {
                unreachable!()
            };

            // Extract from rate section
            let state_idx = 1 + next_squeeze_index;
            result.push(self.state[state_idx]);

            // Advance squeeze position
            let next_idx = next_squeeze_index + 1;

            // Permute if rate section exhausted
            if next_idx >= rate {
                self.permute()?;
                self.mode = DuplexSpongeMode::Squeezing {
                    next_squeeze_index: 0,
                };
            } else {
                self.mode = DuplexSpongeMode::Squeezing {
                    next_squeeze_index: next_idx,
                };
            }
        }

        Ok(result)
    }

    /// Core Poseidon2 Permutation
    ///
    /// Implements the full permutation:
    /// 1. Initial linear layer (matmul_external)
    /// 2. RF/2 full rounds (ARK + S-box + matmul_external)
    /// 3. RP partial rounds (ARK[0] + S-box_partial + matmul_internal)
    /// 4. RF/2 full rounds (ARK + S-box + matmul_external)
    ///
    /// # Reference
    /// https://github.com/HorizenLabs/poseidon2/blob/main/plain_implementations/src/poseidon2/poseidon2.rs
    fn permute(&mut self) -> Result<(), Error> {
        let params = &self.parameters;

        // Apply initial matrix multiplication (required for Poseidon2)
        Self::matmul_external(&mut self.state, params.t);

        // RF/2 full rounds
        for r in 0..params.rounds_f_beginning {
            Self::add_rc_full(&mut self.state, &params.round_constants[r]);
            Self::sbox_full(&mut self.state, params.d);
            Self::matmul_external(&mut self.state, params.t);
        }

        // RP partial rounds
        for r in 0..params.rounds_p {
            let rc_idx = params.rounds_f_beginning + r;
            Self::add_rc_partial(&mut self.state, &params.round_constants[rc_idx]);
            Self::sbox_partial(&mut self.state, params.d);
            Self::matmul_internal(&mut self.state, &params.mat_internal_diag_m_1);
        }

        // RF/2 full rounds
        for r in 0..params.rounds_f_end {
            let rc_idx = params.rounds_f_beginning + params.rounds_p + r;
            Self::add_rc_full(&mut self.state, &params.round_constants[rc_idx]);
            Self::sbox_full(&mut self.state, params.d);
            Self::matmul_external(&mut self.state, params.t);
        }

        Ok(())
    }

    // ========== Helper permutation operations ==========

    /// Add round constants to all state elements (full round)
    fn add_rc_full(state: &mut [F], rc: &[F]) {
        for (i, &c) in rc.iter().enumerate() {
            state[i].add_assign(&c);
        }
    }

    /// Add round constant only to state[0] (partial round)
    fn add_rc_partial(state: &mut [F], rc: &[F]) {
        state[0].add_assign(&rc[0]);
    }

    /// Apply S-box to all state elements: x^d
    fn sbox_full(state: &mut [F], d: usize) {
        for elem in state.iter_mut() {
            *elem = elem.pow(&[d as u64]);
        }
    }

    /// Apply S-box only to state[0]: x^d
    fn sbox_partial(state: &mut [F], d: usize) {
        state[0] = state[0].pow(&[d as u64]);
    }

    /// Apply external matrix (circulant) to state
    /// Uses M4 optimization for t >= 4
    fn matmul_external(state: &mut [F], t: usize) {
        // Special case: t = 2, 3 (circulant matrices)
        if t == 2 {
            let sum = state[0] + state[1];
            let tmp0 = state[0];
            state[0] = tmp0 + sum;
            state[1] = tmp0 + state[1] + sum;
        } else if t == 3 {
            // Circulant matrix: [2, 1, 1; 1, 2, 1; 1, 1, 2]
            let sum = state[0] + state[1] + state[2];
            let tmp0 = state[0];
            let tmp1 = state[1];
            let tmp2 = state[2];
            state[0] = tmp0 + sum;
            state[1] = tmp1 + sum;
            state[2] = tmp2 + sum;
        } else if t == 4 || t == 8 || t == 12 || t == 16 || t == 20 || t == 24 {
            // Apply M4 to each 4-element block
            let t4 = t / 4;
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

            // Apply second cheap matrix for t > 4
            if t > 4 {
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
        } else {
            panic!("unsupported state width: {}", t);
        }
    }

    /// Apply internal matrix (diagonal) to state
    ///
    /// M_I is diagonal: M_I[i,j] = { mu_i if i==j else 1 }
    /// Optimized as: y_i = (mu_i - 1) * x_i + sum(x)
    /// where mat_internal_diag_m_1[i] = mu_i - 1
    fn matmul_internal(state: &mut [F], mat_internal_diag_m_1: &[F]) {
        let t = state.len();

        // Compute sum of all elements
        let mut sum = state[0];
        for i in 1..t {
            sum.add_assign(&state[i]);
        }

        // Compute output: y_i = (mu_i - 1) * x_i + sum
        //
        // IMPORTANT: mat_internal_diag_m_1[i] is ALREADY (mu_i - 1).
        // Do NOT add F::one() here. If you do:
        //   let mu_i = mat_internal_diag_m_1[i] + F::one();
        //   state[i] = mu_i * state[i] + sum;
        // This computes: y_i = mu_i * x_i + sum = (2*mu_i - 1) * x_i + sum
        // which is INCORRECT and produces wrong permutation output.
        for i in 0..t {
            state[i] = mat_internal_diag_m_1[i] * state[i] + sum;
        }
    }
}
