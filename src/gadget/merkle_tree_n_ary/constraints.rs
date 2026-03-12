use crate::gadget::hashes::constraints::{CRHSchemeGadget, NToOneCRHSchemeGadget};
use crate::gadget::merkle_tree::constraints::DigestVarConverter;
use crate::gadget::merkle_tree_n_ary::{Config, Path};

use ark_ff::{Field, PrimeField};
use ark_r1cs_std::alloc::AllocVar;
use ark_r1cs_std::boolean::Boolean;
use ark_r1cs_std::prelude::*;
use ark_relations::r1cs::{Namespace, SynthesisError};
use ark_std::borrow::Borrow;
use ark_std::fmt::Debug;
use ark_std::vec::Vec;
use derivative::Derivative;

/// The interface for the Merkle tree gadget.
pub trait ConfigGadget<const N: usize, P: Config<N>, ConstraintF: Field> {
    type Leaf: Debug + ?Sized;
    /// Leaf layer digest variable.
    type LeafDigest: AllocVar<P::LeafDigest, ConstraintF>
        + EqGadget<ConstraintF>
        + ToBytesGadget<ConstraintF>
        + CondSelectGadget<ConstraintF>
        + R1CSVar<ConstraintF>
        + Debug
        + Clone
        + Sized;
    /// Transition between leaf layer to inner layer.
    type LeafInnerConverter: DigestVarConverter<
            Self::LeafDigest,
            <Self::NToOneHash as NToOneCRHSchemeGadget<N, P::NToOneHash, ConstraintF>>::InputVar,
        >;
    /// Inner layer digest variable.
    type InnerDigest: AllocVar<P::InnerDigest, ConstraintF>
        + EqGadget<ConstraintF>
        + ToBytesGadget<ConstraintF>
        + CondSelectGadget<ConstraintF>
        + R1CSVar<ConstraintF>
        + Debug
        + Clone
        + Sized;

    /// leaf -> leaf digest.
    type LeafHash: CRHSchemeGadget<
            P::LeafHash,
            ConstraintF,
            InputVar = Self::Leaf,
            OutputVar = Self::LeafDigest,
        >;
    /// N inner digests (or leaf digests) -> 1 inner digest.
    type NToOneHash: NToOneCRHSchemeGadget<N, P::NToOneHash, ConstraintF, OutputVar = Self::InnerDigest>;
}

type LeafParam<const N: usize, PG, P, ConstraintF> =
    <<PG as ConfigGadget<N, P, ConstraintF>>::LeafHash as CRHSchemeGadget<
        <P as Config<N>>::LeafHash,
        ConstraintF,
    >>::ParametersVar;
type NToOneParam<const N: usize, PG, P, ConstraintF> =
    <<PG as ConfigGadget<N, P, ConstraintF>>::NToOneHash as NToOneCRHSchemeGadget<
        N,
        <P as Config<N>>::NToOneHash,
        ConstraintF,
    >>::ParametersVar;

/// Represents a merkle tree path gadget.
/// In an N-ary tree with OR-constraints, we store all N inputs for each level.
#[derive(Derivative)]
#[derivative(Clone(
    bound = "P: Config<N>, ConstraintF: Field, PG: ConfigGadget<N, P, ConstraintF>"
))]
pub struct PathVar<
    const N: usize,
    P: Config<N>,
    ConstraintF: Field,
    PG: ConfigGadget<N, P, ConstraintF>,
> {
    /// The siblings of leaf.
    pub leaf_siblings: [PG::LeafDigest; N],
    /// The sibling of path node ordered from higher layer to lower layer (does not include root node).
    pub auth_path: Vec<[PG::InnerDigest; N]>,
}

