use anchor_lang::prelude::*;
use anchor_lang::solana_program::rent::Rent;
use anchor_lang::system_program as sys;
use crate::domain::{InitParams, BlobKind};
use crate::domain::sizing;
use crate::state::{Market, Blob, BLOB_MAGIC};

#[derive(Accounts)]
#[instruction(params: InitParams)]
pub struct InitMarket<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: External authority (key-only). Its Pubkey is persisted in `Market.authority`. Signature is enforced by business logic (e.g. `settle_events` checks it matches the signer).
    pub authority: UncheckedAccount<'info>,

    /// CHECK: External SPL base mint (key-only). We never read/deserialize it; we just store the Pubkey and use it in seeds.
    pub base_mint: UncheckedAccount<'info>,

    /// CHECK: External SPL quote mint (key-only). We never read/deserialize it; we just store the Pubkey and use it in seeds.
    pub quote_mint: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = Market::LEN,
        seeds = [b"kerdos_market", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    /// CHECK: PDA for bids blob. Created here if empty via `system_program::create_account` with signer seeds; if pre-existing, it must already be this program’s PDA. We only write program-defined bytes into it.
    #[account(mut, seeds = [b"kerdos_bids", market.key().as_ref()], bump)]
    pub bids: UncheckedAccount<'info>,

    /// CHECK: PDA for asks blob. Created here if empty via `system_program::create_account` with signer seeds; if pre-existing, it must already be this program’s PDA. We only write program-defined bytes into it.
    #[account(mut, seeds = [b"kerdos_asks", market.key().as_ref()], bump)]
    pub asks: UncheckedAccount<'info>,

    /// CHECK: PDA for event queue blob. Created here if empty via `system_program::create_account` with signer seeds; if pre-existing, it must already be this program’s PDA. We only write program-defined bytes into it.
    #[account(mut, seeds = [b"kerdos_eventq", market.key().as_ref()], bump)]
    pub event_queue: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn init_market_handler(ctx: Context<InitMarket>, params: InitParams) -> Result<()> {
    assert_preinit_or_owned(&ctx.accounts.bids.to_account_info())?;
    assert_preinit_or_owned(&ctx.accounts.asks.to_account_info())?;
    assert_preinit_or_owned(&ctx.accounts.event_queue.to_account_info())?;

    let market_bump = ctx.bumps.market;
    let bids_bump = ctx.bumps.bids;
    let asks_bump = ctx.bumps.asks;
    let evq_bump = ctx.bumps.event_queue;

    create_pda_zero(
        &ctx.accounts.payer,
        &ctx.accounts.bids,
        &ctx.accounts.system_program,
        &[b"kerdos_bids", ctx.accounts.market.key().as_ref(), &[bids_bump]],
    )?;
    create_pda_zero(
        &ctx.accounts.payer,
        &ctx.accounts.asks,
        &ctx.accounts.system_program,
        &[b"kerdos_asks", ctx.accounts.market.key().as_ref(), &[asks_bump]],
    )?;
    create_pda_zero(
        &ctx.accounts.payer,
        &ctx.accounts.event_queue,
        &ctx.accounts.system_program,
        &[b"kerdos_eventq", ctx.accounts.market.key().as_ref(), &[evq_bump]],
    )?;

    let m = &mut ctx.accounts.market;
    m.authority       = ctx.accounts.authority.key();
    m.base_mint       = params.base_mint;
    m.quote_mint      = params.quote_mint;
    m.bids            = ctx.accounts.bids.key();
    m.asks            = ctx.accounts.asks.key();
    m.event_queue     = ctx.accounts.event_queue.key();
    m.tick_size       = params.tick_size;
    m.min_base_qty    = params.min_base_qty;
    m.fees_bps        = params.fees_bps;
    m.paused          = false;
    m.bump_market     = market_bump;
    m.bump_bids       = bids_bump;
    m.bump_asks       = asks_bump;
    m.bump_eventq     = evq_bump;
    m.bids_capacity   = params.bids_capacity;
    m.asks_capacity   = params.asks_capacity;
    m.eventq_capacity = params.event_queue_capacity;
    m.fees_accrued    = 0;

    Ok(())
}

#[derive(Accounts)]
pub struct GrowBlob<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub market: Account<'info, Market>,

    /// CHECK: PDA owned by this program; seeds + `owner = program` enforced below. We only grow/serialize program-defined bytes.
    #[account(mut, seeds = [b"kerdos_bids", market.key().as_ref()], bump, owner = crate::id())]
    pub bids: UncheckedAccount<'info>,

    /// CHECK: PDA owned by this program; seeds + `owner = program` enforced below. We only grow/serialize program-defined bytes.
    #[account(mut, seeds = [b"kerdos_asks", market.key().as_ref()], bump, owner = crate::id())]
    pub asks: UncheckedAccount<'info>,

    /// CHECK: PDA owned by this program; seeds + `owner = program` enforced below. We only grow/serialize program-defined bytes.
    #[account(mut, seeds = [b"kerdos_eventq", market.key().as_ref()], bump, owner = crate::id())]
    pub event_queue: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn grow_blob_handler(ctx: Context<GrowBlob>, params: crate::domain::GrowParams) -> Result<()> {
    let step = core::cmp::max(1, core::cmp::min(params.step_bytes as usize, 10_240));
    let m = &ctx.accounts.market;
    match params.which {
        0 => grow_one(&ctx.accounts.payer, &ctx.accounts.system_program, &ctx.accounts.bids.to_account_info(), BlobKind::Bids, sizing::bids_space(m.bids_capacity), m.bids_capacity, step)?,
        1 => grow_one(&ctx.accounts.payer, &ctx.accounts.system_program, &ctx.accounts.asks.to_account_info(), BlobKind::Asks, sizing::asks_space(m.asks_capacity), m.asks_capacity, step)?,
        _ => grow_one(&ctx.accounts.payer, &ctx.accounts.system_program, &ctx.accounts.event_queue.to_account_info(), BlobKind::EventQueue, sizing::eventq_space(m.eventq_capacity), m.eventq_capacity, step)?,
    }
    Ok(())
}

fn grow_one<'info>(
    payer: &Signer<'info>,
    sys_prog: &Program<'info, System>,
    target: &AccountInfo<'info>,
    kind: BlobKind,
    want: usize,
    cap: u32,
    step: usize,
) -> Result<()> {
    let cur = target.data_len();
    if cur < want {
        let next = core::cmp::min(cur + step, want);
        ensure_funded_resize(payer, sys_prog, target, next)?;
        if cur < Blob::LEN && next >= Blob::LEN {
            write_blob_header(target, kind, cap)?;
        }
    }
    Ok(())
}

