#![allow(clippy::needless_range_loop)]
//! # Index-Free n-ary Merkle Tree with OR-Constraints
//!
//! This module implements an n-ary Merkle tree with n children per node. It is specifically designed
//! for efficient membership proofs in ZKP circuits using **OR-constraints (One-of-n) instead of index bit operations**.
//!
//! ## Core Design (Index-Free Membership)
//!
//! Traditional binary Merkle trees store index bits (Boolean) indicating whether a node is on the "left" or "right"
//! and use select gadgets to choose the path. When extending to n-ary trees, these index bits grow to log₂(n),
//! making circuits more complex.
//!
//! We solve this as follows:
//!
//! 1. **Path Data:** Each layer includes the **full array of n input nodes** in the proof data (Path),
//!    not just siblings.
//! 2. **OR Constraint (One-of-n):**
//!    - The hash result H_prev from the previous layer must match exactly one element in the current layer's
//!      input array [D_0, D_1, ..., D_{n-1}].
//!    - Circuit formula: ∨_{i=0}^{n-1} (D_i == H_prev) = true
//! 3. **Hash Connection:** The verified n-element array is directly passed to the n-to-1 hash function
//!    to produce the parent layer's hash.
//!
//! ## Advantages
//!
//! - **Circuit Simplification:** No complex index bit decomposition or MUX (Multiplexer) logic needed.
//! - **Anonymity (Inherent Zero-Knowledge):** The circuit doesn't need to know "which index I am",
//!   providing zero-knowledge guarantees on the leaf index by default.
//! - **Poseidon Optimization:** Poseidon is efficient at wide arities, so using n=4, 8, 16 dramatically
//!   reduces tree depth.
//!
//! ## Downsides and Limitations
//!
//! - Current implementation only supports complete balanced trees where the number of leaves is a power of n (n^d).
//! - Since index information is embedded in hash results, explicit index extraction may not be feasible.

use ark_serialize::{CanonicalDeserialize, CanonicalSerialize};
use ark_std::borrow::Borrow;
use ark_std::hash::Hash;
use ark_std::vec::Vec;
use derivative::Derivative;

pub mod constraints;
pub mod mocking;

pub use crate::{
    Error,
    gadget::{
        hashes::{CRHScheme, NToOneCRHScheme},
        merkle_tree::{ByteDigestConverter, DigestConverter, IdentityDigestConverter},
    },
};

/// Merkle tree has two types of hashes.
/// * `LeafHash`: Convert leaf to leaf digest.
/// * `NToOneHash`: Convert N digests (leaf or inner) to one inner digest.
///
/// ### Architecture Note: LeafHash vs NToOneHash
/// It is highly recommended to use different hash functions or parameters for `LeafHash` and `NToOneHash`:
///
/// 1. **Constraint Optimization:** A `LeafHash` is typically a 1-to-1 hash. Using a heavy N-to-1 hash
///    (e.g., Poseidon with width N+1) for a single leaf input is computationally expensive in ZKP circuits.
///    Using a optimized 1-to-1 or 2-to-1 hash for leaves significantly reduces the number of constraints.
///
/// 2. **Security (Domain Separation):** Following standards like RFC-6962, using different hashes
///    (or different domain tags) prevents "second-preimage attacks" where an attacker could
///    otherwise present an inner node as a leaf. Distinct types or parameters ensure that
///    the output of a leaf hash can never be confused with the output of an inner node compression.
pub trait Config<const N: usize> {
    type Leaf: ?Sized;

    /// Leaf layer digest type.
    type LeafDigest: Clone
        + Eq
        + core::fmt::Debug
        + Hash
        + Default
        + CanonicalSerialize
        + CanonicalDeserialize;

    /// Transition between leaf layer to inner layer.
    type LeafInnerDigestConverter: DigestConverter<Self::LeafDigest, <Self::NToOneHash as NToOneCRHScheme<N>>::Input>;

    /// Inner layer digest type.
    type InnerDigest: Clone
        + Eq
        + core::fmt::Debug
        + Hash
        + Default
        + CanonicalSerialize
        + CanonicalDeserialize;

