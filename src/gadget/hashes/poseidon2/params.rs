use ark_ff::PrimeField;

/// Parameters for the Poseidon2 permutation.
///
/// The external matrix (M_E) is not stored here because it is fully determined by the
/// state size `t` (t=2,3: fixed circulant matrix; t≥4: repeated M4 block matrix) and
/// can always be reconstructed deterministically. Only the internal matrix diagonal
/// (`mat_internal_diag_m_1`) is stored, as it varies per field and instantiation.
#[derive(Clone, Debug)]
pub struct Poseidon2Params<F: PrimeField> {
    /// State size (t)
    pub t: usize,
    /// S-box degree (d = 3, 5, 7)
    pub d: usize,
    /// Number of full rounds at the beginning (RF/2)
    pub rounds_f_beginning: usize,
    /// Number of partial rounds (RP)
    pub rounds_p: usize,
    /// Number of full rounds at the end (RF/2)
    pub rounds_f_end: usize,
    /// Internal matrix diagonal minus 1: mat_internal[i][i] = mat_internal_diag_m_1[i] + 1
    pub mat_internal_diag_m_1: Vec<F>,
    /// Round constants, layout: [RF/2 full rounds | RP partial rounds | RF/2 full rounds]
    /// Each round is stored as a t-element vector. For partial rounds, only index 0 is
    /// non-zero; indices 1..t are zero (permutation code only reads index 0 for partial rounds).
    pub round_constants: Vec<Vec<F>>,
}

impl<F: PrimeField> Poseidon2Params<F> {
    pub fn new(
        t: usize,
        d: usize,
        rounds_f: usize,
        rounds_p: usize,
        mat_internal_diag_m_1: Vec<F>,
        round_constants: Vec<Vec<F>>,
    ) -> Self {
        assert!(rounds_f % 2 == 0, "rounds_f must be even");
        assert_eq!(
            round_constants.len(),
            rounds_f + rounds_p,
            "round_constants length must equal rounds_f + rounds_p"
        );
        Self {
            t,
            d,
            rounds_f_beginning: rounds_f / 2,
            rounds_p,
            rounds_f_end: rounds_f / 2,
            mat_internal_diag_m_1,
            round_constants,
        }
    }

    pub fn rounds_f(&self) -> usize {
        self.rounds_f_beginning + self.rounds_f_end
    }

    pub fn rounds_total(&self) -> usize {
        self.rounds_f() + self.rounds_p
    }
}
