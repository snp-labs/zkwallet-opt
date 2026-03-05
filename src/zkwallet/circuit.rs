use crate::gadget::hashes;
use crate::gadget::hashes::constraints::CRHSchemeGadget;
use crate::gadget::hashes::mimc7;
use crate::gadget::hashes::mimc7::constraints::MiMCGadget;
use crate::Error;
use std::ops::Not;

use crate::gadget::symmetric_encrytions::constraints::SymmetricEncryptionGadget;
use crate::gadget::symmetric_encrytions::symmetric;
use crate::gadget::symmetric_encrytions::symmetric::constraints::SymmetricEncryptionSchemeGadget;

use crate::gadget::public_encryptions::elgamal;
use crate::gadget::public_encryptions::elgamal::constraints::ElGamalEncGadget;
use crate::gadget::public_encryptions::AsymmetricEncryptionGadget;

use crate::gadget::merkle_tree;
use crate::gadget::merkle_tree::{constraints::ConfigGadget, Config, IdentityDigestConverter};

use ark_crypto_primitives::sponge::Absorb;
use ark_ec::CurveGroup;
use ark_ff::{Field, PrimeField};
use ark_r1cs_std::prelude::*;
use ark_r1cs_std::{fields::fp::FpVar, prelude::AllocVar};
use ark_relations::r1cs::{ConstraintSynthesizer, SynthesisError};
use ark_std::marker::PhantomData;

use super::MockingCircuit;

pub type ConstraintF<C> = <<C as CurveGroup>::BaseField as Field>::BasePrimeField;
#[allow(non_snake_case)]
#[derive(Clone)]
pub struct ZkWalletCircuit<C: CurveGroup, GG: CurveVar<C, ConstraintF<C>>>
where
    <C as CurveGroup>::BaseField: PrimeField + Absorb,
{
    // constant
    pub rc: mimc7::Parameters<C::BaseField>, // round_constants
    pub G: elgamal::Parameters<C>,

    // statement
    pub apk: Option<elgamal::PublicKey<C>>,
    pub cin: Option<Vec<C::BaseField>>, // tk_addr_ena_old, tk_id_ena_old, v_in_old
    pub rt: Option<C::BaseField>,
    pub sn: Option<C::BaseField>,
    pub addr: Option<C::BaseField>,         // ena_send
    pub k_b: Option<C::BaseField>,          // pk_own_send
    pub k_u: Option<elgamal::PublicKey<C>>, // pk_enc_send
    pub cm_: Option<C::BaseField>,
    pub cout: Option<Vec<C::BaseField>>, // tk_addr_ena_new, tk_id_ena_new, v_in_new
    pub pv: Option<C::BaseField>,
    pub pv_: Option<C::BaseField>,
    pub tk_addr_: Option<C::BaseField>,
    pub tk_id_: Option<C::BaseField>,
    pub G_r: Option<C::Affine>,
    pub K_u: Option<C::Affine>,
    pub K_a: Option<C::Affine>,
    pub CT: Option<Vec<C::BaseField>>,

    // witnesses
    pub sk: Option<symmetric::SymmetricKey<C::BaseField>>,
    pub cm: Option<C::BaseField>,
    pub du: Option<C::BaseField>,
    pub dv: Option<C::BaseField>,
    pub tk_addr: Option<C::BaseField>,
    pub tk_id: Option<C::BaseField>,
    pub addr_r: Option<C::BaseField>,        // ena_recv
    pub k_b_: Option<C::BaseField>,          // pk_own_recv
    pub k_u_: Option<elgamal::PublicKey<C>>, // pk_enc_recv
    pub du_: Option<C::BaseField>,
    pub dv_: Option<C::BaseField>,
    pub r: Option<elgamal::Randomness<C>>,
    pub k: Option<elgamal::Plaintext<C>>,
    pub k_point_x: Option<symmetric::SymmetricKey<C::BaseField>>,
    pub leaf_pos: Option<u32>,
    pub tree_proof: Option<merkle_tree::Path<FieldMTConfig<C::BaseField>>>,
    // directionSelector
    // intermediateHashWires
    pub _curve_var: PhantomData<GG>,
}

