use anchor_lang::prelude::*;

pub const BLOB_MAGIC: u32 = 0x4B_45_52_44;

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    pub bids: Pubkey,
    pub asks: Pubkey,
    pub event_queue: Pubkey,
    pub tick_size: u64,
    pub min_base_qty: u64,
    pub fees_bps: u16,
    pub paused: bool,
    pub bump_market: u8,
    pub bump_bids: u8,
    pub bump_asks: u8,
    pub bump_eventq: u8,
    pub bids_capacity: u32,
    pub asks_capacity: u32,
    pub eventq_capacity: u32,
    pub fees_accrued: u64,
}

impl Market {
    pub const LEN: usize = 8
        + 32 + 32 + 32 + 32 + 32 + 32
        + 8 + 8 + 2 + 1
        + 1 + 1 + 1 + 1
        + 4 + 4 + 4
        + 8;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Blob {
    pub magic: u32,
    pub kind: u8,
    pub capacity: u32,
    pub used: u32,
}
impl Blob {
    pub const LEN: usize = 4 + 1 + 4 + 4;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct OrderEntry {
    pub oo: Pubkey,
    pub price_ticks: u64,
    pub base_qty: u64,
    pub ts: u64,
    pub flags: u8,
    pub pad: [u8; 7],
}
impl OrderEntry {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 1 + 7;
}

#[repr(C)]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default)]
pub struct FillEvent {
    pub maker_oo: Pubkey,
    pub taker_oo: Pubkey,
    pub base_qty: u64,
    pub price_ticks: u32,
    pub taker_side: u8,
    pub pad: [u8; 3],
}
impl FillEvent {
    pub const LEN: usize = 32 + 32 + 8 + 4 + 1 + 3;
}

#[account]
pub struct OpenOrdersLite {
    pub user: Pubkey,
    pub market: Pubkey,
    pub locked_lamports: u64,
    pub price_ticks: u64,
    pub base_qty: u64,
    pub side: u8,
    pub active: bool,
    pub bump: u8,
    pub pad: [u8; 5],
}
impl OpenOrdersLite {
    pub const LEN: usize = 8
        + 32 + 32
        + 8 + 8 + 8
        + 1 + 1 + 1
        + 5;
}

#[account]
pub struct UserBalance {
    pub market: Pubkey,
    pub user: Pubkey,
    pub base_free: u64,
    pub quote_free: u64,
    pub bump: u8,
    pub pad: [u8; 7],
}
impl UserBalance {
    pub const LEN: usize = 8
        + 32 + 32
        + 8 + 8
        + 1
        + 7;
}
