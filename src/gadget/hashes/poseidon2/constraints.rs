// Poseidon2 R1CS Constraint Implementation
//
// 이 모듈은 native Poseidon2Sponge (sponge.rs)와 동일한 동작을 FpVar 위에서 구현한다.
//
// ## Sponge 구조 (t=3, rate=2, capacity=1 기준)
//
//   state = [capacity(state[0]) | rate(state[1], state[2])]
//
//   absorb 단계:
//     - 입력을 rate 섹션(state[1..])에 하나씩 더함
//     - rate가 꽉 차면 permutation 호출 후 absorb index 리셋
//   squeeze 단계:
//     - absorbing 모드에서 squeezing으로 전환 시 permutation 1회 추가 호출
//     - state[1] (첫 번째 rate 원소) 반환
//
//   1개 입력: absorb → (rate 미달, 내부 permute 없음) → squeeze permute → state[1]  (permute 1회)
//   2개 입력: absorb → (rate 채워져 permute) → squeeze permute → state[1]            (permute 2회)
//
// ## native와의 대응
//   이 파일의 각 gadget은 mod.rs의 native CRH impl과 동일한 결과를 내야 한다.
//   - Poseidon2CRHGadget      ↔ Poseidon2Hash::evaluate()
//   - Poseidon2TwoToOneCRHGadget ↔ Poseidon2TwoToOneCRH::compress()
//   - Poseidon2NToOneCRHGadget   ↔ Poseidon2NToOneCRH::compress()

use ark_ff::PrimeField;
use ark_r1cs_std::{
    R1CSVar,
    alloc::{AllocVar, AllocationMode},
    fields::{fp::FpVar, FieldVar},
};
use ark_relations::r1cs::{ConstraintSystemRef, Namespace, SynthesisError};
use ark_std::borrow::Borrow;
use ark_std::marker::PhantomData;
use ark_std::vec::Vec;

use crate::gadget::hashes::constraints::{
    CRHSchemeGadget, NToOneCRHSchemeGadget, TwoToOneCRHSchemeGadget,
};
use crate::gadget::hashes::{CRHScheme, NToOneCRHScheme, TwoToOneCRHScheme};
use super::{
    params::Poseidon2Params, Poseidon2Hash, Poseidon2NToOneCRH, Poseidon2TwoToOneCRH,
};

// =============================================================================
// Parameters variable
// =============================================================================

/// 파라미터 변수. 항상 상수(Constant)로 할당되어 회로 변수를 소비하지 않는다.
#[derive(Clone)]
pub struct Poseidon2ParametersVar<F: PrimeField> {
    pub parameters: Poseidon2Params<F>,
}

impl<F: PrimeField> AllocVar<Poseidon2Params<F>, F> for Poseidon2ParametersVar<F> {
    fn new_variable<T: Borrow<Poseidon2Params<F>>>(
        _cs: impl Into<Namespace<F>>,
        f: impl FnOnce() -> Result<T, SynthesisError>,
        _mode: AllocationMode,
    ) -> Result<Self, SynthesisError> {
        let params = f()?.borrow().clone();
        Ok(Poseidon2ParametersVar { parameters: params })
    }
}

// =============================================================================
// CRH gadget (variable-length input)
// =============================================================================

/// Poseidon2 CRH 가젯
pub struct Poseidon2CRHGadget<F: PrimeField> {
    field_phantom: PhantomData<F>,
}

impl<F: PrimeField> CRHSchemeGadget<Poseidon2Hash<F>, F> for Poseidon2CRHGadget<F> {
    type InputVar = [FpVar<F>];
    type OutputVar = FpVar<F>;
    type ParametersVar = Poseidon2ParametersVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        input: &Self::InputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        let cs = input.cs();

        if cs.is_none() {
            // 모든 입력이 Constant → native fallback (제약 없음)
            let vals = input
                .iter()
                .map(|v| v.value())
                .collect::<Result<Vec<F>, _>>()?;
            return Ok(FpVar::Constant(
                Poseidon2Hash::<F>::evaluate(&parameters.parameters, vals.as_slice())
                    .map_err(|_| SynthesisError::AssignmentMissing)?,
            ));
        }