impl<const N: usize, P: Config<N>, ConstraintF: Field, PG: ConfigGadget<N, P, ConstraintF>>
    AllocVar<Path<N, P>, ConstraintF> for PathVar<N, P, ConstraintF, PG>
{
    fn new_variable<T: Borrow<Path<N, P>>>(
        cs: impl Into<Namespace<ConstraintF>>,
        f: impl FnOnce() -> Result<T, SynthesisError>,
        mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        let ns = cs.into();
        let cs = ns.cs();
        f().and_then(|val| {
            let val = val.borrow();

            let leaf_siblings: [PG::LeafDigest; N] = core::array::from_fn(|i| {
                PG::LeafDigest::new_variable(
                    ark_relations::ns!(cs, "leaf_sibling"),
                    || Ok(val.leaf_siblings[i].clone()),
                    mode,
                )
                .unwrap()
            });

            let mut auth_path = Vec::new();
            for layer in &val.auth_path {
                let layer_var: [PG::InnerDigest; N] = core::array::from_fn(|j| {
                    PG::InnerDigest::new_variable(
                        ark_relations::ns!(cs, "auth_path_node"),
                        || Ok(layer[j].clone()),
                        mode,
                    )
                    .unwrap()
                });
                auth_path.push(layer_var);
            }

            Ok(PathVar {
                auth_path,
                leaf_siblings,
            })
        })
    }
}

