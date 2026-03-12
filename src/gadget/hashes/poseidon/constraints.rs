use crate::gadget::hashes::{
    CRHScheme, NToOneCRHScheme,
    constraints::{CRHSchemeGadget, NToOneCRHSchemeGadget, TwoToOneCRHSchemeGadget},
    poseidon::{NToOneCRH, PoseidonHash, TwoToOneCRH},
};
use ark_crypto_primitives::sponge::{
    Absorb,
    constraints::CryptographicSpongeVar,
    poseidon::{PoseidonConfig, constraints::PoseidonSpongeVar},
};
use ark_ff::PrimeField;
use ark_r1cs_std::{
    R1CSVar,
    alloc::{AllocVar, AllocationMode},
    fields::fp::FpVar,
};
use ark_relations::r1cs::{Namespace, SynthesisError};

#[cfg(not(feature = "std"))]
use ark_std::vec::Vec;
use ark_std::{borrow::Borrow, marker::PhantomData};

#[derive(Clone)]
pub struct CRHParametersVar<F: PrimeField + Absorb> {
    pub parameters: PoseidonConfig<F>,
}

pub struct CRHGadget<F: PrimeField + Absorb> {
    field_phantom: PhantomData<F>,
}

impl<F: PrimeField + Absorb> CRHSchemeGadget<PoseidonHash<F>, F> for CRHGadget<F> {
    type InputVar = [FpVar<F>];
    type OutputVar = FpVar<F>;
    type ParametersVar = CRHParametersVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        input: &Self::InputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        let cs = input.cs();

        if cs.is_none() {
            let mut constant_input = Vec::new();
            for var in input.iter() {
                constant_input.push(var.value()?);
            }
            Ok(FpVar::Constant(
                PoseidonHash::<F>::evaluate(&parameters.parameters, constant_input).unwrap(),
            ))
        } else {
            let mut sponge = PoseidonSpongeVar::new(cs, &parameters.parameters);
            sponge.absorb(&input)?;
            let res = sponge.squeeze_field_elements(1)?;
            Ok(res[0].clone())
        }
    }
}

pub struct TwoToOneCRHGadget<F: PrimeField + Absorb> {
    field_phantom: PhantomData<F>,
}

impl<F: PrimeField + Absorb> TwoToOneCRHSchemeGadget<TwoToOneCRH<F>, F> for TwoToOneCRHGadget<F> {
    type InputVar = FpVar<F>;
    type OutputVar = FpVar<F>;
    type ParametersVar = CRHParametersVar<F>;

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
        let cs = left_input.cs().or(right_input.cs());

        if cs.is_none() {
            Ok(FpVar::Constant(
                PoseidonHash::<F>::evaluate(
                    &parameters.parameters,
                    vec![left_input.value()?, right_input.value()?],
                )
                .unwrap(),
            ))
        } else {
            let mut sponge = PoseidonSpongeVar::new(cs, &parameters.parameters);
            sponge.absorb(left_input)?;
            sponge.absorb(right_input)?;
            let res = sponge.squeeze_field_elements(1)?;
            Ok(res[0].clone())
        }
    }
}

pub struct NToOneCRHGadget<const N: usize, F: PrimeField + Absorb> {
    field_phantom: PhantomData<F>,
}

impl<const N: usize, F: PrimeField + Absorb> NToOneCRHSchemeGadget<N, NToOneCRH<N, F>, F>
    for NToOneCRHGadget<N, F>
{
    type InputVar = FpVar<F>;
    type OutputVar = FpVar<F>;
    type ParametersVar = CRHParametersVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        inputs: &[Self::InputVar; N],
    ) -> Result<Self::OutputVar, SynthesisError> {
        Self::compress(parameters, inputs)
    }

    fn compress(
        parameters: &Self::ParametersVar,
        inputs: &[Self::OutputVar; N],
    ) -> Result<Self::OutputVar, SynthesisError> {
        let mut cs = None;
        for input in inputs {
            cs = cs.or(Some(input.cs()));
        }

        if cs.is_none() {
            let mut constant_inputs = Vec::with_capacity(N);
            for input in inputs {
                constant_inputs.push(input.value()?);
            }
            let inputs_array: [F; N] = constant_inputs
                .try_into()
                .map_err(|_| SynthesisError::AssignmentMissing)?;
            Ok(FpVar::Constant(
                NToOneCRH::<N, F>::evaluate(&parameters.parameters, &inputs_array).unwrap(),
            ))
        } else {
            let mut sponge = PoseidonSpongeVar::new(cs.unwrap(), &parameters.parameters);
            for input in inputs {
                sponge.absorb(input)?;
            }
            let res = sponge.squeeze_field_elements(1)?;
            Ok(res[0].clone())
        }
    }
}