        // Witness 포함 → sponge 가젯 실행
        Self::sponge_evaluate(cs, input, &parameters.parameters)
    }
}

impl<F: PrimeField> Poseidon2CRHGadget<F> {
    /// Sponge absorb + squeeze 가젯.
    ///
    /// native Poseidon2Sponge::absorb(input) → squeeze_field_elements(1) 를 FpVar로 구현.
    ///
    /// 동작:
    ///   1. state = [0; t] 로 초기화
    ///   2. 각 입력을 rate 섹션(state[1 + idx])에 더함
    ///   3. rate가 꽉 차면 permutation 호출 후 idx 리셋
    ///   4. 루프 종료 후 permutation 1회 더 호출 (absorbing → squeezing 전환)
    ///   5. state[1] 반환
    fn sponge_evaluate(
        cs: ConstraintSystemRef<F>,
        input: &[FpVar<F>],
        params: &Poseidon2Params<F>,
    ) -> Result<FpVar<F>, SynthesisError> {
        let t = params.t;
        let rate = t - 1; // capacity = 1, rate = t-1

        // state 초기화: capacity(state[0]) + rate(state[1..t]) 모두 0
        let mut state = vec![FpVar::Constant(F::zero()); t];
        let mut absorb_index: usize = 0;

        for elem in input.iter() {
            // rate 섹션에 원소 추가 (capacity = state[0] 는 건드리지 않음)
            let idx = 1 + absorb_index;
            state[idx] = &state[idx] + elem;
            absorb_index += 1;

            // rate가 꽉 찼으면 permutation 적용 후 index 리셋
            // (native: if next_idx >= rate { self.permute(); ... })
            if absorb_index >= rate {
                Self::permutation_gadget(cs.clone(), &mut state, params)?;
                absorb_index = 0;
            }
        }

        // absorbing → squeezing 전환 시 permutation 1회 추가
        // (native: if let Absorbing { .. } = self.mode { self.permute(); })
        Self::permutation_gadget(cs.clone(), &mut state, params)?;

        // 첫 번째 rate 원소 반환
        // (native: result.push(self.state[1 + next_squeeze_index]); // next_squeeze_index = 0)
        Ok(state[1].clone())
    }

    // -------------------------------------------------------------------------
    // Permutation gadget
    // -------------------------------------------------------------------------

    /// Poseidon2 순열 가젯 (in-place).
    ///
    /// 구조:
    ///   initial_linear_layer (matmul_external)
    ///   RF/2 full rounds:   add_rc_full → sbox_full → matmul_external
    ///   RP  partial rounds: add_rc[0]   → sbox_p    → matmul_internal
    ///   RF/2 full rounds:   add_rc_full → sbox_full → matmul_external
    pub(crate) fn permutation_gadget(
        _cs: ConstraintSystemRef<F>,
        state: &mut [FpVar<F>],
        params: &Poseidon2Params<F>,
    ) -> Result<(), SynthesisError> {
        let t = params.t;
        let rf_begin = params.rounds_f_beginning;
        let rp = params.rounds_p;
        let rf_end = params.rounds_f_end;

        // Initial linear layer (Poseidon2에서 필수, Poseidon v1에는 없음)
        Self::matmul_external_gadget(state, t)?;

        // Full rounds (첫 번째 절반)
        for r in 0..rf_begin {
            Self::add_rc_full_gadget(state, &params.round_constants[r])?;
            Self::sbox_full_gadget(state, params.d)?;
            Self::matmul_external_gadget(state, t)?;
        }

        // Partial rounds (state[0]에만 S-box 적용)
        for r in rf_begin..(rf_begin + rp) {
            // round constant는 state[0]에만
            state[0] += FpVar::Constant(params.round_constants[r][0]);
            state[0] = Self::sbox_p_gadget(&state[0], params.d)?;
            Self::matmul_internal_gadget(state, &params.mat_internal_diag_m_1)?;
        }

        // Full rounds (두 번째 절반)
        for r in (rf_begin + rp)..(rf_begin + rp + rf_end) {
            Self::add_rc_full_gadget(state, &params.round_constants[r])?;
            Self::sbox_full_gadget(state, params.d)?;
            Self::matmul_external_gadget(state, t)?;
        }

        Ok(())
    }

