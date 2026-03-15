pub mod bn254_2_to_1; // t=3, KAT 테스트용 (permutation 검증)
pub mod bn254_t2;    // t=2,  compression 2-to-1
pub mod bn254_t4;    // t=4,  compression 4-to-1
pub mod bn254_t8;    // t=8,  compression 8-to-1
pub mod bn254_t16;   // t=16, compression 16-to-1

// KAT / permutation 테스트에서 사용
pub use bn254_2_to_1::get_poseidon2_bn254_params;

// Compression mode 파라미터
pub use bn254_t2::get_poseidon2_bn254_t2_params;
pub use bn254_t4::get_poseidon2_bn254_t4_params;
pub use bn254_t8::get_poseidon2_bn254_t8_params;
pub use bn254_t16::get_poseidon2_bn254_t16_params;
