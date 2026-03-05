use crate::Error;
use ark_crypto_primitives::sponge::Absorb;
use ark_ff::Field;
use std::marker::PhantomData;

use ark_serialize::{CanonicalDeserialize, CanonicalSerialize};

use super::SymmetricEncryption;
use crate::gadget::hashes::{
    mimc7::{self, Parameters},
    CRHScheme,
};

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
    F: Field + Absorb,
{
    type Parameters = Parameters<F>;

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
        let rc = params.clone();
        let r = r.r;
        let k = k.k;
        let m = m.m;

        let h = mimc7::MiMC::<F>::evaluate(&rc, [k, r].to_vec())?;
        let c = h + m;

        Ok(Ciphertext { r, c })
    }

    fn decrypt(
        params: Self::Parameters,
        k: Self::SymmetricKey,
        ct: Self::Ciphertext,
    ) -> Result<Self::Plaintext, Error> {
        let rc = params.clone();
        let Ciphertext { r, c } = ct.clone();
        let k = k.k;

        let h = mimc7::MiMC::<F>::evaluate(&rc, [k, r].to_vec())?;
        let m = c - h;

        Ok(Plaintext { m })
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use ark_bn254::Fr;
    use ark_ff::Fp;

    use crate::gadget::{
        hashes::mimc7::{parameters, Parameters},
        symmetric_encrytions::SymmetricEncryption,
    };

    use super::{Plaintext, Randomness, SymmetricEncryptionScheme, SymmetricKey};

    #[test]
    fn test_semmetic_encryption() {
        let rc = Parameters {
            round_constants: parameters::get_bn256_round_constants().clone(),
        };
        let r: Fr = Fp::from_str("3").unwrap();
        let k: Fr = Fp::from_str("3").unwrap();
        let m: Fr = Fp::from_str("5").unwrap();

        let random = Randomness { r };
        let key = SymmetricKey { k };
        let msg = Plaintext { m };

        let ct = SymmetricEncryptionScheme::<Fr>::encrypt(
            rc.clone(),
            random.clone(),
            key.clone(),
            msg.clone(),
        )
        .unwrap();

        println!("ct: {:?}", ct.c);

        let m_dec = SymmetricEncryptionScheme::<Fr>::decrypt(rc, key, ct).unwrap();
        println!("m: {:?}", m_dec.m);
    }
}