pub fn ensure_funded_resize<'info>(
    payer: &Signer<'info>,
    sys_prog: &Program<'info, System>,
    target: &AccountInfo<'info>,
    new_len: usize,
) -> Result<()> {
    let need = Rent::get()?.minimum_balance(new_len);
    let have = target.lamports();
    if have < need {
        let delta = need.saturating_sub(have);
        let cpi_accounts = sys::Transfer { from: payer.to_account_info(), to: target.clone() };
        let cpi = CpiContext::new(sys_prog.to_account_info(), cpi_accounts);
        sys::transfer(cpi, delta)?;
    }
    target.resize(new_len)?;
    Ok(())
}

pub fn write_blob_header<'info>(ai: &AccountInfo<'info>, kind: BlobKind, capacity: u32) -> Result<()> {
    use anchor_lang::AnchorSerialize;
    let blob = Blob { magic: BLOB_MAGIC, kind: kind as u8, capacity, used: 0 };
    let mut data_ref = ai.try_borrow_mut_data()?;
    let data_slice: &mut [u8] = &mut *data_ref;
    let mut cur = std::io::Cursor::new(data_slice);
    blob.serialize(&mut cur)?;
    Ok(())
}

fn create_pda_zero<'info>(
    payer: &Signer<'info>,
    pda: &UncheckedAccount<'info>,
    sys_prog: &Program<'info, System>,
    seeds: &[&[u8]],
) -> Result<()> {
    let ai = pda.to_account_info();
    if ai.lamports() > 0 || ai.data_len() > 0 {
        require!(*ai.owner == crate::ID, InitError::InvalidPdaOwner);
        return Ok(());
    }
    let lamports = Rent::get()?.minimum_balance(0);
    let ca = sys::CreateAccount { from: payer.to_account_info(), to: ai.clone() };
    let signer_seeds: &[&[&[u8]]] = &[seeds];
    let cpi = CpiContext::new_with_signer(sys_prog.to_account_info(), ca, signer_seeds);
    sys::create_account(cpi, lamports, 0, &crate::id())?;
    Ok(())
}

#[error_code]
pub enum InitError {
    #[msg("PDA must be empty or already owned by this program")]
    InvalidPdaOwner,
}

fn assert_preinit_or_owned(ai: &AccountInfo<'_>) -> Result<()> {
    let is_empty = ai.lamports() == 0 && ai.data_len() == 0;
    let is_owned = *ai.owner == crate::ID;
    require!(is_empty || is_owned, InitError::InvalidPdaOwner);
    Ok(())
}
