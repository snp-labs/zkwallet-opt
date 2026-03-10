mod test {
    use std::str::FromStr;

    use ark_ec::CurveGroup;
    use ark_ec::{AffineRepr, PrimeGroup};

    use ark_ff::Fp;
    use ark_ff::PrimeField;

    use ark_std::UniformRand;
    use ark_std::rand::RngCore;
    use ark_std::rand::SeedableRng;
    use ark_std::test_rng;
    use ark_std::{One, Zero};

    use crate::Error;

    use crate::zkwallet::circuit::{FieldMTConfig, PoseidonConfigSet, ZkWalletCircuit};

    use crate::gadget::merkle_tree_n_ary::mocking::{get_mocking_merkle_tree, MockingMerkleTree};

    use crate::gadget::symmetric_encrytions::SymmetricEncryption;
    use crate::gadget::symmetric_encrytions::symmetric;

    use crate::gadget::public_encryptions::AsymmetricEncryptionScheme;
    use crate::gadget::public_encryptions::elgamal;
    use crate::gadget::public_encryptions::elgamal::ElGamal;

    use crate::gadget::hashes::CRHScheme;
    use crate::gadget::hashes::poseidon;
    use crate::gadget::hashes::poseidon::arkworks_parameters::bn254::{
        poseidon_parameter_bn254_1_to_1, poseidon_parameter_bn254_2_to_1,
        poseidon_parameter_bn254_4_to_1, poseidon_parameter_bn254_8_to_1,
    };

    type C = ark_ed_on_bn254::EdwardsProjective;
    type GG = ark_ed_on_bn254::constraints::EdwardsVar;

    type F = ark_bn254::Fr;
    type H = poseidon::PoseidonHash<F>;

    fn get_poseidon_config_set() -> PoseidonConfigSet<F> {
        PoseidonConfigSet {
            rc1: poseidon_parameter_bn254_1_to_1::get_poseidon_parameters().into(),
            rc2: poseidon_parameter_bn254_2_to_1::get_poseidon_parameters().into(),
            rc4: poseidon_parameter_bn254_4_to_1::get_poseidon_parameters().into(),
            rc8: poseidon_parameter_bn254_8_to_1::get_poseidon_parameters().into(),
        }
    }

    #[allow(non_snake_case)]
    fn test_erc20_input(
        v_ena_old: F,
        v_ena_new: F,
        pv: F,
        pv_: F,
        dv: F,
        dv_: F,
        tk_addr: F,
        tk_id: F,
        tk_addr_: F,
        tk_id_: F,
        is_cin: bool,
    ) -> Result<ZkWalletCircuit<C, GG>, Error> {
        let generator = C::generator().into_affine();

        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(test_rng().next_u64());

        let rc = get_poseidon_config_set();

        let elgamal_param: elgamal::Parameters<C> = elgamal::Parameters { generator };

        let (apk, _) = ElGamal::keygen(&elgamal_param, &mut rng).unwrap();
        let (k_u, _) = ElGamal::keygen(&elgamal_param, &mut rng).unwrap();
        let (k_u_, _) = ElGamal::keygen(&elgamal_param, &mut rng).unwrap();

        let cin_r = F::rand(&mut rng);

        let r = <C as PrimeGroup>::ScalarField::rand(&mut rng);
        let sk = F::rand(&mut rng);
        let k = C::rand(&mut rng).into_affine();
        let du = F::rand(&mut rng);
        let du_ = F::rand(&mut rng);

        let random = [
            symmetric::Randomness { r: cin_r },
            symmetric::Randomness {
                r: cin_r + F::one(),
            },
            symmetric::Randomness {
                r: cin_r + F::one() + F::one(),
            },
        ];
        let key = symmetric::SymmetricKey { k: sk };

        let cin0 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.rc2.clone(),
            random[0].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_addr },
        )
        .unwrap();
        let cin1 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.rc2.clone(),
            random[1].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_id },
        )
        .unwrap();
        let cin2 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.rc2.clone(),
            random[2].clone(),
            key.clone(),
            symmetric::Plaintext { m: v_ena_old },
        )
        .unwrap();

        let cin = if is_cin {
            vec![random[0].clone().r, cin0.c, cin1.c, cin2.c]
        } else {
            vec![F::zero(); 4]
        };

        let cout0 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.rc2.clone(),
            random[0].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_addr },
        )
        .unwrap();
        let cout1 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.rc2.clone(),
            random[1].clone(),
            key.clone(),
            symmetric::Plaintext { m: tk_id },
        )
        .unwrap();
        let cout2 = symmetric::SymmetricEncryptionScheme::encrypt(
            rc.rc2.clone(),
            random[2].clone(),
            key.clone(),
            symmetric::Plaintext { m: v_ena_new },
        )
        .unwrap();
        let cout: Vec<F> = vec![random[0].clone().r, cout0.c, cout1.c, cout2.c];

        let (pk_enc_send_point_x, pk_enc_send_point_y) = k_u.xy().unwrap();
        let pk_enc_send_point_x = F::from_bigint(pk_enc_send_point_x.into_bigint()).unwrap();
        let pk_enc_send_point_y = F::from_bigint(pk_enc_send_point_y.into_bigint()).unwrap();

        let (pk_enc_recv_point_x, pk_enc_recv_point_y) = k_u_.xy().unwrap();
        let pk_enc_recv_point_x = F::from_bigint(pk_enc_recv_point_x.into_bigint()).unwrap();
        let pk_enc_recv_point_y = F::from_bigint(pk_enc_recv_point_y.into_bigint()).unwrap();

        let k_b = H::evaluate(&rc.rc1, [sk].as_ref()).unwrap();
        let k_b_ = H::evaluate(&rc.rc1, [F::rand(&mut rng)].as_ref()).unwrap();
        let addr = H::evaluate(
            &rc.rc4,
            [k_b, pk_enc_send_point_x, pk_enc_send_point_y].as_ref(),
        )
        .unwrap();
        let addr_r = H::evaluate(
            &rc.rc4,
            [k_b_, pk_enc_recv_point_x, pk_enc_recv_point_y].as_ref(),
        )
        .unwrap();
        let cm = H::evaluate(&rc.rc8, [du, tk_addr, tk_id, dv, addr].as_ref()).unwrap();
        let cm_ = H::evaluate(&rc.rc8, [du_, tk_addr, tk_id, dv_, addr_r].as_ref()).unwrap();

        let sn = H::evaluate(&rc.rc2, [cm, sk].as_ref()).unwrap();

        let random = elgamal::Randomness(r);
        let (_, K_u) = ElGamal::encrypt(&elgamal_param, &k_u_, &k, &random).unwrap();
        let (G_r, K_a) = ElGamal::encrypt(&elgamal_param, &apk, &k, &random).unwrap();

        let k_point_x = k.x().unwrap();
        let k_point_x = symmetric::SymmetricKey { k: k_point_x };
        let mut CT: Vec<_> = Vec::new();
        let plain = [du_, tk_addr, tk_id, dv_, addr_r];
        plain.iter().enumerate().for_each(|(i, m)| {
            let random = symmetric::Randomness {
                r: F::from_bigint((i as u64).into()).unwrap(),
            };
            let c = symmetric::SymmetricEncryptionScheme::encrypt(
                rc.rc2.clone(),
                random,
                k_point_x.clone(),
                symmetric::Plaintext { m: *m },
            )
            .unwrap();

            CT.push(c.c);
        });

        println!("generate mocking tree");
        let mock_path = get_mocking_merkle_tree::<8, FieldMTConfig<F>, F>(11);
        let (valid_proof, rt) = mock_path.get_test_path(&rc.rc1, &rc.rc8, [cm].as_ref()).unwrap();

        Ok(ZkWalletCircuit {
            // constants
            rc1: rc.rc1,
            rc2: rc.rc2,
            rc4: rc.rc4,
            rc8: rc.rc8,
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
            leaf_pos: Some(0),
            tree_proof: Some(valid_proof),
            _curve_var: std::marker::PhantomData,
        })
    }

    #[test]
    fn test_erc20_note_exist() {
        use ark_relations::r1cs::ConstraintSynthesizer;

        let pv: F = F::one(); // V Pub in
        let pv_: F = F::one(); // V Pub out
        let dv: F = F::one(); // V Priv in
        let dv_: F = F::one(); // V Priv out

        let v_ena_old: F = F::one();
        let v_ena_new: F = F::one();

        let tk_addr: F = Fp::from_str("30164109555827864556672284724742514571715490286").unwrap();
        let tk_id: F = F::zero();
        let tk_addr_: F = Fp::from_str("30164109555827864556672284724742514571715490286").unwrap();
        let tk_id_: F = F::zero();

        let test_input = test_erc20_input(
            v_ena_old, v_ena_new, pv, pv_, dv, dv_, tk_addr, tk_id, tk_addr_, tk_id_, true,
        )
        .unwrap();

        let cs = ark_relations::r1cs::ConstraintSystem::new_ref();

        test_input.clone().generate_constraints(cs.clone()).unwrap();
        assert!(cs.is_satisfied().unwrap());
    }

    #[test]
    fn test_erc20_note_not_exist() {
        use ark_relations::r1cs::ConstraintSynthesizer;

        let pv: F = F::one(); // V Pub in
        let pv_: F = F::zero(); // V Pub out
        let dv: F = F::one(); // V Priv in
        let dv_: F = F::one(); // V Priv out

        let v_ena_old: F = F::zero();
        let v_ena_new: F = F::one();

        let tk_addr: F = Fp::from_str("30164109555827864556672284724742514571715490286").unwrap();
        let tk_id: F = F::zero();
        let tk_addr_: F = Fp::from_str("30164109555827864556672284724742514571715490286").unwrap();
        let tk_id_: F = F::zero();

        let test_input = test_erc20_input(
            v_ena_old, v_ena_new, pv, pv_, dv, dv_, tk_addr, tk_id, tk_addr_, tk_id_, false,
        )
        .unwrap();

        let cs = ark_relations::r1cs::ConstraintSystem::new_ref();

        test_input.clone().generate_constraints(cs.clone()).unwrap();
        assert!(cs.is_satisfied().unwrap());
    }

    #[test]
    fn test_erc20_v_pub_in_and_v_pub_out_is_zero() {
        use ark_relations::r1cs::ConstraintSynthesizer;

        let pv: F = F::zero(); // V Pub in
        let pv_: F = F::zero(); // V Pub out
        let dv: F = F::one(); // V Priv in
        let dv_: F = F::one(); // V Priv out

        let v_ena_old: F = F::one();
        let v_ena_new: F = F::one();

        let tk_addr: F = Fp::from_str("30164109555827864556672284724742514571715490286").unwrap();
        let tk_id: F = F::zero();
        let tk_addr_: F = Fp::zero();
        let tk_id_: F = F::zero();

        let test_input = test_erc20_input(
            v_ena_old, v_ena_new, pv, pv_, dv, dv_, tk_addr, tk_id, tk_addr_, tk_id_, true,
        )
        .unwrap();

        let cs = ark_relations::r1cs::ConstraintSystem::new_ref();

        test_input.clone().generate_constraints(cs.clone()).unwrap();
        assert!(cs.is_satisfied().unwrap());
    }
}
