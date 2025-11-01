use anchor_lang::prelude::*;

#[account]
pub struct Empty {}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct InitParams {
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub bids_capacity: u32,
    pub asks_capacity: u32,
    pub event_queue_capacity: u32,
    pub tick_size: u64,
    pub min_base_qty: u64,
    pub fees_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Profile {
    pub bids_capacity: u32,
    pub asks_capacity: u32,
    pub event_queue_capacity: u32,
    pub tick_size: u64,
    pub min_base_qty: u64,
    pub fees_bps: u16,
}

pub mod profiles {
    use super::Profile;
    pub const LITE: Profile = Profile {
        bids_capacity: 1024,
        asks_capacity: 1024,
        event_queue_capacity: 512,
        tick_size: 10_000,
        min_base_qty: 100,
        fees_bps: 10,
    };
    pub const STD: Profile = Profile {
        bids_capacity: 4096,
        asks_capacity: 4096,
        event_queue_capacity: 2048,
        tick_size: 1_000,
        min_base_qty: 50,
        fees_bps: 10,
    };
    pub const DEEP: Profile = Profile {
        bids_capacity: 8192,
        asks_capacity: 8192,
        event_queue_capacity: 4096,
        tick_size: 100,
        min_base_qty: 10,
        fees_bps: 8,
    };
}

pub mod sizing {
    pub const DISCRIMINATOR: usize = 8;
    pub const MARKET_HEADER: usize = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 2 + 1 + 1 + 1 + 1 + 4 + 4 + 4 + 1;
    pub const BLOB_HEADER: usize = 4 + 1 + 4 + 4;
    pub const SLAB_HEADER: usize = 24;
    pub const SLAB_NODE: usize = 80;
    pub const EVENT_EST: usize = 48;

    pub fn market_space() -> usize {
        DISCRIMINATOR + MARKET_HEADER
    }

    pub fn bids_space(capacity: u32) -> usize {
        BLOB_HEADER + SLAB_HEADER + (capacity as usize) * SLAB_NODE
    }

    pub fn asks_space(capacity: u32) -> usize {
        BLOB_HEADER + SLAB_HEADER + (capacity as usize) * SLAB_NODE
    }

    pub fn eventq_space(capacity: u32) -> usize {
        BLOB_HEADER + (capacity as usize) * EVENT_EST
    }

    pub fn total_market_space(bids_cap: u32, asks_cap: u32, evq_cap: u32) -> usize {
        market_space() + bids_space(bids_cap) + asks_space(asks_cap) + eventq_space(evq_cap)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BlobKind {
    Bids = 1,
    Asks = 2,
    EventQueue = 3,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct GrowParams {
    pub which: u8,
    pub step_bytes: u32,
}
