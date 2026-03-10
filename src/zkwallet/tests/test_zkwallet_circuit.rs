mod test {
    use std::time::Duration;
    use std::time::Instant;

    use ark_bn254::Bn254;
    use ark_crypto_primitives::snark::CircuitSpecificSetupSNARK;
    use ark_crypto_primitives::snark::SNARK;
    use ark_ec::AffineRepr;

    use ark_ff::PrimeField;
    use ark_groth16::Groth16;

    use ark_std::rand::RngCore;
    use ark_std::rand::SeedableRng;
    use ark_std::test_rng;

    use crate::zkwallet;
    use crate::zkwallet::circuit::{PoseidonConfigSet, ZkWalletCircuit};

    use crate::gadget::hashes::poseidon::arkworks_parameters::bn254::{
        poseidon_parameter_bn254_1_to_1, poseidon_parameter_bn254_2_to_1,
        poseidon_parameter_bn254_4_to_1, poseidon_parameter_bn254_8_to_1,
    };

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

    fn get_poseidon_config_set() -> PoseidonConfigSet<F> {
        PoseidonConfigSet {
            poseidon_pp_1: poseidon_parameter_bn254_1_to_1::get_poseidon_parameters().into(),
            poseidon_pp_2: poseidon_parameter_bn254_2_to_1::get_poseidon_parameters().into(),
            poseidon_pp_4: poseidon_parameter_bn254_4_to_1::get_poseidon_parameters().into(),
            poseidon_pp_8: poseidon_parameter_bn254_8_to_1::get_poseidon_parameters().into(),
        }
    }

    #[test]
    fn test_zkwallet_test_input() {
        use ark_relations::r1cs::ConstraintSynthesizer;

        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(test_rng().next_u64());

        let hash_param = get_poseidon_config_set();

        let test_input =
            <ZkWalletCircuit<C, GG> as zkwallet::MockingCircuit<C, GG>>::generate_circuit(
                hash_param, 11, &mut rng,
            )
            .unwrap();

        let cs = ark_relations::r1cs::ConstraintSystem::new_ref();

        test_input.clone().generate_constraints(cs.clone()).unwrap();
        assert!(cs.is_satisfied().unwrap());
        println!("Number of constraints: {}", cs.num_constraints());
    }

    #[test]
    fn test_zkwallet_circuit_groth16() {
        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(test_rng().next_u64());
        println!("Generate ZkWallet test input!");
        let hash_param = get_poseidon_config_set();

        let test_input =
            <ZkWalletCircuit<C, GG> as zkwallet::MockingCircuit<C, GG>>::generate_circuit(
                hash_param, 11, &mut rng,
            )
            .unwrap();

        println!("Generate CRS!");
        let (pk, vk) = {
            let c = test_input.clone();

            Groth16::<Bn254>::setup(c, &mut rng).unwrap()
        };

        println!("Prepared verifying key!");
        let pvk = Groth16::<Bn254>::process_vk(&vk).unwrap();

        // Let's benchmark stuff!
        const SAMPLES: u32 = 1;
        let mut total_proving = Duration::new(0, 0);
        let mut total_verifying = Duration::new(0, 0);

        for _ in 0..SAMPLES {
            let mut image: Vec<_> = vec![
                test_input.apk.unwrap().x().unwrap(),
                test_input.apk.unwrap().y().unwrap(),
            ];
            image.append(&mut test_input.cin.clone().unwrap());
            image.append(&mut vec![
                test_input.rt.unwrap(),
                test_input.sn.unwrap(),
                test_input.addr.unwrap(),
                test_input.k_b.unwrap(),
                test_input.k_u.unwrap().x().unwrap(),
                test_input.k_u.unwrap().y().unwrap(),
                test_input.cm_.unwrap(),
            ]);
            image.append(&mut test_input.cout.clone().unwrap());
            image.append(&mut vec![
                test_input.pv.unwrap(),
                test_input.pv_.unwrap(),
                test_input.tk_addr_.unwrap(),
                test_input.tk_id_.unwrap(),
                test_input.G_r.unwrap().x().unwrap(),
                test_input.G_r.unwrap().y().unwrap(),
                test_input.K_u.unwrap().x().unwrap(),
                test_input.K_u.unwrap().y().unwrap(),
                test_input.K_a.unwrap().x().unwrap(),
                test_input.K_a.unwrap().y().unwrap(),
            ]);
            image.append(&mut test_input.CT.clone().unwrap());

            let start = Instant::now();
            {
                let c = test_input.clone();

                println!("Generate proof!");
                let proof = Groth16::<Bn254>::prove(&pk, c.clone(), &mut rng).unwrap();

                assert!(Groth16::<Bn254>::verify_with_processed_vk(&pvk, &image, &proof).unwrap());
            }

            total_proving += start.elapsed();
            let start = Instant::now();
            total_verifying += start.elapsed();
        }

        let proving_avg = total_proving / SAMPLES;
        let proving_avg =
            proving_avg.subsec_nanos() as f64 / 1_000_000_000f64 + (proving_avg.as_secs() as f64);

        let verifying_avg = total_verifying / SAMPLES;
        let verifying_avg = verifying_avg.subsec_nanos() as f64 / 1_000_000_000f64
            + (verifying_avg.as_secs() as f64);

        println!("Average proving time: {:?} seconds", proving_avg);
        println!("Average verifying time: {:?} seconds", verifying_avg);
    }
}
