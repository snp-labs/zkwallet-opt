use std::marker::PhantomData;

use ark_ff::PrimeField;
use ark_r1cs_std::{
    alloc::AllocVar,
    fields::{FieldVar, fp::FpVar},
    prelude::AllocationMode,
};
use ark_relations::r1cs::SynthesisError;

use crate::gadget::hashes::constraints::{CRHSchemeGadget, TwoToOneCRHSchemeGadget};

use super::{Parameters, Poseidon2, TwoToOnePoseidon2};

#[derive(Clone)]
pub struct ParametersVar<F: PrimeField> {
    pub params: Parameters<F>,
}

impl<F: PrimeField> AllocVar<Parameters<F>, F> for ParametersVar<F> {
    fn new_variable<T: std::borrow::Borrow<Parameters<F>>>(
        _cs: impl Into<ark_relations::r1cs::Namespace<F>>,
        f: impl FnOnce() -> Result<T, SynthesisError>,
        _mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        Ok(Self {
            params: f()?.borrow().clone(),
        })
    }
}

pub struct Poseidon2Gadget<F: PrimeField> {
    _field: PhantomData<F>,
}

impl<F: PrimeField> Poseidon2Gadget<F> {
    fn sbox_p(input: &FpVar<F>, degree: usize) -> Result<FpVar<F>, SynthesisError> {
        let input2 = input.square()?;
        match degree {
            3 => Ok(input2 * input),
            5 => {
                let input4 = input2.square()?;
                Ok(input4 * input)
            }
            7 => {
                let input4 = input2.square()?;
                Ok((input4 * &input2) * input)
            }
            11 => {
                let input4 = input2.square()?;
                let input8 = input4.square()?;
                Ok((input8 * &input2) * input)
            }
            _ => Err(SynthesisError::Unsatisfiable),
        }
    }

    fn matmul_external(state: &mut [FpVar<F>; 3]) {
        let sum = state[0].clone() + &state[1] + &state[2];
        state[0] = state[0].clone() + &sum;
        state[1] = state[1].clone() + &sum;
        state[2] = state[2].clone() + &sum;
    }

    fn matmul_internal(state: &mut [FpVar<F>; 3], diag_m_1: &[F; 3]) {
        let sum = state[0].clone() + &state[1] + &state[2];
        state[0] = state[0].clone() * diag_m_1[0] + &sum;
        state[1] = state[1].clone() * diag_m_1[1] + &sum;
        state[2] = state[2].clone() * diag_m_1[2] + &sum;
    }

    fn add_rc(state: &mut [FpVar<F>; 3], rc: &[F; 3]) {
        state[0] += rc[0];
        state[1] += rc[1];
        state[2] += rc[2];
    }

    fn permutation(
        parameters: &Parameters<F>,
        mut state: [FpVar<F>; 3],
    ) -> Result<[FpVar<F>; 3], SynthesisError> {
        Self::matmul_external(&mut state);

        for r in 0..parameters.rounds_f_beginning {
            Self::add_rc(&mut state, &parameters.round_constants[r]);
            state = [
                Self::sbox_p(&state[0], parameters.d)?,
                Self::sbox_p(&state[1], parameters.d)?,
                Self::sbox_p(&state[2], parameters.d)?,
            ];
            Self::matmul_external(&mut state);
        }

        let p_end = parameters.rounds_f_beginning + parameters.rounds_p;
        for r in parameters.rounds_f_beginning..p_end {
            state[0] += parameters.round_constants[r][0];
            state[0] = Self::sbox_p(&state[0], parameters.d)?;
            Self::matmul_internal(&mut state, &parameters.mat_internal_diag_m_1);
        }

        for r in p_end..parameters.rounds {
            Self::add_rc(&mut state, &parameters.round_constants[r]);
            state = [
                Self::sbox_p(&state[0], parameters.d)?,
                Self::sbox_p(&state[1], parameters.d)?,
                Self::sbox_p(&state[2], parameters.d)?,
            ];
            Self::matmul_external(&mut state);
        }

        Ok(state)
    }
}

impl<F: PrimeField> CRHSchemeGadget<Poseidon2<F>, F> for Poseidon2Gadget<F> {
    type InputVar = [FpVar<F>];
    type OutputVar = FpVar<F>;
    type ParametersVar = ParametersVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        input: &Self::InputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        let mut state = [FpVar::zero(), FpVar::zero(), FpVar::zero()];

        for chunk in input.chunks(2) {
            state[0] += chunk[0].clone();
            if let Some(second) = chunk.get(1) {
                state[1] += second.clone();
            }
            state = Self::permutation(&parameters.params, state)?;
        }

        Ok(state[0].clone())
    }
}

pub struct TwoToOnePoseidon2Gadget<F: PrimeField> {
    _field: PhantomData<F>,
}

impl<F: PrimeField> TwoToOneCRHSchemeGadget<TwoToOnePoseidon2<F>, F>
    for TwoToOnePoseidon2Gadget<F>
{
    type InputVar = FpVar<F>;
    type OutputVar = FpVar<F>;
    type ParametersVar = ParametersVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        left_input: &Self::InputVar,
        right_input: &Self::InputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        Self::compress(parameters, left_input, right_input)
    }

    fn compress(
        parameters: &Self::ParametersVar,
        left_input: &Self::OutputVar,
        right_input: &Self::OutputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        let state = Poseidon2Gadget::<F>::permutation(
            &parameters.params,
            [left_input.clone(), right_input.clone(), FpVar::zero()],
        )?;
        Ok(state[0].clone())
    }
}
