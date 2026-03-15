use ark_ff::PrimeField;
use ark_r1cs_std::{
    fields::fp::FpVar,
    prelude::{AllocVar, AllocationMode, Boolean, EqGadget},
};
use ark_relations::r1cs::{Namespace, SynthesisError};
use std::marker::PhantomData;

use super::{Ciphertext, Plaintext, Randomness, SymmetricEncryptionScheme, SymmetricKey};
use crate::gadget::{
    hashes::{
        constraints::CRHSchemeGadget,
        poseidon2::constraints::{Poseidon2CRHGadget, Poseidon2ParametersVar},
    },
    symmetric_encrytions::constraints::SymmetricEncryptionGadget,
};

pub struct SymmetricEncryptionSchemeGadget<F: PrimeField> {
    _field: PhantomData<F>,
}

#[derive(Clone, Debug)]
pub struct RandomnessVar<F: PrimeField> {
    pub r: FpVar<F>,
}

impl<F> AllocVar<Randomness<F>, F> for RandomnessVar<F>
where
    F: PrimeField,
{
    fn new_variable<T: std::borrow::Borrow<Randomness<F>>>(
        cs: impl Into<Namespace<F>>,
        f: impl FnOnce() -> Result<T, ark_relations::r1cs::SynthesisError>,
        mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        let ns = cs.into();
        let cs = ns.cs();

        f().and_then(|param| {
            let Randomness { r } = param.borrow().clone();

            let r = FpVar::new_variable(cs.clone(), || Ok(r), mode)?;

            Ok(Self { r })
        })
    }
}

#[derive(Clone, Debug)]
pub struct SymmetricKeyVar<F: PrimeField> {
    pub k: FpVar<F>,
}

impl<F> AllocVar<SymmetricKey<F>, F> for SymmetricKeyVar<F>
where
    F: PrimeField,
{
    fn new_variable<T: std::borrow::Borrow<SymmetricKey<F>>>(
        cs: impl Into<Namespace<F>>,
        f: impl FnOnce() -> Result<T, ark_relations::r1cs::SynthesisError>,
        mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        let ns = cs.into();
        let cs = ns.cs();

        f().and_then(|param| {
            let SymmetricKey { k } = param.borrow().clone();

            let k = FpVar::new_variable(cs.clone(), || Ok(k), mode)?;

            Ok(Self { k })
        })
    }
}

#[derive(Clone, Debug)]
pub struct CiphertextVar<F: PrimeField> {
    pub r: FpVar<F>,
    pub c: FpVar<F>,
}

impl<F> EqGadget<F> for CiphertextVar<F>
where
    F: PrimeField,
{
    #[inline]
    fn is_eq(&self, other: &Self) -> Result<Boolean<F>, SynthesisError> {
        let r_eq = self.r.is_eq(&other.r)?;
        let c_eq = self.c.is_eq(&other.c)?;

        Ok(r_eq & c_eq)
    }
}

impl<F> AllocVar<Ciphertext<F>, F> for CiphertextVar<F>
where
    F: PrimeField,
{
    fn new_variable<T: std::borrow::Borrow<Ciphertext<F>>>(
        cs: impl Into<Namespace<F>>,
        f: impl FnOnce() -> Result<T, ark_relations::r1cs::SynthesisError>,
        mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        let ns = cs.into();
        let cs = ns.cs();

        f().and_then(|param| {
            let Ciphertext { r, c } = param.borrow().clone();

            let r = FpVar::new_variable(cs.clone(), || Ok(r), mode)?;
            let c = FpVar::new_variable(cs.clone(), || Ok(c), mode)?;

            Ok(Self { r, c })
        })
    }
}

#[derive(Clone, Debug)]
pub struct PlaintextVar<F: PrimeField> {
    pub m: FpVar<F>,
}

impl<F> AllocVar<Plaintext<F>, F> for PlaintextVar<F>
where
    F: PrimeField,
{
    fn new_variable<T: std::borrow::Borrow<Plaintext<F>>>(
        cs: impl Into<Namespace<F>>,
        f: impl FnOnce() -> Result<T, ark_relations::r1cs::SynthesisError>,
        mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        let ns = cs.into();
        let cs = ns.cs();

        f().and_then(|param| {
            let Plaintext { m } = param.borrow().clone();

            let m = FpVar::new_variable(cs.clone(), || Ok(m), mode)?;

            Ok(Self { m })
        })
    }
}

impl<F> SymmetricEncryptionGadget<SymmetricEncryptionScheme<F>, F>
    for SymmetricEncryptionSchemeGadget<F>