impl<F: PrimeField + Absorb> AllocVar<PoseidonConfig<F>, F> for CRHParametersVar<F> {
    fn new_variable<T: Borrow<PoseidonConfig<F>>>(
        _cs: impl Into<Namespace<F>>,
        f: impl FnOnce() -> Result<T, SynthesisError>,
        _mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        f().map(|param| {
            let parameters = param.borrow().clone();

            Self { parameters }
        })
    }
}

#[cfg(test)]
mod test {
    use crate::gadget::hashes::{
        CRHScheme, TwoToOneCRHScheme,
        constraints::{CRHSchemeGadget, NToOneCRHSchemeGadget, TwoToOneCRHSchemeGadget},
        poseidon::constraints::{CRHGadget, CRHParametersVar, NToOneCRHGadget, TwoToOneCRHGadget},
        poseidon::{PoseidonHash, TwoToOneCRH},
    };
    use ark_bn254::Fr;
    use ark_crypto_primitives::sponge::poseidon::PoseidonConfig;
    use ark_r1cs_std::{
        R1CSVar,
        alloc::AllocVar,
        fields::fp::{AllocatedFp, FpVar},
    };
    use ark_relations::r1cs::ConstraintSystem;
    use ark_std::UniformRand;
    use std::time::Instant;

    #[test]
    fn test_consistency() {
        let mut test_rng = ark_std::test_rng();

        // The following way of generating the MDS matrix is incorrect
        // and is only for test purposes.

        let mut mds = vec![vec![]; 3];
        for i in 0..3 {
            for _ in 0..3 {
                mds[i].push(Fr::rand(&mut test_rng));
            }
        }

        let mut ark = vec![vec![]; 8 + 24];
        for i in 0..8 + 24 {
            for _ in 0..3 {
                ark[i].push(Fr::rand(&mut test_rng));
            }
        }

        let mut test_a = Vec::new();
        let mut test_b = Vec::new();
        for _ in 0..3 {
            test_a.push(Fr::rand(&mut test_rng));
            test_b.push(Fr::rand(&mut test_rng));
        }

        let params = PoseidonConfig::<Fr>::new(8, 24, 31, mds, ark, 2, 1);
        let crh_a = PoseidonHash::<Fr>::evaluate(&params, test_a.clone()).unwrap();
        let crh_b = PoseidonHash::<Fr>::evaluate(&params, test_b.clone()).unwrap();
        let crh = TwoToOneCRH::<Fr>::compress(&params, crh_a, crh_b).unwrap();

        let t1 = Instant::now();
        let cs = ConstraintSystem::<Fr>::new_ref();

        let mut test_a_g = Vec::new();
        let mut test_b_g = Vec::new();

        for elem in test_a.iter() {
            test_a_g.push(FpVar::Var(
                AllocatedFp::<Fr>::new_witness(cs.clone(), || Ok(elem)).unwrap(),
            ));
        }
        for elem in test_b.iter() {
            test_b_g.push(FpVar::Var(
                AllocatedFp::<Fr>::new_witness(cs.clone(), || Ok(elem)).unwrap(),
            ));
        }

        let params_g = CRHParametersVar::<Fr>::new_witness(cs, || Ok(params)).unwrap();
        let crh_a_g = CRHGadget::<Fr>::evaluate(&params_g, &test_a_g).unwrap();
        let crh_b_g = CRHGadget::<Fr>::evaluate(&params_g, &test_b_g).unwrap();
        let crh_g = TwoToOneCRHGadget::<Fr>::compress(&params_g, &crh_a_g, &crh_b_g).unwrap();

        println!("{:?}", t1.elapsed());

        assert_eq!(crh_a, crh_a_g.value().unwrap());
        assert_eq!(crh_b, crh_b_g.value().unwrap());
        assert_eq!(crh, crh_g.value().unwrap());
    }

