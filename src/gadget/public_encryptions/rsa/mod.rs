use crate::Error;
use ark_ec::CurveGroup;
use ark_ff::PrimeField;
use ark_serialize::{CanonicalDeserialize, CanonicalSerialize};
use rand::SeedableRng;
use rsa::{Oaep, RsaPrivateKey, RsaPublicKey};
use std::{cmp::min, marker::PhantomData};

use crate::gadget::public_encryptions::AsymmetricEncryptionScheme;

// RSA2048 OAEP with SHA-256
// RSA 암호문의 크기는 2048 bit -> 서킷에서의 사용을 위해 Vec<C::BaseField>로 표현
pub struct Rsa2048Encryption<C> {
    _group: PhantomData<C>,
}

impl<C: CurveGroup> AsymmetricEncryptionScheme for Rsa2048Encryption<C>
where
    C::BaseField: PrimeField,
{
    type Parameters = usize;
    type PublicKey = RsaPublicKey;
    type SecretKey = RsaPrivateKey;
    type Randomness = ();
    type Plaintext = Vec<u8>;
    type Ciphertext = Vec<C::BaseField>;

    fn setup<R: rand::Rng>(_rng: &mut R) -> Result<Self::Parameters, Error> {
        Ok(2048)
    }

    fn keygen<R: rand::Rng>(
        pp: &Self::Parameters,
        rng: &mut R,
    ) -> Result<(Self::PublicKey, Self::SecretKey), Error> {
        let mut rng = rand::rngs::StdRng::from_rng(rng)?;
        let sk = RsaPrivateKey::new(&mut rng, *pp)?;
        let pk = RsaPublicKey::from(&sk);
        Ok((pk, sk))
    }

    /// 2048 bit RSA-OAEP 암호화 후 Vec<BaseField>로 표현
    /// - 각 chunk의 크기는 BaseField의 bit 크기에 따라 결정
    fn encrypt(
        _pp: &Self::Parameters,
        pk: &Self::PublicKey,
        message: &Self::Plaintext,
        _r: &Self::Randomness,
    ) -> Result<Self::Ciphertext, crate::Error> {
        let mut rng = rand::thread_rng();
        let padding = Oaep::new::<sha2::Sha256>();
        let encrypted_bytes = pk.encrypt(&mut rng, padding, message)?;

        // from_le_bytes_mod_order에서 데이터 손실을 막기 위한 chunk 크기
        let chunk_size_in_bytes = ((C::BaseField::MODULUS_BIT_SIZE - 1) / 8) as usize;
        let field_byte_len = (C::BaseField::MODULUS_BIT_SIZE as usize + 7) / 8;
        let mut chunks: Vec<C::BaseField> = Vec::new();

        // 청크를 BaseField로 변환
        for chunk in encrypted_bytes.chunks(chunk_size_in_bytes) {
            let mut padded_chunk = vec![0u8; field_byte_len];
            padded_chunk[..chunk.len()].copy_from_slice(chunk);
            let field_element =
                C::BaseField::deserialize_uncompressed(padded_chunk.as_slice()).unwrap();
            chunks.push(field_element);
        }

        Ok(chunks)
    }

    /// Vec<BaseField>로 표현된 암호문을 바이트 배열로 복호화
    fn decrypt(
        pp: &Self::Parameters,
        sk: &Self::SecretKey,
        ciphertext: &Self::Ciphertext,
    ) -> Result<Self::Plaintext, Error> {
        // RSA-2048이므로 암호문은 2048 bits = 256 bytes
        let expected_len = *pp / 8;
        // from_le_bytes_mod_order에서 데이터 손실을 막기 위한 chunk 크기
        let chunk_size_in_bytes = ((C::BaseField::MODULUS_BIT_SIZE - 1) / 8) as usize;
        // BaseField를 직렬화한 바이트 길이
        let field_byte_len = (C::BaseField::MODULUS_BIT_SIZE as usize + 7) / 8;

        let mut ciphertext_bytes = Vec::with_capacity(expected_len);

        // Vec<BaseField>를 바이트 배열로 변환
        for chunk in ciphertext {
            // 각 BaseField chunk를 바이트로 변환
            let mut padded_chunk_bytes = Vec::with_capacity(field_byte_len);
            chunk.serialize_uncompressed(&mut padded_chunk_bytes)?;

            let bytes_remaining = expected_len - ciphertext_bytes.len();
            if bytes_remaining == 0 {
                break;
            }

            // 마지막 청크의 경우 chunk_size_in_bytes보다 작을 수 있으므로
            // 남은 바이트와 청크 크기 중 작은 값을 선택
            let bytes_to_take = min(bytes_remaining, chunk_size_in_bytes);

            ciphertext_bytes.extend_from_slice(&padded_chunk_bytes[..bytes_to_take]);
        }

        let padding = Oaep::new::<sha2::Sha256>();
        let decrypted_bytes = sk.decrypt(padding, &ciphertext_bytes)?;

        Ok(decrypted_bytes)
    }
}

#[cfg(test)]
mod tests {
    use crate::gadget::public_encryptions::{rsa::Rsa2048Encryption, AsymmetricEncryptionScheme};
    use ark_ed_on_bls12_381::EdwardsProjective as TestCurve2;
    use ark_ed_on_bn254::EdwardsProjective as TestCurve1;
    use rand::{thread_rng, RngCore};

    #[test]
    fn test_rsa_encryption_correctness_bn254() {
        let mut rng = thread_rng();
        let pp = Rsa2048Encryption::<TestCurve1>::setup(&mut rng).unwrap();
        let (pk, sk) = Rsa2048Encryption::<TestCurve1>::keygen(&pp, &mut rng).unwrap();
        for _ in 0..10 {
            let mut message = vec![0u8; 128];
            rng.try_fill_bytes(&mut message).unwrap();
            let ciphertext =
                Rsa2048Encryption::<TestCurve1>::encrypt(&pp, &pk, &message, &()).unwrap();
            let decrypted =
                Rsa2048Encryption::<TestCurve1>::decrypt(&pp, &sk, &ciphertext).unwrap();
            assert_eq!(message, decrypted);
        }
    }

    #[test]
    fn test_rsa_encryption_correctness_bls12_381() {
        let mut rng = thread_rng();
        let pp = Rsa2048Encryption::<TestCurve2>::setup(&mut rng).unwrap();
        let (pk, sk) = Rsa2048Encryption::<TestCurve2>::keygen(&pp, &mut rng).unwrap();
        for _ in 0..10 {
            let mut message = vec![0u8; 128];
            rng.try_fill_bytes(&mut message).unwrap();
            let ciphertext =
                Rsa2048Encryption::<TestCurve2>::encrypt(&pp, &pk, &message, &()).unwrap();
            let decrypted =
                Rsa2048Encryption::<TestCurve2>::decrypt(&pp, &sk, &ciphertext).unwrap();
            assert_eq!(message, decrypted);
        }
    }
}