    /// leaf -> leaf digest.
    type LeafHash: CRHScheme<Input = Self::Leaf, Output = Self::LeafDigest>;
    /// N inner digests (or leaf digests) -> 1 inner digest.
    type NToOneHash: NToOneCRHScheme<N, Output = Self::InnerDigest>;
}

pub type NToOneParam<const N: usize, P> =
    <<P as Config<N>>::NToOneHash as NToOneCRHScheme<N>>::Parameters;
pub type LeafParam<const N: usize, P> = <<P as Config<N>>::LeafHash as CRHScheme>::Parameters;

/// Stores the hashes of a particular path from leaf to root.
///
/// For example, in a 3-ary tree (N=3):
/// ```tree_diagram
///          [Root]
///        /    |    \
///     [A]     B      C         <- InnerDigest (N-to-1)
///    / | \  / | \  / | \
///  [D]  E  F G  H  I J  K  L   <- InnerDigest (N-to-1)
/// / | \
/// M [N] O                      <- LeafDigest (results of 1-to-1 LeafHash)
/// |  |  |
/// m [n] o                      <- Raw Leaves (raw data)
/// ```
/// Suppose we want to prove leaf [n]:
/// 1. Hash(n) -> N (1-to-1 LeafHash)
/// 2. Check if N is in leaf_siblings [M, N, O]
/// 3. Hash([M, N, O]) -> D (N-to-1 NToOneHash)
/// 4. Check if D is in auth_path[1] [D, E, F]
/// 5. Hash([D, E, F]) -> A (N-to-1 NToOneHash)
/// 6. Check if A is in auth_path[0] [A, B, C]
/// 7. Hash([A, B, C]) -> Root
///
/// * `leaf_siblings` will be [M, N, O] (The leaf digests layer)
/// * `auth_path` will be [[A, B, C], [D, E, F]] (Ordered from higher level to lower level)
///
/// In this implementation, the authentication path includes the on-path nodes themselves
/// to facilitate index-free membership verification using OR-constraints.
///
/// **Note on Index Anonymity:**
/// Because membership is proven via OR-constraints (checking if a hash exists in a set
/// without specifying which one), this approach is inherently zero-knowledge regarding
/// the leaf index. However, this also means it is difficult to extract or reveal the
/// explicit leaf index from the circuit's constraints if needed for other logic.
#[derive(Derivative, CanonicalSerialize, CanonicalDeserialize)]
#[derivative(Clone(bound = "P: Config<N>"), Debug(bound = "P: Config<N>"))]
pub struct Path<const N: usize, P: Config<N>> {
    /// The siblings of leaf.
    pub leaf_siblings: [P::LeafDigest; N],
    /// The sibling of path node ordered from higher layer to lower layer (does not include root node).
    pub auth_path: Vec<[P::InnerDigest; N]>,
    /// stores the leaf index of the node.
    pub leaf_index: usize,
}

impl<const N: usize, P: Config<N>> Default for Path<N, P> {
    fn default() -> Self {
        Self {
            auth_path: Vec::new(),
            leaf_siblings: core::array::from_fn(|_| P::LeafDigest::default()),
            leaf_index: 0,
        }
    }
}

impl<const N: usize, P: Config<N>> Path<N, P> {
    /// Verify that a leaf is at `self.leaf_index` of the merkle tree.
    ///
    /// The verification works by:
    /// 1. Hashing the leaf and checking it exists in `leaf_siblings` at the expected position.
    /// 2. Hashing each level's N inputs and checking the result exists in the next level's inputs.
    /// 3. Finally comparing the computed root with the expected `root_hash`.
    pub fn verify<L: Borrow<P::Leaf>>(
        &self,
        leaf_hash_params: &LeafParam<N, P>,
        n_to_one_params: &NToOneParam<N, P>,
        root_hash: &P::InnerDigest,
        leaf: L,
    ) -> Result<bool, crate::Error> {
        // 1. Calculate leaf hash
        let claimed_leaf_hash = P::LeafHash::evaluate(leaf_hash_params, leaf)?;

        // 2. Check if claimed_leaf_hash exists in the leaf_siblings array (OR-style check)
        if !self.leaf_siblings.iter().any(|s| s == &claimed_leaf_hash) {
            return Ok(false);
        }

        // 3. Convert leaf level siblings to NToOneHash input type
        let converted_leaf_siblings: Vec<_> = self
            .leaf_siblings
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
        for level_auth in self.auth_path.iter().rev() {
            // Check if current hash exists in this level's inputs (OR-style check)
            if !level_auth.iter().any(|s| s == &curr_hash) {
                return Ok(false);
            }

            // Update curr_hash by hashing the N inputs of this level
            curr_hash = P::NToOneHash::compress(n_to_one_params, level_auth)?;
        }

        // 6. check if final hash is root
        Ok(&curr_hash == root_hash)
    }
}

