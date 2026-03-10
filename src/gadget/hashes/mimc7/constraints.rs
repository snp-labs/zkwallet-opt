use std::{
    marker::PhantomData,
    ops::{Add, AddAssign},
};

use ark_crypto_primitives::sponge::Absorb;
use ark_ff::PrimeField;
use ark_r1cs_std::{fields::fp::FpVar, prelude::AllocVar};
use ark_relations::r1cs::SynthesisError;

use crate::gadget::hashes::constraints::{CRHSchemeGadget, TwoToOneCRHSchemeGadget};

use super::{MiMC, Parameters, TwoToOneMiMC};

#[derive(Clone)]
pub struct ParametersVar<F: PrimeField> {
    params: Parameters<F>,
}

impl<F> AllocVar<Parameters<F>, F> for ParametersVar<F>
where
    F: PrimeField,
{
    fn new_variable<T: std::borrow::Borrow<Parameters<F>>>(
        _cs: impl Into<ark_relations::r1cs::Namespace<F>>,
        f: impl FnOnce() -> Result<T, SynthesisError>,
        _mode: ark_r1cs_std::prelude::AllocationMode,
    ) -> Result<Self, SynthesisError> {
        let params = f()?.borrow().clone();
        Ok(ParametersVar { params })
    }
}

pub struct MiMCGadget<F: PrimeField> {
    _field: PhantomData<F>,
}

impl<F> MiMCGadget<F>
where
    F: PrimeField,
{
    fn round(xl: FpVar<F>, xr: FpVar<F>, rc: F) -> FpVar<F> {
        let mut xored = xl + xr;
        xored.add_assign(rc);

        let mut tmp = xored.clone();
        for _ in 0..2 {
            tmp *= tmp.clone();
            xored *= tmp.clone();
        }

        xored
    }

    fn encrypt(param: ParametersVar<F>, xl: FpVar<F>, xr: FpVar<F>) -> FpVar<F> {
        let mut res = Self::round(xl.clone(), xr.clone(), F::zero());

        for i in 1..param.params.round_constants.len() {
            res = Self::round(res.clone(), xr.clone(), param.params.round_constants[i]);
        }

        res.add(xr.clone())
    }
}

impl<F> CRHSchemeGadget<MiMC<F>, F> for MiMCGadget<F>
where
    F: PrimeField + Absorb,
{
    type ParametersVar = ParametersVar<F>;
    type InputVar = [FpVar<F>];
    type OutputVar = FpVar<F>;

    fn evaluate(
        parameter: &Self::ParametersVar,
        input: &Self::InputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        let mut res: Self::OutputVar;
        if input.len() == 1 {
            let xl = input[0].clone();
            let xr = input[0].clone();
            res = Self::encrypt(parameter.clone(), xl, xr);
            res += input[0].clone() + input[0].clone();
        } else {
            res = input[0].clone();
            for xr in input.iter().skip(1) {
                let xl = res.clone();
                let xr = xr.clone();

                res = Self::encrypt(parameter.clone(), xl.clone(), xr.clone());
                res += xl + xr;
            }
        }

        Ok(res)
    }
}

pub struct TwoToOneMiMCGadget<F: PrimeField> {
    _field: PhantomData<F>,
}

impl<F> TwoToOneCRHSchemeGadget<TwoToOneMiMC<F>, F> for TwoToOneMiMCGadget<F>
where
    F: PrimeField + Absorb,
{
    type ParametersVar = ParametersVar<F>;
    type InputVar = FpVar<F>;
    type OutputVar = FpVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        left_input: &Self::InputVar,
        right_input: &Self::InputVar,
    ) -> Result<FpVar<F>, SynthesisError> {
        let xl = left_input.clone();
        let xr = right_input.clone();

        let mut res: Self::OutputVar = MiMCGadget::encrypt(parameters.clone(), xl, xr);
        res = res + left_input + right_input;

        Ok(res)
    }

    fn compress(
        parameters: &Self::ParametersVar,
        left_input: &Self::OutputVar,
        right_input: &Self::OutputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        // TODO sponge
        <Self as TwoToOneCRHSchemeGadget<TwoToOneMiMC<F>, F>>::evaluate(
            parameters,
            left_input,
            right_input,
        )
    }
}