pub struct FieldMTConfig<F: PrimeField> {
    _field: PhantomData<F>,
}
impl<F: PrimeField + Absorb> Config for FieldMTConfig<F> {
    type Leaf = [F];
    type LeafDigest = F;
    type LeafInnerDigestConverter = IdentityDigestConverter<F>;
    type InnerDigest = F;
    type LeafHash = mimc7::MiMC<F>;
    type TwoToOneHash = mimc7::TwoToOneMiMC<F>;
}

struct FieldMTConfigVar<F: PrimeField> {
    _field: PhantomData<F>,
}
impl<F> ConfigGadget<FieldMTConfig<F>, F> for FieldMTConfigVar<F>
where
    F: PrimeField + Absorb,
{
    type Leaf = [FpVar<F>];
    type LeafDigest = FpVar<F>;
    type LeafInnerConverter = IdentityDigestConverter<FpVar<F>>;
    type InnerDigest = FpVar<F>;
    type LeafHash = mimc7::constraints::MiMCGadget<F>;
    type TwoToOneHash = mimc7::constraints::TwoToOneMiMCGadget<F>;
}

#[allow(non_snake_case)]
impl<C, GG> ConstraintSynthesizer<C::BaseField> for ZkWalletCircuit<C, GG>
where
    C: CurveGroup,
    GG: CurveVar<C, C::BaseField>,
    <C as CurveGroup>::BaseField: PrimeField + Absorb,
    for<'a> &'a GG: GroupOpsBounds<'a, C, GG>,
{
    fn generate_constraints(
        self,
        cs: ark_relations::r1cs::ConstraintSystemRef<C::BaseField>,
    ) -> Result<(), SynthesisError> {
        // constants
        let rc = hashes::mimc7::constraints::ParametersVar::new_constant(
            ark_relations::ns!(cs, "round constants"),
            self.rc,
        )?;
        let G = elgamal::constraints::ParametersVar::new_constant(
            ark_relations::ns!(cs, "generator"),
            self.G,
        )?;

        // statement
        let apk =
            elgamal::constraints::PublicKeyVar::new_input(ark_relations::ns!(cs, "apk"), || {
                self.apk.ok_or(SynthesisError::AssignmentMissing)
            })?;

        let cin: Vec<FpVar<C::BaseField>> = Vec::new_input(ark_relations::ns!(cs, "cin"), || {
            self.cin.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let cin = [
            symmetric::constraints::CiphertextVar {
                r: cin[0].clone(),
                c: cin[1].clone(),
            },
            symmetric::constraints::CiphertextVar {
                r: cin[0].clone() + FpVar::one(),
                c: cin[2].clone(),
            },
            symmetric::constraints::CiphertextVar {
                r: cin[0].clone() + FpVar::one() + FpVar::one(),
                c: cin[3].clone(),
            },
        ];
        let rt = FpVar::new_input(cs.clone(), || {
            self.rt.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let sn = FpVar::new_input(ark_relations::ns!(cs, "sn"), || {
            self.sn.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let addr = FpVar::new_input(ark_relations::ns!(cs, "addr"), || {
            self.addr.ok_or(SynthesisError::AssignmentMissing)
        })?; // ena_send
        let k_b = FpVar::new_input(ark_relations::ns!(cs, "k_b"), || {
            self.k_b.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let k_u =
            elgamal::constraints::PublicKeyVar::new_input(ark_relations::ns!(cs, "k_u"), || {
                self.k_u.ok_or(SynthesisError::AssignmentMissing)
            })?;
        let cm_ = FpVar::new_input(ark_relations::ns!(cs, "cm_"), || {
            self.cm_.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let cout: Vec<FpVar<C::BaseField>> =
            Vec::new_input(ark_relations::ns!(cs, "cout"), || {
                self.cout.ok_or(SynthesisError::AssignmentMissing)
            })?;
        let cout = [
            symmetric::constraints::CiphertextVar {
                r: cout[0].clone(),
                c: cout[1].clone(),
            },
            symmetric::constraints::CiphertextVar {
                r: cout[0].clone() + FpVar::one(),
                c: cout[2].clone(),
            },
            symmetric::constraints::CiphertextVar {
                r: cout[0].clone() + FpVar::one() + FpVar::one(),
                c: cout[3].clone(),
            },
        ];
        let pv = FpVar::new_input(ark_relations::ns!(cs, "pv"), || {
            self.pv.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let pv_ = FpVar::new_input(ark_relations::ns!(cs, "pv_"), || {
            self.pv_.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let tk_addr_ = FpVar::new_input(ark_relations::ns!(cs, "tk_addr_"), || {
            self.tk_addr_.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let tk_id_ = FpVar::new_input(ark_relations::ns!(cs, "tk_id_"), || {
            self.tk_id_.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let K_u = elgamal::constraints::OutputVar::new_input(ark_relations::ns!(cs, "K_u"), || {
            Ok((self.G_r.unwrap(), self.K_u.unwrap()))
        })
        .unwrap();
        let K_a = GG::new_input(ark_relations::ns!(cs, "K_a"), || {
            self.K_a.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let K_a = elgamal::constraints::OutputVar {
            c1: K_u.clone().c1,
            c2: K_a,
            _curve: PhantomData,
        };
        let CT: Vec<FpVar<C::BaseField>> = Vec::new_input(ark_relations::ns!(cs, "CT"), || {
            self.CT.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let CT = [
            symmetric::constraints::CiphertextVar {
                c: CT[0].clone(),
                r: FpVar::zero(),
            },
            symmetric::constraints::CiphertextVar {
                c: CT[1].clone(),
                r: FpVar::one(),
            },
            symmetric::constraints::CiphertextVar {
                c: CT[2].clone(),
                r: FpVar::one() + FpVar::one(),
            },
            symmetric::constraints::CiphertextVar {
                c: CT[3].clone(),
                r: FpVar::one() + FpVar::one() + FpVar::one(),
            },
            symmetric::constraints::CiphertextVar {
                c: CT[4].clone(),
                r: FpVar::one() + FpVar::one() + FpVar::one() + FpVar::one(),
            },
        ];

        // witness
        let sk = symmetric::constraints::SymmetricKeyVar::new_witness(
            ark_relations::ns!(cs, "sk"),
            || self.sk.ok_or(SynthesisError::AssignmentMissing),
        )?;
        let cm = FpVar::new_witness(ark_relations::ns!(cs, "cm"), || Ok(self.cm.unwrap())).unwrap();
        let du = FpVar::new_witness(ark_relations::ns!(cs, "du"), || Ok(self.du.unwrap())).unwrap();
        let dv = FpVar::new_witness(ark_relations::ns!(cs, "dv"), || Ok(self.dv.unwrap())).unwrap();
        let tk_addr = FpVar::new_witness(ark_relations::ns!(cs, "tk_addr"), || {
            Ok(self.tk_addr.unwrap())
        })
        .unwrap();
        let tk_id = FpVar::new_witness(ark_relations::ns!(cs, "tk_id"), || Ok(self.tk_id.unwrap()))
            .unwrap();
        let addr_r = FpVar::new_witness(ark_relations::ns!(cs, "addr_r"), || {
            Ok(self.addr_r.unwrap())
        })
        .unwrap();
        let k_b_ =
            FpVar::new_witness(ark_relations::ns!(cs, "k_b_"), || Ok(self.k_b_.unwrap())).unwrap();
        let k_u_ = elgamal::constraints::PublicKeyVar::new_witness(
            ark_relations::ns!(cs, "k_u_"),
            || self.k_u_.ok_or(SynthesisError::AssignmentMissing),
        )?;
        let du_ =
            FpVar::new_witness(ark_relations::ns!(cs, "du_"), || Ok(self.du_.unwrap())).unwrap();
        let dv_ =
            FpVar::new_witness(ark_relations::ns!(cs, "dv_"), || Ok(self.dv_.unwrap())).unwrap();
        let r =
            elgamal::constraints::RandomnessVar::new_witness(ark_relations::ns!(cs, "r"), || {
                self.r.ok_or(SynthesisError::AssignmentMissing)
            })?;
        let k: elgamal::constraints::PlaintextVar<C, GG> =
            elgamal::constraints::PlaintextVar::new_witness(ark_relations::ns!(cs, "k"), || {
                self.k.ok_or(SynthesisError::AssignmentMissing)
            })?;
        let k_point_x = symmetric::constraints::SymmetricKeyVar::new_witness(
            ark_relations::ns!(cs, "k_point_x"),
            || self.k_point_x.ok_or(SynthesisError::AssignmentMissing),
        )?;
        let mut cw = merkle_tree::constraints::PathVar::<
            FieldMTConfig<C::BaseField>,
            C::BaseField,
            FieldMTConfigVar<C::BaseField>,
        >::new_witness(ark_relations::ns!(cs, "cw"), || {
            self.tree_proof.ok_or(SynthesisError::AssignmentMissing)
        })?;
        let leaf_pos = UInt32::new_witness(ark_relations::ns!(cs, "leaf_pos"), || {
            self.leaf_pos.ok_or(SynthesisError::AssignmentMissing)
        })?
        .to_bits_le();
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // check k == g(k_point_x, _k_point_y)
        let check_g_k_point_x = k.plaintext.to_bits_le()?;
        let check_g_k_point_x =
            Boolean::le_bits_to_fp(&check_g_k_point_x[..check_g_k_point_x.len() / 2])?;
        check_g_k_point_x.enforce_equal(&k_point_x.k)?;
        /////////////////////////////////////////////////////////////////

        // (k_send_ena, sk_send_own, sk_send_enc) <- usk_send
        // (addr_send, pk_send_own, pk_send_enc) <- upk_send
        // (addr_recv, pk_recv_own, pk_recv_enc) <- upk_recv

        /////////////////////////////////////////////////////////////////
        // pk_send_own <- H(sk_send_own)
        let pk_own_send =
            MiMCGadget::<C::BaseField>::evaluate(&rc, [sk.k.clone()].as_ref()).unwrap();
        k_b.enforce_equal(&pk_own_send)?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // addr_send <- H(pk_send_own || pk_send_enc)
        let binding = k_u.clone().pk.to_bits_le()?;
        let pk_enc_send_point_x = Boolean::le_bits_to_fp(&binding[..binding.len() / 2])?;
        let pk_enc_send_point_y = Boolean::le_bits_to_fp(&binding[binding.len() / 2..])?;

        let hash_input = [k_b, pk_enc_send_point_x, pk_enc_send_point_y].to_vec();
        let result_addr_send = MiMCGadget::<C::BaseField>::evaluate(&rc, &hash_input).unwrap();
        result_addr_send.enforce_equal(&addr)?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // cm_old <- commit(token_addr_w, token_id_w, v_priv_in, addr_send, o_old)
        let hash_input = [
            du.clone(),
            tk_addr.clone(),
            tk_id.clone(),
            dv.clone(),
            result_addr_send,
        ]
        .to_vec();
        let result_cm = MiMCGadget::<C::BaseField>::evaluate(&rc, &hash_input).unwrap();
        cm.enforce_equal(&result_cm).unwrap();
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // nf <- H(sk_send_own || cm_old)
        let hash_input = [cm.clone(), sk.clone().k].to_vec();
        let result_sn = MiMCGadget::<C::BaseField>::evaluate(&rc, &hash_input).unwrap();
        sn.enforce_equal(&result_sn)?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // if v_priv_in > 0 then
        //   MembershipTest(rt ,cm_old, path)
        // end if

        // Allocate Leaf
        let leaf_g: Vec<_> = vec![cm];

        cw.set_leaf_position(leaf_pos?);

        let path_check = cw.verify_membership(&rc.clone(), &rc.clone(), &rt, &leaf_g)?;

        // if dv == 0 then do not check merkle tree
        let check_dv = dv.is_zero()?;

        (path_check | check_dv).enforce_equal(&Boolean::constant(true))?;

        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // (pct_new, aux_new) <- public_encryption.enc(pk_recv_enc, apk, (o_new, token_addr_w, token_id_w, v_priv_out, addr_recv))
        let result_K_u =
            ElGamalEncGadget::<C, GG>::encrypt(&G.clone(), &k.clone(), &r, &k_u_).unwrap();
        let result_K_a =
            ElGamalEncGadget::<C, GG>::encrypt(&G.clone(), &k.clone(), &r, &apk).unwrap();
        K_u.enforce_equal(&result_K_u)?;
        K_a.enforce_equal(&result_K_a)?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // check CT
        let plain: Vec<FpVar<C::BaseField>> = vec![
            du_.clone(),
            tk_addr.clone(),
            tk_id.clone(),
            dv_.clone(),
            addr_r.clone(),
        ];

        for (i, m) in plain.iter().enumerate() {
            let randomness = symmetric::constraints::RandomnessVar::new_constant(
                ark_relations::ns!(cs, "randomness"),
                symmetric::Randomness {
                    r: C::BaseField::from_bigint((i as u64).into()).unwrap(),
                },
            )?;

            let c = SymmetricEncryptionSchemeGadget::<C::BaseField>::encrypt(
                rc.clone(),
                randomness,
                k_point_x.clone(),
                symmetric::constraints::PlaintextVar { m: m.clone() },
            )
            .unwrap();

            c.enforce_equal(&CT[i])?;
        }
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // addr_recv <- H(pk_recv_own || pk_recv_enc)
        let binding = k_u_.clone().pk.to_bits_le()?;
        let pk_enc_recv_point_x = Boolean::le_bits_to_fp(&binding[..binding.len() / 2])?;
        let pk_enc_recv_point_y = Boolean::le_bits_to_fp(&binding[binding.len() / 2..])?;

        let hash_input = vec![k_b_, pk_enc_recv_point_x, pk_enc_recv_point_y];
        let result_addr_recv = MiMCGadget::<C::BaseField>::evaluate(&rc, &hash_input).unwrap();
        result_addr_recv.enforce_equal(&addr_r)?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // cm_new <- commit(token_addr_w, token_id_w, v_priv_out, addr_recv, o_new)
        let hash_input = vec![
            du_.clone(),
            tk_addr.clone(),
            tk_id.clone(),
            dv_.clone(),
            addr_r.clone(),
        ];
        let result_cm_ = MiMCGadget::<C::BaseField>::evaluate(&rc, &hash_input).unwrap();
        cm_.enforce_equal(&result_cm_)?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // check ena
        // if sct_old == (0, 0, 0) then
        //   v_ena_old <- 0
        // else
        //   (token_addr_w, token_id_w, v_ena_old) <- symmetric_ecryption.dec(k_send_ena, sct_old)
        // end if
        // (token_addr_w, token_id_w, v_ena_new) <- symmetric_ecryption.dec(k_send_ena, sct_new)
        // v_ena_new = v_ena_old + v_priv_in - v_priv_out + v_pub_in - v_pub_out
        let result_tk_addr_ena_old = SymmetricEncryptionSchemeGadget::<C::BaseField>::decrypt(
            rc.clone(),
            sk.clone(),
            cin[0].clone(),
        )
        .unwrap();
        let result_tk_id_ena_old = SymmetricEncryptionSchemeGadget::<C::BaseField>::decrypt(
            rc.clone(),
            sk.clone(),
            cin[1].clone(),
        )
        .unwrap();
        let result_v_in_ena_old = SymmetricEncryptionSchemeGadget::<C::BaseField>::decrypt(
            rc.clone(),
            sk.clone(),
            cin[2].clone(),
        )
        .unwrap();

        let result_tk_addr_ena_new = SymmetricEncryptionSchemeGadget::<C::BaseField>::decrypt(
            rc.clone(),
            sk.clone(),
            cout[0].clone(),
        )
        .unwrap();
        let result_tk_id_ena_new = SymmetricEncryptionSchemeGadget::<C::BaseField>::decrypt(
            rc.clone(),
            sk.clone(),
            cout[1].clone(),
        )
        .unwrap();
        let result_v_out_ena_new = SymmetricEncryptionSchemeGadget::<C::BaseField>::decrypt(
            rc.clone(),
            sk.clone(),
            cout[2].clone(),
        )
        .unwrap();

        // if cin != 0 then is_cin = 1, is_cin_bool = true
        // if cin == 0 then is_cin = 0, is_cin_bool = false
        let is_cin = FpVar::from(
            (cin[0].clone().c + cin[1].clone().c + cin[2].clone().c + cin[0].clone().r)
                .is_zero()?
                .not(),
        );
        let is_cin_bool = is_cin.clone().is_one()?;

        tk_addr.conditional_enforce_equal(&result_tk_addr_ena_old.m, &is_cin_bool)?;
        tk_addr.enforce_equal(&result_tk_addr_ena_new.m)?;

        tk_id.conditional_enforce_equal(&result_tk_id_ena_old.m, &is_cin_bool)?;
        tk_id.enforce_equal(&result_tk_id_ena_new.m)?;

        let v_eval = (result_v_in_ena_old.clone().m * is_cin.clone()) + dv.clone() - dv_.clone()
            + pv.clone()
            - pv_.clone();
        v_eval.enforce_equal(&result_v_out_ena_new.m)?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // if v_pub_in > 0 or v_pub_out > 0 then
        //   (token_addr_w = token_addr_x) and (token_id_w = token_id_x)
        // end if
        let is_pv_zero = (pv.clone() + pv_.clone()).is_zero()?;
        let check_tk_id = tk_id.is_eq(&tk_id_)?;
        let check_tk_addr = tk_addr.is_eq(&tk_addr_)?;

        (check_tk_id & check_tk_addr)
            .conditional_enforce_equal(&Boolean::TRUE, &is_pv_zero.not())?;
        /////////////////////////////////////////////////////////////////

        /////////////////////////////////////////////////////////////////
        // pv pv_ dv dv_ range check
        let MODULUS_MINUS_ONE_DIV_TWO =
            C::BaseField::from_bigint(C::BaseField::MODULUS_MINUS_ONE_DIV_TWO).unwrap();
        let MODULUS_MINUS_ONE_DIV_TWO_DIV_TWO =
            MODULUS_MINUS_ONE_DIV_TWO / C::BaseField::from_bigint(2_u64.into()).unwrap();
        let check_range = FpVar::new_constant(
            ark_relations::ns!(cs, "MODULUS_MINUS_ONE_DIV_TWO_DIV_TWO"),
            MODULUS_MINUS_ONE_DIV_TWO_DIV_TWO,
        )?;

        (result_v_in_ena_old.m * is_cin).enforce_cmp_unchecked(
            &check_range.clone(),
            std::cmp::Ordering::Less,
            false,
        )?;
        pv.enforce_cmp_unchecked(&check_range.clone(), std::cmp::Ordering::Less, false)?;
        pv_.enforce_cmp_unchecked(&check_range.clone(), std::cmp::Ordering::Less, false)?;
        dv.enforce_cmp_unchecked(&check_range.clone(), std::cmp::Ordering::Less, false)?;
        dv_.enforce_cmp_unchecked(&check_range, std::cmp::Ordering::Less, false)?;
        /////////////////////////////////////////////////////////////////

        Ok(())
    }
}

#[allow(non_snake_case)]
impl<C, GG> MockingCircuit<C, GG> for ZkWalletCircuit<C, GG>
where
    C: CurveGroup,
    GG: CurveVar<C, C::BaseField>,
    <C as CurveGroup>::BaseField: PrimeField + Absorb,
    for<'a> &'a GG: GroupOpsBounds<'a, C, GG>,
{
    type F = C::BaseField;
    type HashParam = mimc7::Parameters<Self::F>;
    type H = mimc7::MiMC<Self::F>;
    type Output = ZkWalletCircuit<C, GG>;

    fn generate_circuit<R: ark_std::rand::Rng>(
        round_constants: Self::HashParam,
        tree_height: u64,
        rng: &mut R,
    ) -> Result<Self::Output, Error> {
        use crate::gadget::hashes::CRHScheme;
        use crate::gadget::merkle_tree::mocking::MockingMerkleTree;
        use crate::gadget::public_encryptions::elgamal::ElGamal;
        use crate::gadget::public_encryptions::AsymmetricEncryptionScheme;
        use crate::gadget::symmetric_encrytions::SymmetricEncryption;

        use ark_ec::AffineRepr;
        use ark_std::One;
        use ark_std::UniformRand;

        let generator = C::generator().into_affine();
        let rc = round_constants;
        let elgamal_param: elgamal::Parameters<C> = elgamal::Parameters { generator };

        let (apk, _) = ElGamal::keygen(&elgamal_param, rng).unwrap();
        let (k_u, _) = ElGamal::keygen(&elgamal_param, rng).unwrap();
        let (k_u_, _) = ElGamal::keygen(&elgamal_param, rng).unwrap();

        let cin_r = Self::F::rand(rng);

        let r = C::ScalarField::rand(rng);
        let sk = Self::F::rand(rng);
        let k = C::rand(rng).into_affine();
        let du = Self::F::rand(rng);
        let du_ = Self::F::rand(rng);

        let pv: Self::F = Self::F::one();
        let pv_: Self::F = Self::F::one();
        let dv: Self::F = Self::F::one();
        let dv_: Self::F = Self::F::one();

        let v_ena_old: Self::F = Self::F::one();
        let v_ena_new: Self::F = Self::F::one();

        let tk_addr: Self::F = Self::F::one();
        let tk_id: Self::F = Self::F::one();
        let tk_addr_: Self::F = Self::F::one();
        let tk_id_: Self::F = Self::F::one();

        let random = [
            symmetric::Randomness { r: cin_r },
            symmetric::Randomness {
                r: cin_r + Self::F::one(),
            },
            symmetric::Randomness {
                r: cin_r + Self::F::one() + Self::F::one(),
            },
        ];
        let key = symmetric::SymmetricKey { k: sk };

        let cin0 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.clone(),
            random[0].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_addr },
        )
        .unwrap();
        let cin1 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.clone(),
            random[1].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_id },
        )
        .unwrap();
        let cin2 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.clone(),
            random[2].clone(),
            key.clone(),
            symmetric::Plaintext { m: v_ena_old },
        )
        .unwrap();
        let cin: Vec<Self::F> = vec![random[0].clone().r, cin0.c, cin1.c, cin2.c];

        let cout0 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.clone(),
            random[0].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_addr },
        )
        .unwrap();
        let cout1 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.clone(),
            random[1].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_id },
        )
        .unwrap();
        let cout2 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.clone(),
            random[2].clone(),
            key.clone(),
            symmetric::Plaintext { m: v_ena_new },
        )
        .unwrap();
        let cout: Vec<Self::F> = vec![random[0].clone().r, cout0.c, cout1.c, cout2.c];

        let (pk_enc_send_point_x, pk_enc_send_point_y) = k_u.xy().unwrap();
        let pk_enc_send_point_x = Self::F::from_bigint(pk_enc_send_point_x.into_bigint()).unwrap();
        let pk_enc_send_point_y = Self::F::from_bigint(pk_enc_send_point_y.into_bigint()).unwrap();

        let (pk_enc_recv_point_x, pk_enc_recv_point_y) = k_u_.xy().unwrap();
        let pk_enc_recv_point_x = Self::F::from_bigint(pk_enc_recv_point_x.into_bigint()).unwrap();
        let pk_enc_recv_point_y = Self::F::from_bigint(pk_enc_recv_point_y.into_bigint()).unwrap();

        let k_b = Self::H::evaluate(&rc.clone(), [sk].to_vec()).unwrap();
        let k_b_ = Self::H::evaluate(&rc.clone(), [Self::F::rand(rng)].to_vec()).unwrap();
        let addr = Self::H::evaluate(
            &rc.clone(),
            [k_b, pk_enc_send_point_x, pk_enc_send_point_y].to_vec(),
        )
        .unwrap();
        let addr_r = Self::H::evaluate(
            &rc.clone(),
            [k_b_, pk_enc_recv_point_x, pk_enc_recv_point_y].to_vec(),
        )
        .unwrap();
        let cm = Self::H::evaluate(&rc.clone(), [du, tk_addr, tk_id, dv, addr].to_vec()).unwrap();
        let cm_ = Self::H::evaluate(&rc.clone(), [du_, tk_addr, tk_id, dv_, addr_r].to_vec())?;

        let sn = Self::H::evaluate(&rc.clone(), [cm, sk].to_vec()).unwrap();

        let random = elgamal::Randomness(r);
        let (_, K_u) = ElGamal::encrypt(&elgamal_param, &k_u_, &k, &random).unwrap();
        let (G_r, K_a) = ElGamal::encrypt(&elgamal_param, &apk, &k, &random).unwrap();

        let k_point_x = k.x().ok_or(SynthesisError::AssignmentMissing)?;
        let k_point_x = symmetric::SymmetricKey { k: k_point_x };
        let mut CT: Vec<_> = Vec::new();
        let plain = [du_, tk_addr, tk_id, dv_, addr_r];
        plain.iter().enumerate().for_each(|(i, m)| {
            let random = symmetric::Randomness {
                r: Self::F::from_bigint((i as u64).into()).unwrap(),
            };
            let c = symmetric::SymmetricEncryptionScheme::encrypt(
                rc.clone(),
                random,
                k_point_x.clone(),
                symmetric::Plaintext { m: *m },
            )
            .unwrap();

            CT.push(c.c);
        });

        println!("generate mocking tree");
        let leaf_crh_params = rc.clone();
        let two_to_one_params = leaf_crh_params.clone();

        let proof: merkle_tree::Path<FieldMTConfig<Self::F>> =
            merkle_tree::mocking::get_mocking_merkle_tree(tree_height);
        let leaf: Self::F = cm;

        let rt = proof
            .get_test_root(&leaf_crh_params, &two_to_one_params, [leaf])
            .unwrap();

        let i: u32 = 0;
        assert!(proof
            .verify(&leaf_crh_params, &two_to_one_params, &rt, [leaf])
            .unwrap());

        Ok(ZkWalletCircuit {
            // constants
            rc: rc.clone(),
            G: elgamal_param,

            // inputs
            apk: Some(apk),
            cin: Some(cin),
            rt: Some(rt),
            sn: Some(sn),

            addr: Some(addr),
            k_b: Some(k_b),
            k_u: Some(k_u),

            cm_: Some(cm_),
            cout: Some(cout),
            pv: Some(pv),
            pv_: Some(pv_),
            tk_addr_: Some(tk_addr_),
            tk_id_: Some(tk_id_),

            G_r: Some(G_r),
            K_u: Some(K_u),
            K_a: Some(K_a),

            CT: Some(CT),

            // witnesses
            sk: Some(key),
            cm: Some(cm),
            du: Some(du),
            dv: Some(dv),
            tk_addr: Some(tk_addr),
            tk_id: Some(tk_id),
            addr_r: Some(addr_r),
            k_b_: Some(k_b_),
            k_u_: Some(k_u_),
            du_: Some(du_),
            dv_: Some(dv_),
            r: Some(random),
            k: Some(k),
            k_point_x: Some(k_point_x),
            leaf_pos: Some(i),
            tree_proof: Some(proof),
            _curve_var: std::marker::PhantomData,
        })
    }
}
