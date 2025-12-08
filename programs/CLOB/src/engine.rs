use anchor_lang::prelude::*;

pub trait MatchingEngine {
    fn validate_tick(&self, tick_size: u64, price_ticks: u64) -> Result<()>;
    fn validate_min_qty(&self, min_base_qty: u64, base_qty: u64) -> Result<()>;
}

pub struct BinaryClobEngine;

impl MatchingEngine for BinaryClobEngine {
    fn validate_tick(&self, tick_size: u64, price_ticks: u64) -> Result<()> {
        require!(tick_size > 0 && price_ticks > 0, KerdosError::InvalidTick);
        Ok(())
    }

    fn validate_min_qty(&self, min_base_qty: u64, base_qty: u64) -> Result<()> {
        require!(base_qty >= min_base_qty, KerdosError::TooSmallQty);
        Ok(())
    }
}

#[error_code]
pub enum KerdosError {
    #[msg("invalid tick")]
    InvalidTick,
    #[msg("quantity below minimum")]
    TooSmallQty,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ticks_ok() {
        let e = BinaryClobEngine;
        assert!(e.validate_tick(1, 1).is_ok());
        assert!(e.validate_tick(10, 5).is_ok());
    }

    #[test]
    fn ticks_err() {
        let e = BinaryClobEngine;
        assert!(e.validate_tick(0, 1).is_err());
        assert!(e.validate_tick(1, 0).is_err());
    }

    #[test]
    fn min_qty_ok_err() {
        let e = BinaryClobEngine;
        assert!(e.validate_min_qty(10, 10).is_ok());
        assert!(e.validate_min_qty(10, 11).is_ok());
        assert!(e.validate_min_qty(10, 9).is_err());
    }
}
