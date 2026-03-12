use crate::Error;
use ark_crypto_primitives::sponge::Absorb;
use ark_crypto_primitives::sponge::poseidon::PoseidonConfig;
use ark_ff::Field;
use std::marker::PhantomData;

use ark_serialize::{CanonicalDeserialize, CanonicalSerialize};

use super::SymmetricEncryption;
use crate::gadget::hashes::{CRHScheme, poseidon::PoseidonHash};

pub mod constraints;

#[derive(Clone, Default, Debug, PartialEq, CanonicalDeserialize, CanonicalSerialize)]
pub struct Randomness<F: Field> {
    pub r: F,
}

#[derive(Clone, Default, Debug, PartialEq)]
pub struct SymmetricKey<F: Field> {
    pub k: F,
}

#[derive(Clone, Default, Debug, PartialEq, CanonicalDeserialize, CanonicalSerialize)]
pub struct Ciphertext<F: Field> {
    pub r: F,
    pub c: F,
}

#[derive(Clone, Default, Debug, PartialEq, CanonicalDeserialize, CanonicalSerialize)]
pub struct Plaintext<F: Field> {
    pub m: F,
}

pub struct SymmetricEncryptionScheme<F: Field> {
    _field: PhantomData<F>,
}

impl<F> SymmetricEncryption for SymmetricEncryptionScheme<F>
where
    F: ark_ff::PrimeField + Absorb,
{
    type Parameters = PoseidonConfig<F>;

    type Randomness = Randomness<F>;
    type SymmetricKey = SymmetricKey<F>;
    type Ciphertext = Ciphertext<F>;
    type Plaintext = Plaintext<F>;

    fn keygen(_params: Self::Parameters) -> Result<Self::SymmetricKey, Error> {
        unimplemented!()
    }

    fn encrypt(
        params: Self::Parameters,
        r: Self::Randomness,
        k: Self::SymmetricKey,
        m: Self::Plaintext,
    ) -> Result<Self::Ciphertext, Error> {
        let hash_param = params;
        let r = r.r;
        let k = k.k;
        let m = m.m;

        let h = PoseidonHash::<F>::evaluate(&hash_param, [k, r].as_ref())?;
        let c = h + m;

        Ok(Ciphertext { r, c })
    }

    fn decrypt(
        params: Self::Parameters,
        k: Self::SymmetricKey,
        ct: Self::Ciphertext,
    ) -> Result<Self::Plaintext, Error> {
        let hash_param = params;
        let Ciphertext { r, c } = ct;
        let k = k.k;

        let h = PoseidonHash::<F>::evaluate(&hash_param, [k, r].as_ref())?;
        let m = c - h;

        Ok(Plaintext { m })
    }
}

#[cfg(test)]
mod tests {
    use ark_bn254::Fr;
    use ark_crypto_primitives::sponge::poseidon::PoseidonConfig;

    use crate::gadget::{
        hashes::poseidon::arkworks_parameters::bn254::poseidon_parameter_bn254_2_to_1,
        symmetric_encrytions::SymmetricEncryption,
    };

    use super::{Plaintext, Randomness, SymmetricEncryptionScheme, SymmetricKey};

    #[test]
    fn test_semmetic_encryption() {
        let hash_param: PoseidonConfig<Fr> =
            poseidon_parameter_bn254_2_to_1::get_poseidon_parameters().into();
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

        let m_dec = SymmetricEncryptionScheme::<Fr>::decrypt(hash_param, key, ct).unwrap();
        println!("m: {:?}", m_dec.m);
        assert_eq!(msg, m_dec);
    }
}