/// Defines an N-ary merkle tree data structure.
/// This merkle tree has runtime fixed height, and assumes number of leaves is N^(height-1).
///
/// TODO: add RFC-6962 compatible merkle tree in the future.
/// For this release, padding will not be supported because of security concerns: if the leaf hash and N-to-one hash uses same underlying
/// CRH, a malicious prover can prove a leaf while the actual node is an inner node. In the future, we can prefix leaf hashes in different layers to
/// solve the problem.
#[derive(Derivative)]
#[derivative(Clone(bound = "P: Config<N>"))]
pub struct MerkleTree<const N: usize, P: Config<N>> {
    /// stores the non-leaf nodes in level order. The first element is the root node.
    /// The ith node's (starting at 0th) children are at indices `N*i + 1, ..., N*i + N`
    pub non_leaf_nodes: Vec<P::InnerDigest>,
    /// store the hash of leaf nodes from left to right
    pub leaf_nodes: Vec<P::LeafDigest>,
    /// Store the inner hash parameters
    pub n_to_one_hash_param: NToOneParam<N, P>,
    /// Store the leaf hash parameters
    pub leaf_hash_param: LeafParam<N, P>,
    /// Stores the height of the MerkleTree
    pub height: usize,
}

impl<const N: usize, P: Config<N>> MerkleTree<N, P> {
    /// Create an empty merkle tree such that all leaves are zero-filled.
    pub fn blank(
        leaf_hash_param: &LeafParam<N, P>,
        n_to_one_hash_param: &NToOneParam<N, P>,
        height: usize,
    ) -> Result<Self, crate::Error> {
        assert!(height > 0, "height must be at least 1");
        let num_leaves = N.pow((height - 1) as u32);
        let leaves_digest = vec![P::LeafDigest::default(); num_leaves];
        Self::new_with_leaf_digest(leaf_hash_param, n_to_one_hash_param, leaves_digest)
    }

    /// Returns a new n-ary merkle tree. `leaves.len()` should be a power of N.
    pub fn new<L: Borrow<P::Leaf>>(
        leaf_hash_param: &LeafParam<N, P>,
        n_to_one_hash_param: &NToOneParam<N, P>,
        leaves: impl IntoIterator<Item = L>,
    ) -> Result<Self, crate::Error> {
        let mut leaf_nodes = Vec::new();
        for leaf in leaves {
            leaf_nodes.push(P::LeafHash::evaluate(leaf_hash_param, leaf)?);
        }

        let leaf_nodes_size = leaf_nodes.len();
        assert!(leaf_nodes_size > 0, "Number of leaves cannot be zero");

        // Validate: Number of leaves must be a power of N (N^d)
        let mut temp_size = leaf_nodes_size;
        while temp_size > 1 {
            assert_eq!(
                temp_size % N,
                0,
                "Number of leaves ({}) must be a power of N ({})",
                leaf_nodes_size,
                N
            );
            temp_size /= N;
        }

        Self::new_with_leaf_digest(leaf_hash_param, n_to_one_hash_param, leaf_nodes)
    }

    pub fn set(
        non_leaf_nodes: Vec<P::InnerDigest>,
        leaf_nodes: Vec<P::LeafDigest>,
        height: usize,
        leaf_hash_param: LeafParam<N, P>,
        n_to_one_hash_param: NToOneParam<N, P>,
    ) -> Self {
        assert!(height > 0, "height must be at least 1");
        assert_eq!(
            leaf_nodes.len(),
            N.pow((height - 1) as u32),
            "Leaf count mismatch for height"
        );
        Self {
            non_leaf_nodes,
            leaf_nodes,
            height,
            leaf_hash_param,
            n_to_one_hash_param,
        }
    }