    #[test]
    fn test_n_to_one_consistency() {
        use crate::gadget::hashes::{
            NToOneCRHScheme,
            constraints::NToOneCRHSchemeGadget,
            poseidon::{
                NToOneCRH, arkworks_parameters::bn254::poseidon_parameter_bn254_8_to_1,
                constraints::NToOneCRHGadget,
            },
        };
        use ark_bn254::Fr;
        let mut rng = ark_std::test_rng();
        let params: PoseidonConfig<Fr> =
            poseidon_parameter_bn254_8_to_1::get_poseidon_parameters().into();

        let inputs = [
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
        ];

        // circuit 밖에서의 Poseidon 해시 결과
        let res_native = NToOneCRH::<8, Fr>::evaluate(&params, &inputs).unwrap();

        // circuit 안에서의 Poseidon 해시 결과
        let cs = ConstraintSystem::<Fr>::new_ref();
        let mut inputs_var = Vec::new();
        for input in &inputs {
            inputs_var.push(FpVar::new_witness(cs.clone(), || Ok(input)).unwrap());
        }
        let inputs_var: [FpVar<Fr>; 8] = inputs_var.try_into().unwrap();

        let params_var = CRHParametersVar::<Fr>::new_constant(cs.clone(), &params).unwrap();
        let res_var = NToOneCRHGadget::<8, Fr>::evaluate(&params_var, &inputs_var).unwrap();

        assert_eq!(res_native, res_var.value().unwrap());
        assert!(cs.is_satisfied().unwrap());
    }

    #[test]
    fn test_n_to_one_vs_two_to_one() {
        use crate::gadget::hashes::poseidon::arkworks_parameters::bn254::poseidon_parameter_bn254_2_to_1;

        let mut rng = ark_std::test_rng();
        let params = poseidon_parameter_bn254_2_to_1::get_poseidon_parameters();
        let config: PoseidonConfig<Fr> = params.into();

        let inputs = [Fr::rand(&mut rng), Fr::rand(&mut rng)];

        let cs = ConstraintSystem::<Fr>::new_ref();
        let inputs_var = [
            FpVar::new_witness(cs.clone(), || Ok(inputs[0])).unwrap(),
            FpVar::new_witness(cs.clone(), || Ok(inputs[1])).unwrap(),
        ];

        let params_g = CRHParametersVar::<Fr>::new_constant(cs.clone(), &config).unwrap();

        // 1. NToOneCRHGadget (N=2)
        let res_n = NToOneCRHGadget::<2, Fr>::evaluate(&params_g, &inputs_var).unwrap();

        // 2. TwoToOneCRHGadget
        let res_two =
            TwoToOneCRHGadget::<Fr>::evaluate(&params_g, &inputs_var[0], &inputs_var[1]).unwrap();

        assert_eq!(res_n.value().unwrap(), res_two.value().unwrap());
        assert!(cs.is_satisfied().unwrap());
    }

    #[test]
    fn test_n_to_one_constant_vs_witness() {
        use crate::gadget::hashes::poseidon::arkworks_parameters::bn254::poseidon_parameter_bn254_4_to_1;

        let mut rng = ark_std::test_rng();
        let params = poseidon_parameter_bn254_4_to_1::get_poseidon_parameters();
        let config: PoseidonConfig<Fr> = params.into();
        let inputs = [
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
            Fr::rand(&mut rng),
        ];

        let cs = ConstraintSystem::<Fr>::new_ref();
        let params_g = CRHParametersVar::<Fr>::new_constant(cs.clone(), &config).unwrap();

        // 1. 모든 입력을 Constant로 (cs.is_none() 분기)
        let inputs_const = [
            FpVar::new_constant(cs.clone(), inputs[0]).unwrap(),
            FpVar::new_constant(cs.clone(), inputs[1]).unwrap(),
            FpVar::new_constant(cs.clone(), inputs[2]).unwrap(),
            FpVar::new_constant(cs.clone(), inputs[3]).unwrap(),
        ];
        let res_const = NToOneCRHGadget::<4, Fr>::evaluate(&params_g, &inputs_const).unwrap();

        // 2. 모든 입력을 Witness로 (SpongeVar 분기)
        let inputs_witness = [
            FpVar::new_witness(cs.clone(), || Ok(inputs[0])).unwrap(),
            FpVar::new_witness(cs.clone(), || Ok(inputs[1])).unwrap(),
            FpVar::new_witness(cs.clone(), || Ok(inputs[2])).unwrap(),
            FpVar::new_witness(cs.clone(), || Ok(inputs[3])).unwrap(),
        ];
        let res_witness = NToOneCRHGadget::<4, Fr>::evaluate(&params_g, &inputs_witness).unwrap();

        assert_eq!(res_const.value().unwrap(), res_witness.value().unwrap());
        assert!(cs.is_satisfied().unwrap());
    }
}
