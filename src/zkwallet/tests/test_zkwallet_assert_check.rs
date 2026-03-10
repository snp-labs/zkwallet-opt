mod test {
    use ark_ff::PrimeField;

    use ark_std::Zero;
    use ark_std::rand::RngCore;
    use ark_std::rand::SeedableRng;
    use ark_std::test_rng;

    use crate::zkwallet;
    use crate::zkwallet::circuit::ZkWalletCircuit;

    use crate::gadget::hashes::mimc7;

    // type C = ark_bn254::G1Projective;
    // type GG = ark_ec::bn::g1::G1Projective<ark_bn254::g1::Config>;
    type C = ark_ed_on_bn254::EdwardsProjective;
    type GG = ark_ed_on_bn254::constraints::EdwardsVar;

    type F = ark_bn254::Fr;

    #[allow(dead_code)]
    fn print_hex(f: F) {
        let decimal_number = f.into_bigint().to_string();

        // Parse the decimal number as a BigUint
        let big_int = num_bigint::BigUint::parse_bytes(decimal_number.as_bytes(), 10).unwrap();

        // Convert the BigUint to a hexadecimal string
        let hex_string = format!("{:x}", big_int);

        println!("0x{}", hex_string);
    }

    #[test]
    #[should_panic]
    fn test_zkwallet_assert1_sk_send_own() {
        use ark_relations::r1cs::ConstraintSynthesizer;

        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(test_rng().next_u64());

        let rc: mimc7::Parameters<F> = mimc7::Parameters {
            round_constants: mimc7::parameters::get_bn256_round_constants(),
        };

        let mut test_input =
            <ZkWalletCircuit<C, GG> as zkwallet::MockingCircuit<C, GG>>::generate_circuit(
                rc, 32, &mut rng,
            )
            .unwrap();

        test_input.k_b = Some(F::zero());

        let cs = ark_relations::r1cs::ConstraintSystem::new_ref();

        test_input.clone().generate_constraints(cs.clone()).unwrap();
        assert!(cs.is_satisfied().unwrap());
    }

    #[test]
    #[should_panic]
    fn test_zkwallet_assert2_addr_send() {
        use ark_relations::r1cs::ConstraintSynthesizer;

        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(test_rng().next_u64());

        let rc: mimc7::Parameters<F> = mimc7::Parameters {
            round_constants: mimc7::parameters::get_bn256_round_constants(),
        };

        let mut test_input =
            <ZkWalletCircuit<C, GG> as zkwallet::MockingCircuit<C, GG>>::generate_circuit(
                rc, 32, &mut rng,
            )
            .unwrap();

        test_input.addr = Some(F::zero());

        let cs = ark_relations::r1cs::ConstraintSystem::new_ref();

        test_input.clone().generate_constraints(cs.clone()).unwrap();
        assert!(cs.is_satisfied().unwrap());
    }
}