    // -------------------------------------------------------------------------
    // Round operation helpers
    // -------------------------------------------------------------------------

    /// 모든 state 원소에 round constant 더하기 (full round)
    fn add_rc_full_gadget(state: &mut [FpVar<F>], rc: &[F]) -> Result<(), SynthesisError> {
        for (s, &c) in state.iter_mut().zip(rc.iter()) {
            *s += FpVar::Constant(c);
        }
        Ok(())
    }

    /// 모든 state 원소에 S-box 적용 (full round)
    fn sbox_full_gadget(state: &mut [FpVar<F>], d: usize) -> Result<(), SynthesisError> {
        for elem in state.iter_mut() {
            *elem = Self::sbox_p_gadget(elem, d)?;
        }
        Ok(())
    }

    /// 단일 원소에 S-box 적용: x^d
    ///
    /// 각 경우의 제약 수:
    ///   d=3: x^2 (1 constraint) + x^2 * x (1 constraint) = 2 constraints
    ///   d=5: x^2 (1) + x^4 (1) + x^4 * x (1) = 3 constraints
    ///   d=7: x^2 (1) + x^4 (1) + x^4 * x^2 (1) + x^6 * x (1) = 4 constraints
    fn sbox_p_gadget(x: &FpVar<F>, d: usize) -> Result<FpVar<F>, SynthesisError> {
        match d {
            3 => {
                let x2 = x.square()?;
                Ok(x2 * x)
            }
            5 => {
                let x2 = x.square()?;
                let x4 = x2.square()?;
                Ok(x4 * x)
            }
            7 => {
                let x2 = x.square()?;
                let x4 = x2.square()?;
                let x6 = x4 * &x2;
                Ok(x6 * x)
            }
            _ => Err(SynthesisError::AssignmentMissing),
        }
    }

    // -------------------------------------------------------------------------
    // Matrix helpers
    // -------------------------------------------------------------------------

    /// 외부 행렬 곱셈 (circulant M_E)
    ///
    /// t=2,3: 고정된 circulant 행렬 직접 계산
    /// t=4,8,...: M4 반복 적용
    fn matmul_external_gadget(state: &mut [FpVar<F>], t: usize) -> Result<(), SynthesisError> {
        match t {
            2 => {
                // Native matmul_external for t=2:
                // sum = x0 + x1
                // y0 = x0 + sum = 2*x0 + x1
                // y1 = x0 + x1 + sum = 2*x0 + 2*x1
                let sum = &state[0] + &state[1];
                let x0 = state[0].clone();
                let x1 = state[1].clone();
                state[0] = &x0 + &sum;
                state[1] = &x0 + &x1 + &sum;
            }
            3 => {
                // M_E = circ(2, 1, 1) = [[2,1,1],[1,2,1],[1,1,2]]
                // yi = xi + (x0+x1+x2)
                let sum = &state[0] + &state[1] + &state[2];
                let x0 = state[0].clone();
                let x1 = state[1].clone();
                let x2 = state[2].clone();
                state[0] = &x0 + &sum;
                state[1] = &x1 + &sum;
                state[2] = &x2 + &sum;
            }
            4 | 8 | 12 | 16 | 20 | 24 => {
                // 각 4-원소 블록에 M4 적용
                Self::matmul_m4_gadget(state)?;
                // t > 4 인 경우: 블록 간 교차 합산 (cheap second matrix)
                if t > 4 {
                    let t4 = t / 4;
                    // 각 위치 l(0..4)에 대해 모든 블록의 l번째 원소 합산
                    let mut stored = vec![FpVar::Constant(F::zero()); 4];
                    for l in 0..4 {
                        stored[l] = state[l].clone();
                        for j in 1..t4 {
                            stored[l] += &state[4 * j + l];
                        }
                    }
                    // 각 원소에 해당 위치의 합산값 더하기
                    for i in 0..t {
                        state[i] += &stored[i % 4];
                    }
                }
            }
            _ => return Err(SynthesisError::AssignmentMissing),
        }
        Ok(())
    }

