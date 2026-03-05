use super::SymmetricEncryption;
use ark_ff::Field;
use ark_r1cs_std::prelude::AllocVar;
use ark_relations::r1cs::SynthesisError;

pub trait SymmetricEncryptionGadget<Enc: SymmetricEncryption, F: Field> {
    type ParametersVar;

    type RandomnessVar: AllocVar<Enc::Randomness, F> + Clone;
    type SymmetricKeyVar: AllocVar<Enc::SymmetricKey, F> + Clone;
    type CiphertextVar: AllocVar<Enc::Ciphertext, F> + Clone;
    type PlaintextVar: AllocVar<Enc::Plaintext, F> + Clone;

    fn encrypt(
        params: Self::ParametersVar,
        r: Self::RandomnessVar,
        k: Self::SymmetricKeyVar,
        m: Self::PlaintextVar,
    ) -> Result<Self::CiphertextVar, SynthesisError>;

    fn decrypt(
        params: Self::ParametersVar,
        k: Self::SymmetricKeyVar,
        ct: Self::CiphertextVar,
    ) -> Result<Self::PlaintextVar, SynthesisError>;
}
