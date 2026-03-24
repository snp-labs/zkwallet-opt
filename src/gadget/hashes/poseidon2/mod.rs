use std::{borrow::Borrow, marker::PhantomData};

use ark_ff::PrimeField;

use crate::Error;

use super::{CRHScheme, TwoToOneCRHScheme};

mod bn254_constants;
pub mod constraints;

use bn254_constants::{MAT_DIAG3_M_1_HEX, RC3_HEX};

#[derive(Clone)]
pub struct Parameters<F: PrimeField> {
    pub t: usize,
    pub d: usize,
    pub rounds_f_beginning: usize,
    pub rounds_p: usize,
    pub rounds: usize,
    pub mat_internal_diag_m_1: [F; 3],
    pub round_constants: Vec<[F; 3]>,
}

fn bn254_hex_to_field<F: PrimeField>(value: &str) -> F {
    let raw = value.strip_prefix("0x").unwrap_or(value);
    let bytes = hex::decode(raw).expect("invalid BN254 Poseidon2 hex constant");
    F::from_be_bytes_mod_order(&bytes)
}

fn parse_round_constants<F: PrimeField>() -> Vec<[F; 3]> {
    RC3_HEX
        .iter()
        .map(|round| {
            [
                bn254_hex_to_field::<F>(round[0]),
                bn254_hex_to_field::<F>(round[1]),
                bn254_hex_to_field::<F>(round[2]),
            ]
        })
        .collect()
}

pub fn bn254_width3_parameters<F: PrimeField>() -> Parameters<F> {
    Parameters {
        t: 3,
        d: 5,
        rounds_f_beginning: 4,
        rounds_p: 56,
        rounds: 64,
        mat_internal_diag_m_1: [
            bn254_hex_to_field::<F>(MAT_DIAG3_M_1_HEX[0]),
            bn254_hex_to_field::<F>(MAT_DIAG3_M_1_HEX[1]),
            bn254_hex_to_field::<F>(MAT_DIAG3_M_1_HEX[2]),
        ],
        round_constants: parse_round_constants(),
    }
}

pub struct Poseidon2<F: PrimeField> {
    _field: PhantomData<F>,
}

impl<F: PrimeField> Poseidon2<F> {
    fn sbox_p(input: &F, degree: usize) -> F {
        let mut input2 = *input;
        input2.square_in_place();

        match degree {
            3 => {
                let mut out = input2;
                out.mul_assign(input);
                out
            }
            5 => {
                let mut out = input2;
                out.square_in_place();
                out.mul_assign(input);
                out
            }
            7 => {
                let mut out = input2;
                out.square_in_place();
                out.mul_assign(&input2);
                out.mul_assign(input);
                out
            }
            11 => {
                let mut input4 = input2;
                input4.square_in_place();
                let mut out = input4;
                out.square_in_place();
                out.mul_assign(&input2);
                out.mul_assign(input);
                out
            }
            _ => panic!("unsupported Poseidon2 S-box degree"),
        }
    }

    fn matmul_external(state: &mut [F; 3]) {
        let mut sum = state[0];
        sum += state[1];
        sum += state[2];
        state[0] += sum;
        state[1] += sum;
        state[2] += sum;
    }

    fn matmul_internal(state: &mut [F; 3], diag_m_1: &[F; 3]) {
        let mut sum = state[0];
        sum += state[1];
        sum += state[2];

        state[0] *= diag_m_1[0];
        state[0] += sum;
        state[1] *= diag_m_1[1];
        state[1] += sum;
        state[2] *= diag_m_1[2];
        state[2] += sum;
    }

    fn add_rc(state: &mut [F; 3], rc: &[F; 3]) {
        state[0] += rc[0];
        state[1] += rc[1];
        state[2] += rc[2];
    }

    pub fn permutation(parameters: &Parameters<F>, mut state: [F; 3]) -> [F; 3] {
        Self::matmul_external(&mut state);

        for r in 0..parameters.rounds_f_beginning {
            Self::add_rc(&mut state, &parameters.round_constants[r]);
            state = state.map(|value| Self::sbox_p(&value, parameters.d));
            Self::matmul_external(&mut state);
        }

        let p_end = parameters.rounds_f_beginning + parameters.rounds_p;
        for r in parameters.rounds_f_beginning..p_end {
            state[0] += parameters.round_constants[r][0];
            state[0] = Self::sbox_p(&state[0], parameters.d);
            Self::matmul_internal(&mut state, &parameters.mat_internal_diag_m_1);
        }

        for r in p_end..parameters.rounds {
            Self::add_rc(&mut state, &parameters.round_constants[r]);
            state = state.map(|value| Self::sbox_p(&value, parameters.d));
            Self::matmul_external(&mut state);
        }

        state
    }

    fn absorb_and_permute(parameters: &Parameters<F>, mut state: [F; 3], input: &[F]) -> [F; 3] {
        for chunk in input.chunks(2) {
            state[0] += chunk[0];
            if let Some(second) = chunk.get(1) {
                state[1] += second;
            }
            state = Self::permutation(parameters, state);
        }
        state
    }
}

impl<F: PrimeField> CRHScheme for Poseidon2<F> {
    type Parameters = Parameters<F>;
    type Input = [F];
    type Output = F;

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        input: T,
    ) -> Result<Self::Output, Error> {
        let input = input.borrow();
        let state = Self::absorb_and_permute(parameters, [F::zero(), F::zero(), F::zero()], input);
        Ok(state[0])
    }
}

pub struct TwoToOnePoseidon2<F: PrimeField> {
    _field: PhantomData<F>,
}

impl<F: PrimeField> TwoToOneCRHScheme for TwoToOnePoseidon2<F> {
    type Parameters = Parameters<F>;
    type Input = F;
    type Output = F;

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        left_input: T,
        right_input: T,
    ) -> Result<Self::Output, Error> {
        Self::compress(parameters, left_input.borrow(), right_input.borrow())
    }

    fn compress<T: Borrow<Self::Output>>(
        parameters: &Self::Parameters,
        left_input: T,
        right_input: T,
    ) -> Result<Self::Output, Error> {
        let state = Poseidon2::<F>::permutation(
            parameters,
            [*left_input.borrow(), *right_input.borrow(), F::zero()],
        );
        Ok(state[0])
    }
}