    /// M4 행렬 곱셈 (4-원소 블록 단위)
    ///
    /// M4 = [[2,1,1,1],[1,2,1,1],[1,1,2,1],[1,1,1,2]] 의 최적화 버전
    /// native sponge.rs의 M4 구현과 동일한 덧셈/배가 순서를 따른다.
    fn matmul_m4_gadget(state: &mut [FpVar<F>]) -> Result<(), SynthesisError> {
        let num_blocks = state.len() / 4;
        for b in 0..num_blocks {
            let s = b * 4;

            // t0 = x0 + x1
            let mut t0 = state[s].clone();
            t0 += &state[s + 1];

            // t1 = x2 + x3
            let mut t1 = state[s + 2].clone();
            t1 += &state[s + 3];

            // t2 = 2*x1 + t1
            let mut t2 = state[s + 1].clone();
            t2 = t2.double()? + &t1;

            // t3 = 2*x3 + t0
            let mut t3 = state[s + 3].clone();
            t3 = t3.double()? + &t0;

            // t4 = 4*t1 + t3
            let mut t4 = t1.clone();
            t4 = t4.double()?.double()? + &t3;

            // t5 = 4*t0 + t2
            let mut t5 = t0.clone();
            t5 = t5.double()?.double()? + &t2;

            // t6 = t3 + t5
            let mut t6 = t3.clone();
            t6 += &t5;

            // t7 = t2 + t4
            let mut t7 = t2.clone();
            t7 += &t4;

            state[s] = t6;
            state[s + 1] = t5;
            state[s + 2] = t7;
            state[s + 3] = t4;
        }
        Ok(())
    }

    /// 내부 행렬 곱셈 (diagonal M_I)
    ///
    /// M_I[i,j] = { μ_i if i==j, 1 otherwise }
    /// 최적화: y_i = (μ_i - 1) * x_i + Σ x_j
    ///
    /// 주의: mat_internal_diag_m_1[i] = μ_i - 1 (이미 1을 뺀 값으로 저장됨)
    ///       여기에 1을 다시 더하지 말 것 — 그럼 y_i = 2*(μ_i-1)*x_i + sum 이 되어 KAT 불일치
    fn matmul_internal_gadget(
        state: &mut [FpVar<F>],
        mat_internal_diag_m_1: &[F],
    ) -> Result<(), SynthesisError> {
        let t = state.len();

        // sum = Σ x_i (원본 state 기준으로 미리 계산)
        let mut sum = state[0].clone();
        for i in 1..t {
            sum += &state[i];
        }

        // y_i = (μ_i - 1) * x_i + sum
        // 루프 순서와 무관하게 각 state[i]는 독립적으로 갱신 가능:
        // - sum은 미리 계산된 상수 (FpVar이지만 이 루프에서 변하지 않음)
        // - &state[i]는 해당 반복에서 원본 값을 읽은 뒤 덮어씀
        for i in 0..t {
            state[i] = &state[i] * FpVar::Constant(mat_internal_diag_m_1[i]) + &sum;
        }

        Ok(())
    }
}

// =============================================================================
// TwoToOneCRH gadget
// =============================================================================

/// Poseidon2 TwoToOneCRH 가젯
///
/// compress(left, right) = permutation_gadget([left, right])[0] + left  (Davies-Meyer)
/// = native Poseidon2TwoToOneCRH::compress()와 동일
/// t=2 파라미터 필요.
pub struct Poseidon2TwoToOneCRHGadget<F: PrimeField> {
    field_phantom: PhantomData<F>,
}

