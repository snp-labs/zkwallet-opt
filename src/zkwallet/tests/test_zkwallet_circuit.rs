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
    fn test_zkwallet_test_input() {
        use ark_relations::r1cs::ConstraintSynthesizer;

        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(test_rng().next_u64());

        let rc: mimc7::Parameters<F> = mimc7::Parameters {
            round_constants: mimc7::parameters::get_bn256_round_constants(),
        };

        let test_input =
            <ZkWalletCircuit<C, GG> as zkwallet::MockingCircuit<C, GG>>::generate_circuit(
                rc, 32, &mut rng,
            )
            .unwrap();

        let cs = ark_relations::r1cs::ConstraintSystem::new_ref();

        test_input.clone().generate_constraints(cs.clone()).unwrap();
        assert!(cs.is_satisfied().unwrap());
    }

    #[test]
    fn test_zkwallet_circuit_groth16() {
        let mut rng = ark_std::rand::rngs::StdRng::seed_from_u64(test_rng().next_u64());
        println!("Generate ZkWallet test input!");
        let rc: mimc7::Parameters<F> = mimc7::Parameters {
            round_constants: mimc7::parameters::get_bn256_round_constants(),
        };

        let test_input =
            <ZkWalletCircuit<C, GG> as zkwallet::MockingCircuit<C, GG>>::generate_circuit(
                rc, 32, &mut rng,
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

                /////////////////////////
                // prove 할 때 사용되는 입력과 verify 입력에 들어가는 입력 출력용 코드
                // use ark_relations::r1cs::ConstraintSynthesizer;
                // let cs = ark_relations::r1cs::ConstraintSystem::new_ref();
                // cs.set_optimization_goal(ark_relations::r1cs::OptimizationGoal::Constraints);

                // c.generate_constraints(cs.clone()).unwrap();
                // cs.finalize();
                // let prover = cs.borrow().unwrap();

                // println!("cs prover");
                // prover.instance_assignment.iter().enumerate().for_each(|(i, x)| {
                //     print!("{}: ", i);
                //     print_hex(*x);
                // });

                // println!("\ncs vf");
                // image.iter().enumerate().for_each(|(i, x)| {
                //     print!("{}: ", i+1);
                //     print_hex(*x);
                // });
                /////////////////////////

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
