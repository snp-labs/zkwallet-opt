pub mod arkworks_parameters;
pub mod constraints;

use crate::{
    Error,
    gadget::hashes::{
        CRHScheme, NToOneCRHScheme, TwoToOneCRHScheme, poseidon::arkworks_parameters::unflatten_vec,
    },
};
use ark_crypto_primitives::sponge::poseidon::{PoseidonConfig, PoseidonSponge};
use ark_crypto_primitives::sponge::{Absorb, CryptographicSponge};
use ark_ff::PrimeField;
use ark_serialize::{CanonicalDeserialize, CanonicalSerialize};
use ark_std::{borrow::Borrow, marker::PhantomData};

// PoseidonConfig <-> Sage 변수 매핑
// Sage code 출처: https://extgit.isec.tugraz.at/krypto/hadeshash
//
// # 라운드 설정
// full_rounds:    R_F_FIXED       // Full-round 개수
// partial_rounds: R_P_FIXED       // Partial-round 개수
//
// # S-box 및 상태 크기 설정
// alpha:          ALPHA           // S-box 지수
// t:              NUM_CELLS       // Width; 전체 상태(State)의 크기 (rate + capacity)
// rate:           NUM_CELLS - 1   // Rate; 한 번에 흡수(Absorb)하는 데이터의 개수; n-to-1 머클트리에는 rate로 n 사용
// capacity:       1               // Capacity; 보안을 위해 예약된 상태의 크기
// 일반적으로 Security level은 capacity * (field_size_bits / 2) -> 256비트 field의 경우 capacity=1 하면 128bit security
//
// # 파라미터 행렬
// ark:            round_constants // 라운드 상수
// mds:            linear_layer    // MDS 행렬

// curve에 따라 달라지는 Poseidon parameter를 PoseidonConfig<F>로 변환하기 위한 중간 구조체
pub struct PoseidonParameters<F: PrimeField> {
    pub full_rounds: usize,
    pub partial_rounds: usize,
    pub alpha: u64,
    pub ark: Vec<F>,
    pub mds: Vec<F>,
    pub rate: usize,
    pub capacity: usize,
}

impl<F: PrimeField> Into<PoseidonConfig<F>> for PoseidonParameters<F> {
    fn into(self) -> PoseidonConfig<F> {
        let ark_num_rows = self.full_rounds + self.partial_rounds;
        let ark_num_cols = self.rate + 1; // t
        let t = ark_num_cols;

        let ark: Vec<Vec<F>> = unflatten_vec(self.ark, ark_num_rows, ark_num_cols);
        let mds: Vec<Vec<F>> = unflatten_vec(self.mds, t, t);

        PoseidonConfig::<F>::new(
            self.full_rounds,
            self.partial_rounds,
            self.alpha,
            mds,
            ark,
            self.rate,
            self.capacity,
        )
    }
}

pub struct PoseidonHash<F: PrimeField + Absorb> {
    field_phantom: PhantomData<F>,
}

impl<F: PrimeField + Absorb> CRHScheme for PoseidonHash<F> {
    type Input = [F];
    type Output = F;
    type Parameters = PoseidonConfig<F>;

    // fn setup<R: Rng>(_rng: &mut R) -> Result<Self::Parameters, Error> {
    //     // automatic generation of parameters are not implemented yet
    //     // therefore, the developers must specify the parameters themselves
    //     unimplemented!()
    // }

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        input: T,
    ) -> Result<Self::Output, Error> {
        let input = input.borrow();

        let mut sponge = PoseidonSponge::new(parameters);
        sponge.absorb(&input);
        let res = sponge.squeeze_field_elements::<F>(1);
        Ok(res[0])
    }
}

#[derive(Clone, Debug, PartialEq, CanonicalSerialize, CanonicalDeserialize)]
pub struct PoseidonHashOutputWrapper<F: PrimeField>(pub <PoseidonHash<F> as CRHScheme>::Output)
where
    F: PrimeField + Absorb;

impl<F> From<<PoseidonHash<F> as CRHScheme>::Output> for PoseidonHashOutputWrapper<F>
where
    F: PrimeField + Absorb,
{
    fn from(value: <PoseidonHash<F> as CRHScheme>::Output) -> Self {
        Self(value)
    }
}

pub struct TwoToOneCRH<F: PrimeField + Absorb> {
    field_phantom: PhantomData<F>,
}

impl<F: PrimeField + Absorb> TwoToOneCRHScheme for TwoToOneCRH<F> {
    type Input = F;
    type Output = F;
    type Parameters = PoseidonConfig<F>;

    // fn setup<R: Rng>(_rng: &mut R) -> Result<Self::Parameters, Error> {
    //     // automatic generation of parameters are not implemented yet
    //     // therefore, the developers must specify the parameters themselves
    //     unimplemented!()
    // }

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        left_input: T,
        right_input: T,
    ) -> Result<Self::Output, Error> {
        Self::compress(parameters, left_input, right_input)
    }

    fn compress<T: Borrow<Self::Output>>(
        parameters: &Self::Parameters,
        left_input: T,
        right_input: T,
    ) -> Result<Self::Output, Error> {
        let left_input = left_input.borrow();
        let right_input = right_input.borrow();

        let mut sponge = PoseidonSponge::new(parameters);
        sponge.absorb(left_input);
        sponge.absorb(right_input);
        let res = sponge.squeeze_field_elements::<F>(1);
        Ok(res[0])
    }
}

pub struct NToOneCRH<const N: usize, F: PrimeField + Absorb> {
    field_phantom: PhantomData<F>,
}

impl<const N: usize, F: PrimeField + Absorb> NToOneCRHScheme<N> for NToOneCRH<N, F> {
    type Input = F;
    type Output = F;
    type Parameters = PoseidonConfig<F>;

    fn evaluate<T: Borrow<Self::Input>>(
        parameters: &Self::Parameters,
        inputs: &[T; N],
    ) -> Result<Self::Output, Error> {
        Self::compress(parameters, inputs)
    }

    fn compress<T: Borrow<Self::Output>>(
        parameters: &Self::Parameters,
        inputs: &[T; N],
    ) -> Result<Self::Output, Error> {
        let mut sponge = PoseidonSponge::new(parameters);
        for input in inputs {
            sponge.absorb(input.borrow());
        }
        let res = sponge.squeeze_field_elements::<F>(1);
        Ok(res[0])
    }
}