    /// Returns a new n-ary merkle tree. `leaf_nodes.len()` should be a power of N.
    pub fn new_with_leaf_digest(
        leaf_hash_param: &LeafParam<N, P>,
        n_to_one_hash_param: &NToOneParam<N, P>,
        leaf_nodes: Vec<P::LeafDigest>,
    ) -> Result<Self, crate::Error> {
        let leaf_nodes_size = leaf_nodes.len();
        assert!(leaf_nodes_size > 0, "Number of leaves cannot be zero");

        let mut temp_size = leaf_nodes_size;
        while temp_size > 1 {
            assert_eq!(temp_size % N, 0, "Number of leaves must be a power of N");
            temp_size /= N;
        }

        let tree_height = n_ary_tree_height(leaf_nodes_size, N);

        // Fill from bottom up
        let mut current_level_hashes: Vec<P::InnerDigest> = Vec::with_capacity(leaf_nodes_size / N);

        // First level above leaves (evaluate)
        for i in 0..(leaf_nodes_size / N) {
            let inputs: [P::LeafDigest; N] =
                core::array::from_fn(|j| leaf_nodes[i * N + j].clone());
            let converted_inputs: Vec<_> = inputs
                .iter()
                .cloned()
                .map(|node| P::LeafInnerDigestConverter::convert(node))
                .collect::<Result<Vec<_>, _>>()?;
            let inputs_array: [_; N] = converted_inputs
                .try_into()
                .map_err(|_| anyhow::anyhow!("Conversion failed"))?;

            current_level_hashes.push(P::NToOneHash::evaluate(n_to_one_hash_param, &inputs_array)?);
        }

        // compute the hash values for nodes in every other layer in the tree
        let mut all_non_leaf_levels = vec![current_level_hashes.clone()];
        while current_level_hashes.len() > 1 {
            let next_level_size = current_level_hashes.len() / N;
            let mut next_level_hashes = Vec::with_capacity(next_level_size);
            for i in 0..next_level_size {
                let inputs: [P::InnerDigest; N] =
                    core::array::from_fn(|j| current_level_hashes[i * N + j].clone());
                next_level_hashes.push(P::NToOneHash::compress(n_to_one_hash_param, &inputs)?);
            }
            current_level_hashes = next_level_hashes;
            all_non_leaf_levels.push(current_level_hashes.clone());
        }

        all_non_leaf_levels.reverse();
        let mut flat_non_leaf = Vec::new();
        for level in all_non_leaf_levels {
            flat_non_leaf.extend(level);
        }

        Ok(MerkleTree {
            leaf_nodes,
            non_leaf_nodes: flat_non_leaf,
            n_to_one_hash_param: n_to_one_hash_param.clone(),
            leaf_hash_param: leaf_hash_param.clone(),
            height: tree_height,
        })
    }

    pub fn root(&self) -> P::InnerDigest {
        self.non_leaf_nodes[0].clone()
    }

    pub fn height(&self) -> usize {
        self.height
    }

    pub fn generate_proof(&self, index: usize) -> Result<Path<N, P>, crate::Error> {
        let mut auth_path = Vec::new();
        let leaf_level_start = (index / N) * N;
        let leaf_siblings: [P::LeafDigest; N] =
            core::array::from_fn(|i| self.leaf_nodes[leaf_level_start + i].clone());

        let mut current_index = index / N;
        let mut level_size = self.leaf_nodes.len() / N;
        let mut offset = self.non_leaf_nodes.len() - level_size;

        while level_size > 1 {
            let level_start = (current_index / N) * N;
            let level_auth: [P::InnerDigest; N] =
                core::array::from_fn(|i| self.non_leaf_nodes[offset + level_start + i].clone());
            auth_path.push(level_auth);

            current_index /= N;
            level_size /= N;
            if level_size > 0 {
                offset -= level_size;
            }
        }

        auth_path.reverse();

        Ok(Path {
            leaf_siblings,
            auth_path,
            leaf_index: index,
        })
    }
}

#[inline]
fn n_ary_tree_height(num_leaves: usize, n: usize) -> usize {
    if num_leaves <= 1 {
        return 1;
    }
    let mut height = 1;
    let mut temp = num_leaves;
    while temp > 1 {
        temp /= n;
        height += 1;
    }
    height
}
