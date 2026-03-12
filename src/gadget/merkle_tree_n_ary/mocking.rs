use ark_ff::PrimeField;
use ark_std::borrow::Borrow;
use ark_std::vec::Vec;

// External crates
use crate::Error;
use crate::gadget::hashes::{CRHScheme, NToOneCRHScheme};
use crate::gadget::merkle_tree_n_ary::{Config, DigestConverter, LeafParam, NToOneParam, Path};

pub trait MockingMerkleTree<const N: usize, P: Config<N>> {
    fn get_test_path<L: Borrow<P::Leaf>>(
        &self,
        leaf_hash_params: &LeafParam<N, P>,
        n_to_one_params: &NToOneParam<N, P>,
        leaf: L,
    ) -> Result<(Path<N, P>, P::InnerDigest), Error>;
}

impl<const N: usize, P: Config<N>> MockingMerkleTree<N, P> for Path<N, P> {
    fn get_test_path<L: Borrow<P::Leaf>>(
        &self,
        leaf_hash_params: &LeafParam<N, P>,
        n_to_one_params: &NToOneParam<N, P>,
        leaf: L,
    ) -> Result<(Path<N, P>, P::InnerDigest), Error> {
        // 1. Calculate leaf hash
        let claimed_leaf_hash = P::LeafHash::evaluate(leaf_hash_params, leaf)?;

        // 2. Prepare leaf level siblings
        let mut leaf_siblings = self.leaf_siblings.clone();
        leaf_siblings[self.leaf_index % N] = claimed_leaf_hash;

        // 3. Convert leaf level siblings to NToOneHash input type
        let converted_leaf_siblings: Vec<_> = leaf_siblings
            .iter()
            .cloned()
            .map(|node| P::LeafInnerDigestConverter::convert(node))
            .collect::<Result<Vec<_>, _>>()?;

        let leaf_inputs: [_; N] = converted_leaf_siblings
            .try_into()
            .map_err(|_| anyhow::anyhow!("Conversion failed"))?;

        // 4. Hash the leaf level to get the first inner digest
        let mut curr_hash = P::NToOneHash::evaluate(n_to_one_params, &leaf_inputs)?;

        // 5. Traverse up the tree (from bottom to top)
        let mut auth_path = self.auth_path.clone();
        let mut index = self.leaf_index / N;
        for i in (0..auth_path.len()).rev() {
            auth_path[i][index % N] = curr_hash.clone();

            // Update curr_hash by hashing the N inputs of this level
            curr_hash = P::NToOneHash::compress(n_to_one_params, &auth_path[i])?;
            index /= N;
        }

        let new_path = Path {
            leaf_siblings,
            auth_path,
            leaf_index: self.leaf_index,
        };

        Ok((new_path, curr_hash))
    }
}

pub fn get_mocking_merkle_tree<
    const N: usize,
    T: Config<N, LeafDigest = F, InnerDigest = F>,
    F: PrimeField,
>(
    tree_height: u64,
) -> Path<N, T> {
    let auth_path_len = tree_height as usize - 2;
    let mut auth_path = Vec::with_capacity(auth_path_len);
    for _ in 0..auth_path_len {
        auth_path.push([F::zero(); N]);
    }

    Path {
        leaf_siblings: [F::zero(); N],
        auth_path,
        leaf_index: 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gadget::hashes::poseidon;
    use crate::gadget::merkle_tree::IdentityDigestConverter;
    use ark_crypto_primitives::sponge::poseidon::PoseidonConfig;
    use ark_std::{UniformRand, Zero, test_rng};

    type F = ark_bn254::Fr;
    type H = poseidon::PoseidonHash<F>;
    type NToOneH<const N: usize> = poseidon::NToOneCRH<N, F>;

    struct FieldMTConfig<const N: usize>;
    impl<const N: usize> Config<N> for FieldMTConfig<N> {
        type Leaf = [F];
        type LeafDigest = F;
        type LeafInnerDigestConverter = IdentityDigestConverter<F>;
        type InnerDigest = F;
        type LeafHash = H;
        type NToOneHash = NToOneH<N>;
    }

    #[test]
    fn test_get_mocking_merkle_tree_n_ary() {
        let tree_height: u64 = 5;
        let path: Path<4, FieldMTConfig<4>> = get_mocking_merkle_tree(tree_height);
        assert_eq!(path.auth_path.len(), (tree_height - 2) as usize);
        assert!(
            path.auth_path
                .iter()
                .all(|layer| layer.iter().all(|&x| x == F::zero()))
        );
    }

    #[test]
    fn test_get_test_path_n_ary() {
        use crate::gadget::hashes::poseidon::arkworks_parameters::bn254::poseidon_parameter_bn254_4_to_1;

        let mut rng = test_rng();
        let tree_height: u64 = 5;
        let leaf: F = F::rand(&mut rng);
        let params: PoseidonConfig<F> =
            poseidon_parameter_bn254_4_to_1::get_poseidon_parameters().into();
        let leaf_hash_params = params.clone();
        let n_to_one_params = params;

        let mut mock_path: Path<4, FieldMTConfig<4>> = get_mocking_merkle_tree(tree_height);
        mock_path.leaf_index = 42; // arbitrary index

        let (path, rt) = mock_path
            .get_test_path(&leaf_hash_params, &n_to_one_params, [leaf].borrow())
            .unwrap();

        assert!(
            path.verify(&leaf_hash_params, &n_to_one_params, &rt, [leaf])
                .unwrap()
        );
    }
}