impl<const N: usize, P: Config<N>, ConstraintF: PrimeField, PG: ConfigGadget<N, P, ConstraintF>>
    PathVar<N, P, ConstraintF, PG>
{
    /// Internal implementation that returns both root and validity.
    /// Calculates the root and tracks whether all OR constraints passed.
    fn calculate_root_internal(
        &self,
        leaf_params: &LeafParam<N, PG, P, ConstraintF>,
        n_to_one_params: &NToOneParam<N, PG, P, ConstraintF>,
        leaf: &PG::Leaf,
    ) -> Result<(PG::InnerDigest, Boolean<ConstraintF>), SynthesisError> {
        // 1. Calculate leaf hash (1-to-1)
        let claimed_leaf_hash = PG::LeafHash::evaluate(leaf_params, leaf)?;

        // 2. OR constraint at leaf level: claimed_leaf_hash must be one of leaf_siblings
        let mut leaf_match_bits = Vec::with_capacity(N);
        for sibling in &self.leaf_siblings {
            leaf_match_bits.push(sibling.is_eq(&claimed_leaf_hash)?);
        }
        let leaf_or_result = Boolean::kary_or(&leaf_match_bits)?;

        // 3. Hash leaf level to get the first inner digest (N-to-1)
        let converted_leaf_siblings: Vec<_> = self
            .leaf_siblings
            .iter()
            .map(|node| PG::LeafInnerConverter::convert(node.clone()))
            .collect::<Result<Vec<_>, _>>()?;

        let converted_leaf_siblings_array: Vec<_> = converted_leaf_siblings
            .into_iter()
            .map(|node| node.borrow().clone())
            .collect();

        let converted_leaf_siblings_fixed: [_; N] = converted_leaf_siblings_array
            .try_into()
            .map_err(|_| SynthesisError::AssignmentMissing)?;

        let mut curr_hash =
            PG::NToOneHash::evaluate(n_to_one_params, &converted_leaf_siblings_fixed)?;

        // Track all OR constraint results
        let mut all_valid = leaf_or_result;

        // 4. Traverse up the tree (from bottom to top)
        // We use .rev() because auth_path is stored top-to-bottom (higher to lower level)
        for (_, layer) in self.auth_path.iter().rev().enumerate() {
            // OR constraint: current hash must be one of the hashes in this layer
            let mut layer_match_bits = Vec::with_capacity(N);
            for node in layer {
                layer_match_bits.push(node.is_eq(&curr_hash)?);
            }

            let layer_or_result = Boolean::kary_or(&layer_match_bits)?;

            // AND all OR results together
            all_valid = Boolean::kary_and(&[all_valid, layer_or_result])?;

            // Hash this layer to get parent hash
            curr_hash = PG::NToOneHash::compress(n_to_one_params, layer)?;
        }

        Ok((curr_hash, all_valid))
    }

    /// Calculate the root of the Merkle tree assuming that `leaf` is the leaf on the path defined by `self`.
    ///
    /// In this N-ary implementation, we use OR-constraints to ensure the calculated hash
    /// at each level matches one of the inputs in the next level's path.
    pub fn calculate_root(
        &self,
        leaf_params: &LeafParam<N, PG, P, ConstraintF>,
        n_to_one_params: &NToOneParam<N, PG, P, ConstraintF>,
        leaf: &PG::Leaf,
    ) -> Result<PG::InnerDigest, SynthesisError> {
        let (root, _) = self.calculate_root_internal(leaf_params, n_to_one_params, leaf)?;
        Ok(root)
    }

    /// Check that hashing a Merkle tree path according to `self`, and
    /// with `leaf` as the leaf, leads to a Merkle tree root equalling `root`.
    /// Returns a boolean that is true iff all OR constraints passed AND the computed root equals the provided root.
    pub fn verify_membership(
        &self,
        leaf_params: &LeafParam<N, PG, P, ConstraintF>,
        n_to_one_params: &NToOneParam<N, PG, P, ConstraintF>,
        root: &PG::InnerDigest,
        leaf: &PG::Leaf,
    ) -> Result<Boolean<ConstraintF>, SynthesisError> {
        let (expected_root, is_valid_path) =
            self.calculate_root_internal(leaf_params, n_to_one_params, leaf)?;
        let root_match = expected_root.is_eq(root)?;
        Boolean::kary_and(&[is_valid_path, root_match])
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::gadget::hashes::poseidon::arkworks_parameters::bn254::{
        poseidon_parameter_bn254_1_to_1, poseidon_parameter_bn254_8_to_1,
    };
    use crate::gadget::hashes::poseidon::constraints::{CRHGadget, NToOneCRHGadget};
    use crate::gadget::hashes::poseidon::{NToOneCRH, PoseidonHash};
    use crate::gadget::merkle_tree::IdentityDigestConverter;
    use crate::gadget::merkle_tree_n_ary::{Config, MerkleTree};
    use ark_bn254::Fr;
    use ark_r1cs_std::fields::fp::FpVar;
    use ark_relations::r1cs::ConstraintSystem;

    #[derive(Clone, Copy, Debug)]
    struct TestConfig;
    impl Config<8> for TestConfig {
        type Leaf = [Fr];
        type LeafDigest = Fr;
        type LeafInnerDigestConverter = IdentityDigestConverter<Fr>;
        type InnerDigest = Fr;
        type LeafHash = PoseidonHash<Fr>;
        type NToOneHash = NToOneCRH<8, Fr>;
    }

    struct TestConfigGadget;
    impl ConfigGadget<8, TestConfig, Fr> for TestConfigGadget {
        type Leaf = [FpVar<Fr>];
        type LeafDigest = FpVar<Fr>;
        type LeafInnerConverter = IdentityDigestConverter<FpVar<Fr>>;
        type InnerDigest = FpVar<Fr>;
        type LeafHash = CRHGadget<Fr>;
        type NToOneHash = NToOneCRHGadget<8, Fr>;
    }

    #[test]
    fn test_merkle_tree_n_ary_gadget() {
        let leaf_params = poseidon_parameter_bn254_1_to_1::get_poseidon_parameters().into();
        let inner_params = poseidon_parameter_bn254_8_to_1::get_poseidon_parameters().into();

        // 1. Setup native tree
        let mut leaves = Vec::new();
        let num_leaves_log = 9;

        for i in 0..(1 << num_leaves_log) {
            leaves.push([Fr::from(i as u64)]);
        }
        let tree = MerkleTree::<8, TestConfig>::new(
            &leaf_params,
            &inner_params,
            leaves.iter().map(|l| &l[..]),
        )
        .unwrap();
        let root = tree.root();

        // 2. Test Case: Valid Membership (Index 0)
        {
            let cs = ConstraintSystem::<Fr>::new_ref();
            let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                cs.clone(),
                &leaf_params,
            )
            .unwrap();
            let inner_params_var =
                NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                    cs.clone(),
                    &inner_params,
                )
                .unwrap();

            let index = 0;
            let path = tree.generate_proof(index).unwrap();

            let root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(root)).unwrap();
            let leaf_var =
                vec![FpVar::<Fr>::new_witness(cs.clone(), || Ok(leaves[index][0])).unwrap()];
            let path_var =
                PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                    Ok(path)
                })
                .unwrap();

            let result = path_var
                .verify_membership(&leaf_params_var, &inner_params_var, &root_var, &leaf_var)
                .unwrap();

            assert!(result.value().unwrap());
            assert!(cs.is_satisfied().unwrap());
        }

        // 3. Test Case: Same Chunk, Different Leaf (Path for 0, Leaf for 1)
        {
            let cs = ConstraintSystem::<Fr>::new_ref();
            let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                cs.clone(),
                &leaf_params,
            )
            .unwrap();
            let inner_params_var =
                NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                    cs.clone(),
                    &inner_params,
                )
                .unwrap();

            let path_0 = tree.generate_proof(0).unwrap();
            let root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(root)).unwrap();
            let leaf_1_var =
                vec![FpVar::<Fr>::new_witness(cs.clone(), || Ok(leaves[1][0])).unwrap()];
            let path_var =
                PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                    Ok(path_0)
                })
                .unwrap();

            let result = path_var
                .verify_membership(&leaf_params_var, &inner_params_var, &root_var, &leaf_1_var)
                .unwrap();

            assert!(
                result.value().unwrap(),
                "Leaf 1 should be in same chunk as leaf 0"
            );
            assert!(cs.is_satisfied().unwrap());
        }

        // 4. Test Case: Last Leaf in Chunk (Path for 0, Leaf for 7)
        {
            let cs = ConstraintSystem::<Fr>::new_ref();
            let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                cs.clone(),
                &leaf_params,
            )
            .unwrap();
            let inner_params_var =
                NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                    cs.clone(),
                    &inner_params,
                )
                .unwrap();

            let path_0 = tree.generate_proof(0).unwrap();
            let root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(root)).unwrap();
            let leaf_7_var =
                vec![FpVar::<Fr>::new_witness(cs.clone(), || Ok(leaves[7][0])).unwrap()];
            let path_var =
                PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                    Ok(path_0)
                })
                .unwrap();

            let result = path_var
                .verify_membership(&leaf_params_var, &inner_params_var, &root_var, &leaf_7_var)
                .unwrap();

            assert!(
                result.value().unwrap(),
                "Leaf 7 should be in same chunk as leaf 0"
            );
            assert!(cs.is_satisfied().unwrap());
        }

        // 5. Test Case: Different Chunk (Path for 0, Leaf for 8)
        {
            let cs = ConstraintSystem::<Fr>::new_ref();
            let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                cs.clone(),
                &leaf_params,
            )
            .unwrap();
            let inner_params_var =
                NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                    cs.clone(),
                    &inner_params,
                )
                .unwrap();

            let path_0 = tree.generate_proof(0).unwrap();
            let root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(root)).unwrap();
            let leaf_8_var =
                vec![FpVar::<Fr>::new_witness(cs.clone(), || Ok(leaves[8][0])).unwrap()];
            let path_var =
                PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                    Ok(path_0)
                })
                .unwrap();

            let result = path_var
                .verify_membership(&leaf_params_var, &inner_params_var, &root_var, &leaf_8_var)
                .unwrap();

            assert!(
                !result.value().unwrap(),
                "Leaf 8 should be in different chunk, verification must fail"
            );
            assert!(cs.is_satisfied().unwrap());
        }

        // 6. Test Case: Completely Wrong Leaf
        {
            let cs = ConstraintSystem::<Fr>::new_ref();
            let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                cs.clone(),
                &leaf_params,
            )
            .unwrap();
            let inner_params_var =
                NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                    cs.clone(),
                    &inner_params,
                )
                .unwrap();

            let path_0 = tree.generate_proof(0).unwrap();
            let root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(root)).unwrap();
            let wrong_leaf = Fr::from(1u64 << (num_leaves_log + 1));
            let wrong_leaf_var =
                vec![FpVar::<Fr>::new_witness(cs.clone(), || Ok(wrong_leaf)).unwrap()];
            let path_var =
                PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                    Ok(path_0)
                })
                .unwrap();

            let result_var = path_var
                .verify_membership(
                    &leaf_params_var,
                    &inner_params_var,
                    &root_var,
                    &wrong_leaf_var,
                )
                .unwrap();

            assert!(
                !result_var.value().unwrap(),
                "Wrong leaf should fail verification"
            );
            assert!(cs.is_satisfied().unwrap());
        }

        // 7. Test Case: Valid Path with Wrong Root
        {
            let cs = ConstraintSystem::<Fr>::new_ref();
            let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                cs.clone(),
                &leaf_params,
            )
            .unwrap();
            let inner_params_var =
                NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                    cs.clone(),
                    &inner_params,
                )
                .unwrap();

            let path_0 = tree.generate_proof(0).unwrap();
            let wrong_root = Fr::from(12345u64);
            let wrong_root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(wrong_root)).unwrap();
            let leaf_var = vec![FpVar::<Fr>::new_witness(cs.clone(), || Ok(leaves[0][0])).unwrap()];
            let path_var =
                PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                    Ok(path_0)
                })
                .unwrap();

            let result_var = path_var
                .verify_membership(
                    &leaf_params_var,
                    &inner_params_var,
                    &wrong_root_var,
                    &leaf_var,
                )
                .unwrap();

            assert!(
                !result_var.value().unwrap(),
                "Wrong root should fail verification"
            );
            assert!(cs.is_satisfied().unwrap());
        }

        // 8. Test Case: Correct Path and Leaf with Correct Root
        {
            let cs = ConstraintSystem::<Fr>::new_ref();
            let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                cs.clone(),
                &leaf_params,
            )
            .unwrap();
            let inner_params_var =
                NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
                    cs.clone(),
                    &inner_params,
                )
                .unwrap();

            // Test a few random indices
            for &test_index in &[0, 7, 8, 15, 100, 256, 511] {
                let path = tree.generate_proof(test_index).unwrap();
                let root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(root)).unwrap();
                let leaf_var = vec![
                    FpVar::<Fr>::new_witness(cs.clone(), || Ok(leaves[test_index][0])).unwrap(),
                ];
                let path_var =
                    PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                        Ok(path)
                    })
                    .unwrap();

                let result = path_var
                    .verify_membership(&leaf_params_var, &inner_params_var, &root_var, &leaf_var)
                    .unwrap();

                assert!(
                    result.value().unwrap(),
                    "Verification should pass for index {}",
                    test_index
                );
            }
            assert!(cs.is_satisfied().unwrap());
        }
    }

    #[test]
    fn test_merkle_tree_n_ary_mock_2_33_leaves() {
        println!("\n╔════════════════════════════════════════════════════════════════╗");
        println!("║  Mock Test: ~2^33 Leaf Trees (height=11 for N=8)             ║");
        println!("╚════════════════════════════════════════════════════════════════╝\n");

        let leaf_params = poseidon_parameter_bn254_1_to_1::get_poseidon_parameters().into();
        let inner_params = poseidon_parameter_bn254_8_to_1::get_poseidon_parameters().into();

        // height = 11 for N=8 (= 2^33 > 2^32)
        let height = 11;
        let auth_path_layers = height - 1; // 10 layers

        // Create mock path with dummy values
        let mock_path = Path::<8, TestConfig> {
            leaf_siblings: [Fr::from(1u64); 8],
            auth_path: vec![[Fr::from(1u64); 8]; auth_path_layers],
            leaf_index: 0,
        };

        let cs = ConstraintSystem::<Fr>::new_ref();
        let leaf_params_var = LeafParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
            cs.clone(),
            &leaf_params,
        )
        .unwrap();
        let inner_params_var = NToOneParam::<8, TestConfigGadget, TestConfig, Fr>::new_constant(
            cs.clone(),
            &inner_params,
        )
        .unwrap();

        let root_var = FpVar::<Fr>::new_witness(cs.clone(), || Ok(Fr::from(1u64))).unwrap();
        let leaf_var = vec![FpVar::<Fr>::new_witness(cs.clone(), || Ok(Fr::from(1u64))).unwrap()];
        let path_var =
            PathVar::<8, TestConfig, Fr, TestConfigGadget>::new_witness(cs.clone(), || {
                Ok(mock_path)
            })
            .unwrap();

        let _result = path_var
            .verify_membership(&leaf_params_var, &inner_params_var, &root_var, &leaf_var)
            .unwrap();

        let num_constraints = cs.num_constraints();
        println!("N=8, Height={} :", height);
        println!("  Total constraints: {}\n", num_constraints);
    }
}