where
    F: PrimeField,
{
    type ParametersVar = Poseidon2ParametersVar<F>;

    type RandomnessVar = RandomnessVar<F>;
    type SymmetricKeyVar = SymmetricKeyVar<F>;
    type CiphertextVar = CiphertextVar<F>;
    type PlaintextVar = PlaintextVar<F>;

    fn encrypt(
        params: Self::ParametersVar,
        r: Self::RandomnessVar,
        k: Self::SymmetricKeyVar,
        m: Self::PlaintextVar,
    ) -> Result<Self::CiphertextVar, SynthesisError> {
        let r_var = r.r.clone();
        let k_var = k.k.clone();
        let m_var = m.m.clone();

        let h = Poseidon2CRHGadget::<F>::evaluate(&params, &[k_var, r_var.clone()])?;
        let c = h + m_var;

        Ok(CiphertextVar { r: r_var, c })
    }

    fn decrypt(
        params: Self::ParametersVar,
        k: Self::SymmetricKeyVar,
        ct: Self::CiphertextVar,
    ) -> Result<Self::PlaintextVar, SynthesisError> {
        let CiphertextVar { r, c } = ct;
        let k_var = k.k;

        let h = Poseidon2CRHGadget::<F>::evaluate(&params, &[k_var, r])?;
        let m = c - h;

        Ok(PlaintextVar { m })
    }
}

#[cfg(test)]
mod tests {
    use ark_bn254::Fr;
    use ark_r1cs_std::R1CSVar;
    use ark_r1cs_std::alloc::AllocVar;
    use ark_r1cs_std::eq::EqGadget;
    use ark_relations::r1cs::ConstraintSystem;

    use crate::gadget::{
        hashes::poseidon2::{
            instances::bn254::get_poseidon2_bn254_t2_params,
            constraints::Poseidon2ParametersVar,
        },
        symmetric_encrytions::{
            SymmetricEncryption, constraints::SymmetricEncryptionGadget,
            symmetric::constraints::SymmetricEncryptionSchemeGadget,
        },
    };

    use super::{Plaintext, Randomness, SymmetricEncryptionScheme, SymmetricKey};

    #[test]
    fn test_semmetic_encryption_gadget() {
        type MyEnc = SymmetricEncryptionScheme<Fr>;
        type MyGadget = SymmetricEncryptionSchemeGadget<Fr>;

        let hash_param = get_poseidon2_bn254_t2_params();
        let r: Fr = Fr::from(3u64);
        let k: Fr = Fr::from(3u64);
        let m: Fr = Fr::from(5u64);

        let random = Randomness { r };
        let key = SymmetricKey { k };
        let msg = Plaintext { m };

        let ct = SymmetricEncryptionScheme::<Fr>::encrypt(
            hash_param.clone(),
            random.clone(),
            key.clone(),
            msg.clone(),
        )
        .unwrap();
        println!("ct: {:?}", ct.c);

        let m_dec =
            SymmetricEncryptionScheme::<Fr>::decrypt(hash_param.clone(), key.clone(), ct.clone())
                .unwrap();
        println!("m: {:?}", m_dec.m);

        let cs = ConstraintSystem::<Fr>::new_ref();

        let randomness_var =
            <MyGadget as SymmetricEncryptionGadget<MyEnc, Fr>>::RandomnessVar::new_witness(
                ark_relations::ns!(cs, "gadget_randomness"),
                || Ok(&random),
            )
            .unwrap();

        let key_var =
            <MyGadget as SymmetricEncryptionGadget<MyEnc, Fr>>::SymmetricKeyVar::new_witness(
                ark_relations::ns!(cs, "gadget_randomness"),
                || Ok(&key),
            )
            .unwrap();

        let msg_var =
            <MyGadget as SymmetricEncryptionGadget<MyEnc, Fr>>::PlaintextVar::new_witness(
                ark_relations::ns!(cs, "gadget_randomness"),
                || Ok(&msg),
            )
            .unwrap();

        let param_var = Poseidon2ParametersVar::<Fr>::new_constant(
            ark_relations::ns!(cs, "gadget_const"),
            &hash_param,
        )
        .unwrap();
        let result_var = MyGadget::encrypt(param_var, randomness_var, key_var, msg_var).unwrap();

        let expected_var =
            <MyGadget as SymmetricEncryptionGadget<MyEnc, Fr>>::CiphertextVar::new_input(
                ark_relations::ns!(cs, "gadget_randomness"),
                || Ok(&ct),
            )
            .unwrap();

        println!("ct: {:?}", ct.c);
        println!("c: {:?}", expected_var.c.value().unwrap());
        println!("c:: {:?}", result_var.c.value().unwrap());

        expected_var.enforce_equal(&result_var).unwrap();

        assert_eq!(ct.c, result_var.c.value().unwrap());
        assert_eq!(ct.r, result_var.r.value().unwrap());

        assert!(cs.is_satisfied().unwrap());
    }
}