impl<F: PrimeField> TwoToOneCRHSchemeGadget<Poseidon2TwoToOneCRH<F>, F>
    for Poseidon2TwoToOneCRHGadget<F>
{
    type InputVar = FpVar<F>;
    type OutputVar = FpVar<F>;
    type ParametersVar = Poseidon2ParametersVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        left_input: &Self::InputVar,
        right_input: &Self::InputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        Self::compress(parameters, left_input, right_input)
    }

    fn compress(
        parameters: &Self::ParametersVar,
        left_input: &Self::OutputVar,
        right_input: &Self::OutputVar,
    ) -> Result<Self::OutputVar, SynthesisError> {
        // left 또는 right 중 constraint system이 있는 것 선택
        let cs = left_input.cs().or(right_input.cs());

        if cs.is_none() {
            // 모두 Constant → native fallback
            let left = left_input.value()?;
            let right = right_input.value()?;
            return Ok(FpVar::Constant(
                Poseidon2TwoToOneCRH::<F>::compress(&parameters.parameters, &left, &right)
                    .map_err(|_| SynthesisError::AssignmentMissing)?,
            ));
        }

        // Davies-Meyer: C(left, right) = P([left, right])[0] + left
        let left_orig = left_input.clone();
        let mut state = [left_input.clone(), right_input.clone()];
        Poseidon2CRHGadget::<F>::permutation_gadget(cs, &mut state, &parameters.parameters)?;
        Ok(&state[0] + &left_orig)
    }
}

// =============================================================================
// NToOneCRH gadget
// =============================================================================

/// Poseidon2 NToOneCRH 가젯
///
/// compress(inputs) = permutation_gadget(inputs)[0] + inputs[0]  (Davies-Meyer)
/// = native Poseidon2NToOneCRH::compress()와 동일
/// t=N 파라미터 필요.
pub struct Poseidon2NToOneCRHGadget<const N: usize, F: PrimeField> {
    field_phantom: PhantomData<F>,
}

impl<const N: usize, F: PrimeField> NToOneCRHSchemeGadget<N, Poseidon2NToOneCRH<N, F>, F>
    for Poseidon2NToOneCRHGadget<N, F>
{
    type InputVar = FpVar<F>;
    type OutputVar = FpVar<F>;
    type ParametersVar = Poseidon2ParametersVar<F>;

    fn evaluate(
        parameters: &Self::ParametersVar,
        inputs: &[Self::InputVar; N],
    ) -> Result<Self::OutputVar, SynthesisError> {
        Self::compress(parameters, inputs)
    }

    fn compress(
        parameters: &Self::ParametersVar,
        inputs: &[Self::OutputVar; N],
    ) -> Result<Self::OutputVar, SynthesisError> {
        // 첫 번째로 발견되는 non-None constraint system 사용
        let cs = inputs
            .iter()
            .map(|v| v.cs())
            .find(|cs| !cs.is_none())
            .unwrap_or(ConstraintSystemRef::None);

        if cs.is_none() {
            // 모두 Constant → native fallback
            let vals = inputs
                .iter()
                .map(|v| v.value())
                .collect::<Result<Vec<F>, _>>()?;
            let arr: [F; N] = vals
                .try_into()
                .map_err(|_| SynthesisError::AssignmentMissing)?;
            return Ok(FpVar::Constant(
                Poseidon2NToOneCRH::<N, F>::compress(&parameters.parameters, &arr)
                    .map_err(|_| SynthesisError::AssignmentMissing)?,
            ));
        }

        // Davies-Meyer: C(inputs) = P(inputs)[0] + inputs[0]
        let input0 = inputs[0].clone();
        let mut state: Vec<FpVar<F>> = inputs.to_vec();
        Poseidon2CRHGadget::<F>::permutation_gadget(cs, &mut state, &parameters.parameters)?;
        Ok(&state[0] + &input0)
    }
}
