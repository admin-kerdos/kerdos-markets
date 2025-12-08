use anchor_lang::prelude::*;
use anchor_lang::system_program as sys;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use crate::engine::{BinaryClobEngine, MatchingEngine};
use crate::state::{Market, OpenOrdersLite, Blob, FillEvent, BLOB_MAGIC};
use crate::domain::BlobKind;
use crate::ix_init::{ensure_funded_resize, write_blob_header};
use crate::slab;
use crate::slab::remove_by_oo as book_remove_oo;

const EV_CHUNK: usize = 128;
const BOOK_BOOT_NODES: u32 = 64;

#[derive(Accounts)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: PDA owned by this program (validated by seeds + owner)
    #[account(mut, seeds = [b"kerdos_bids", market.key().as_ref()], bump, owner = crate::id())]
    pub bids: UncheckedAccount<'info>,

    /// CHECK: PDA owned by this program (validated by seeds + owner)
    #[account(mut, seeds = [b"kerdos_asks", market.key().as_ref()], bump, owner = crate::id())]
    pub asks: UncheckedAccount<'info>,

    /// CHECK: PDA owned by this program (validated by seeds + owner)
    #[account(mut, seeds = [b"kerdos_eventq", market.key().as_ref()], bump, owner = crate::id())]
    pub event_queue: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = OpenOrdersLite::LEN,
        seeds = [b"kerdos_oo", market.key().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub oo: Account<'info, OpenOrdersLite>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct PlaceOrderParams {
    pub price_ticks: u64,
    pub base_qty: u64,
    pub side: u8,
    pub lock_lamports: u64,
    pub max_slippage_ticks: u64,
}

pub fn place_order_handler(ctx: Context<PlaceOrder>, params: PlaceOrderParams) -> Result<()> {
    let m = &ctx.accounts.market;
    let eng = BinaryClobEngine;

    require!(params.side == 0 || params.side == 1, OrdersError::InvalidSide);
    require!(params.price_ticks <= u32::MAX as u64, OrdersError::PriceOutOfRange);
    require!(params.base_qty % m.min_base_qty == 0, OrdersError::InvalidQtyStep);

    eng.validate_tick(m.tick_size, params.price_ticks)?;
    eng.validate_min_qty(m.min_base_qty, params.base_qty)?;
    require!(!m.paused, OrdersError::Paused);
    require!(params.lock_lamports > 0, OrdersError::InvalidAmount);

    require_keys_eq!(m.bids,        ctx.accounts.bids.key(),        OrdersError::BadBookAccount);
    require_keys_eq!(m.asks,        ctx.accounts.asks.key(),        OrdersError::BadBookAccount);
    require_keys_eq!(m.event_queue, ctx.accounts.event_queue.key(), OrdersError::BadBookAccount);

    validate_blob(&ctx.accounts.bids.to_account_info(), BlobKind::Bids)?;
    validate_blob(&ctx.accounts.asks.to_account_info(), BlobKind::Asks)?;
    validate_blob(&ctx.accounts.event_queue.to_account_info(), BlobKind::EventQueue)?;

    if ctx.accounts.oo.active {
        let refund = ctx.accounts.oo.locked_lamports;
        let mut oo_ai = ctx.accounts.oo.to_account_info();
        let mut payer_ai = ctx.accounts.payer.to_account_info();
        require!(oo_ai.lamports() >= refund, OrdersError::InsufficientLamports);
        **oo_ai.try_borrow_mut_lamports()? = oo_ai.lamports().checked_sub(refund).ok_or(OrdersError::Overflow)?;
        **payer_ai.try_borrow_mut_lamports()? = payer_ai.lamports().checked_add(refund).ok_or(OrdersError::Overflow)?;
        let removed = if ctx.accounts.oo.side == 0 {
            book_remove_oo(&ctx.accounts.bids.to_account_info(), true, ctx.accounts.oo.key())?
        } else {
            book_remove_oo(&ctx.accounts.asks.to_account_info(), false, ctx.accounts.oo.key())?
        };
        if !removed {
            msg!("OO cleanup: entry already absent from book");
        }
        let oo = &mut ctx.accounts.oo;
        oo.locked_lamports = 0;
        oo.active = false;
    }

    let cpi_accounts = sys::Transfer {
        from: ctx.accounts.payer.to_account_info(),
        to:   ctx.accounts.oo.to_account_info(),
    };
    let cpi = CpiContext::new(ctx.accounts.system_program.to_account_info(), cpi_accounts);
    sys::transfer(cpi, params.lock_lamports)?;

    let oo = &mut ctx.accounts.oo;
    oo.user            = ctx.accounts.payer.key();
    oo.market          = m.key();
    oo.locked_lamports = params.lock_lamports;
    oo.price_ticks     = params.price_ticks;
    oo.base_qty        = params.base_qty;
    oo.side            = params.side;
    oo.active          = true;
    oo.bump            = ctx.bumps.oo;

    ensure_book_boot(
        &ctx.accounts.payer, &ctx.accounts.system_program,
        &ctx.accounts.bids.to_account_info(), BlobKind::Bids, m.bids_capacity
    )?;
    ensure_book_boot(
        &ctx.accounts.payer, &ctx.accounts.system_program,
        &ctx.accounts.asks.to_account_info(), BlobKind::Asks, m.asks_capacity
    )?;
    ensure_eventq_min(
        &ctx.accounts.payer, &ctx.accounts.system_program,
        &ctx.accounts.event_queue.to_account_info(),
        m.eventq_capacity, Blob::LEN + FillEvent::LEN * 4
    )?;

    if params.side == 0 {
        match_and_place(
            &ctx.accounts.asks.to_account_info(),
            &ctx.accounts.bids.to_account_info(),
            &ctx.accounts.event_queue.to_account_info(),
            &ctx.accounts.payer, &ctx.accounts.system_program,
            oo, true,
            m.eventq_capacity as usize,
            m.bids_capacity as usize,
            params.max_slippage_ticks,
        )?;
    } else {
        match_and_place(
            &ctx.accounts.bids.to_account_info(),
            &ctx.accounts.asks.to_account_info(),
            &ctx.accounts.event_queue.to_account_info(),
            &ctx.accounts.payer, &ctx.accounts.system_program,
            oo, false,
            m.eventq_capacity as usize,
            m.asks_capacity as usize,
            params.max_slippage_ticks,
        )?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: PDA owned by this program (validated by seeds + owner)
    #[account(mut, seeds = [b"kerdos_bids", market.key().as_ref()], bump, owner = crate::id())]
    pub bids: UncheckedAccount<'info>,

    /// CHECK: PDA owned by this program (validated by seeds + owner)
    #[account(mut, seeds = [b"kerdos_asks", market.key().as_ref()], bump, owner = crate::id())]
    pub asks: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"kerdos_oo", market.key().as_ref(), payer.key().as_ref()],
        bump = oo.bump
    )]
    pub oo: Account<'info, OpenOrdersLite>,
}

pub fn cancel_order_handler(ctx: Context<CancelOrder>) -> Result<()> {
    require!(ctx.accounts.oo.active, OrdersError::NotActive);
    require_keys_eq!(ctx.accounts.oo.user, ctx.accounts.payer.key(), OrdersError::Unauthorized);

    let amount = ctx.accounts.oo.locked_lamports;
    let from = &ctx.accounts.oo.to_account_info();
    let to   = &ctx.accounts.payer.to_account_info();

    require!(from.lamports() >= amount, OrdersError::InsufficientLamports);
    **from.try_borrow_mut_lamports()? = from.lamports().checked_sub(amount).ok_or(OrdersError::Overflow)?;
    **to.try_borrow_mut_lamports()?   = to.lamports().checked_add(amount).ok_or(OrdersError::Overflow)?;

    let oo = &mut ctx.accounts.oo;
    // Remove from the book so the slab frees the node.
    let removed = if oo.side == 0 {
        book_remove_oo(&ctx.accounts.bids.to_account_info(), true, oo.key())?
    } else {
        book_remove_oo(&ctx.accounts.asks.to_account_info(), false, oo.key())?
    };
    // If the node is already gone from the book (e.g. fully consumed), still allow unlocking funds.
    if !removed {
        msg!("open orders entry already absent from book; unlocking lamports");
    }

    oo.locked_lamports = 0;
    oo.active = false;
    Ok(())
}

#[derive(Accounts)]
pub struct ClearEventQ<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub market: Account<'info, Market>,

    /// CHECK: Market EventQ PDA, owned by this program
    #[account(mut, seeds = [b"kerdos_eventq", market.key().as_ref()], bump, owner = crate::id())]
    pub event_queue: UncheckedAccount<'info>,
}

pub fn clear_eventq_handler(ctx: Context<ClearEventQ>) -> Result<()> {
    require_keys_eq!(ctx.accounts.market.authority, ctx.accounts.authority.key(), OrdersError::Unauthorized);
    let ai = ctx.accounts.event_queue.to_account_info();
    let mut b = blob_load(&ai)?;
    b.used = 0;
    blob_store(&ai, &b)?;
    Ok(())
}

#[derive(Accounts)]
pub struct CloseOo<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub market: Account<'info, Market>,

    #[account(
        mut,
        close = payer,
        seeds = [b"kerdos_oo", market.key().as_ref(), payer.key().as_ref()],
        bump = oo.bump
    )]
    pub oo: Account<'info, OpenOrdersLite>,
}

pub fn close_oo_handler(ctx: Context<CloseOo>) -> Result<()> {
    require!(!ctx.accounts.oo.active, OrdersError::StillActive);
    Ok(())
}

fn match_and_place<'info>(
    opposite_ai: &AccountInfo<'info>,
    same_side_ai: &AccountInfo<'info>,
    eventq_ai: &AccountInfo<'info>,
    payer: &Signer<'info>,
    sys_prog: &Program<'info, System>,
    taker_oo: &mut Account<'info, OpenOrdersLite>,
    taker_is_bid: bool,
    evq_cap: usize,
    same_cap: usize,
    max_slippage_ticks: u64,
) -> Result<()> {
    loop {
        let best = book_peek_head(opposite_ai)?;
        if best.is_none() { break; }
        let (maker_oo, top_price, top_qty) = best.unwrap();

        let cross = if taker_is_bid { taker_oo.price_ticks >= top_price } else { taker_oo.price_ticks <= top_price };
        if !cross { break; }

        let diff = if taker_is_bid {
            taker_oo.price_ticks.saturating_sub(top_price)
        } else {
            top_price.saturating_sub(taker_oo.price_ticks)
        };
        if diff > max_slippage_ticks { break; }

        let fill = core::cmp::min(taker_oo.base_qty, top_qty);
        book_consume_head_by(opposite_ai, !taker_is_bid, fill)?;

        ensure_event_capacity(payer, sys_prog, eventq_ai, 1, evq_cap)?;
        let price_ticks_u32: u32 = (top_price as u64).try_into().unwrap_or(u32::MAX);
        let ev = FillEvent {
            maker_oo,
            taker_oo: taker_oo.key(),
            base_qty: fill,
            price_ticks: price_ticks_u32,
            taker_side: if taker_is_bid { 0 } else { 1 },
            pad: [0; 3],
        };
        event_push(eventq_ai, &ev)?;

        taker_oo.base_qty = taker_oo.base_qty.saturating_sub(fill);
        if taker_oo.base_qty == 0 {
            taker_oo.active = false;
            break;
        }
    }

    if taker_oo.base_qty > 0 {
        ensure_book_free(payer, sys_prog, same_side_ai, same_cap as u32, 1)?;
        let ts = Clock::get()?.slot;
        book_insert_order(
            same_side_ai,
            taker_is_bid,
            taker_oo.price_ticks,
            taker_oo.base_qty,
            taker_oo.key(),
            ts,
        )?;
    }
    Ok(())
}

fn ensure_book_boot<'info>(
    payer: &Signer<'info>,
    sys_prog: &Program<'info, System>,
    ai: &AccountInfo<'info>,
    kind: BlobKind,
    max_cap: u32,
) -> Result<()> {
    if ai.data_len() < Blob::LEN {
        ensure_funded_resize(payer, sys_prog, ai, Blob::LEN)?;
        write_blob_header(ai, kind, max_cap)?;
    }
    let cap_by_len = slab::capacity_from_len(ai.data_len());
    if cap_by_len == 0 && max_cap > 0 {
        let boot = core::cmp::min(max_cap, BOOK_BOOT_NODES).max(1);
        let need_len = Blob::LEN + slab::region_len_for(boot);
        if ai.data_len() < need_len {
            ensure_funded_resize(payer, sys_prog, ai, need_len)?;
        }
        slab::init(ai, boot)?;
    }
    Ok(())
}

fn ensure_book_free<'info>(
    payer: &Signer<'info>,
    sys_prog: &Program<'info, System>,
    ai: &AccountInfo<'info>,
    max_cap: u32,
    need_free: u32,
) -> Result<()> {
    slab::ensure_free_nodes_grow(ai, max_cap, need_free, |want_len| {
        ensure_funded_resize(payer, sys_prog, ai, want_len)
    })
}

fn ensure_eventq_min<'info>(
    payer: &Signer<'info>,
    sys_prog: &Program<'info, System>,
    ai: &AccountInfo<'info>,
    cap: u32,
    min_len: usize,
) -> Result<()> {
    let cur = ai.data_len();
    if cur < Blob::LEN {
        ensure_funded_resize(payer, sys_prog, ai, Blob::LEN)?;
        write_blob_header(ai, BlobKind::EventQueue, cap)?;
    }
    if ai.data_len() < min_len {
        ensure_funded_resize(payer, sys_prog, ai, min_len)?;
    }
    Ok(())
}

fn book_peek_head(ai: &AccountInfo<'_>) -> Result<Option<(Pubkey, u64, u64)>> {
    slab::peek_best(ai)
}

fn book_consume_head_by(ai: &AccountInfo<'_>, is_bid_book: bool, qty: u64) -> Result<()> {
    slab::consume_best_by(ai, is_bid_book, qty)
}

fn book_insert_order(
    ai: &AccountInfo<'_>,
    is_bid_book: bool,
    price_ticks: u64,
    base_qty: u64,
    oo: Pubkey,
    ts: u64,
) -> Result<()> {
    slab::insert_order(ai, is_bid_book, price_ticks, base_qty, oo, ts)
}

fn event_off(idx: usize) -> usize { Blob::LEN + idx * FillEvent::LEN }

fn write_event(ai: &AccountInfo<'_>, idx: usize, ev: &FillEvent) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let off = event_off(idx);
    let mut cur = std::io::Cursor::new(&mut data[off..off + FillEvent::LEN]);
    ev.serialize(&mut cur)?;
    Ok(())
}

fn event_push(ai: &AccountInfo<'_>, ev: &FillEvent) -> Result<()> {
    let used = book_used(ai)?;
    write_event(ai, used, ev)?;
    set_book_used(ai, used + 1)?;
    Ok(())
}

fn validate_blob(ai: &AccountInfo<'_>, expected: BlobKind) -> Result<()> {
    let len = ai.data_len();
    if len < Blob::LEN {
        return Ok(());
    }
    let b = blob_load(ai)?;
    require!(b.magic == BLOB_MAGIC, OrdersError::BadBlobHeader);
    require!(b.kind == expected as u8, OrdersError::BadBlobHeader);

    if matches!(expected, BlobKind::EventQueue) {
        let max_entries = (len - Blob::LEN) / FillEvent::LEN;
        require!((b.used as usize) <= max_entries, OrdersError::BadBlobHeader);
        return Ok(());
    }

    if len < Blob::LEN + slab::SlabHeader::LEN {
        return Ok(());
    }
    let h = {
        let data = ai.try_borrow_data()?;
        let mut rd: &[u8] = &data[Blob::LEN..Blob::LEN + slab::SlabHeader::LEN];
        slab::SlabHeader::deserialize(&mut rd)?
    };
    let cap_by_len = slab::capacity_from_len(len);
    require!(h.capacity <= cap_by_len, OrdersError::BadBlobHeader);
    require!(h.used <= h.capacity, OrdersError::BadBlobHeader);
    Ok(())
}

#[error_code]
    pub enum OrdersError {
        #[msg("paused")]                         Paused,
        #[msg("invalid amount")]                 InvalidAmount,
        #[msg("order already active")]           AlreadyActive,
        #[msg("order not active")]               NotActive,
        #[msg("book entry not found for OO")]    BookEntryNotFound,
        #[msg("invalid side")]                   InvalidSide,
        #[msg("price out of range")]             PriceOutOfRange,
        #[msg("invalid qty step")]               InvalidQtyStep,
        #[msg("bad blob header or bounds")]      BadBlobHeader,
        #[msg("insufficient lamports for refund")] InsufficientLamports,
    #[msg("arithmetic overflow")]            Overflow,
    #[msg("event queue full")]               EventqFull,
    #[msg("book full")]                      BookFull,
    #[msg("bad book account for market")]    BadBookAccount,
    #[msg("unauthorized")]                   Unauthorized,
    #[msg("order still active")]             StillActive,
}

fn blob_load(ai: &AccountInfo<'_>) -> Result<Blob> {
    let data = ai.try_borrow_data()?;
    let mut rd: &[u8] = &data;
    let b = Blob::deserialize(&mut rd)?;
    Ok(b)
}

fn blob_store(ai: &AccountInfo<'_>, b: &Blob) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let mut cur = std::io::Cursor::new(&mut data[..]);
    b.serialize(&mut cur)?;
    Ok(())
}

fn book_used(ai: &AccountInfo<'_>) -> Result<usize> {
    let b = blob_load(ai)?;
    Ok(b.used as usize)
}

fn set_book_used(ai: &AccountInfo<'_>, used: usize) -> Result<()> {
    let mut b = blob_load(ai)?;
    b.used = used as u32;
    blob_store(ai, &b)
}

fn ensure_event_capacity<'info>(
    payer: &Signer<'info>,
    sys_prog: &Program<'info, System>,
    ai: &AccountInfo<'info>,
    extra: usize,
    cap: usize,
) -> Result<()> {
    let used = book_used(ai)?;
    let need_ev = used + extra;
    require!(need_ev <= cap, OrdersError::EventqFull);

    let elem = FillEvent::LEN;
    let have_len = ai.data_len();
    let have_ev = if have_len >= Blob::LEN { (have_len - Blob::LEN) / elem } else { 0 };
    if need_ev > have_ev {
        let want_ev = core::cmp::min(((need_ev + EV_CHUNK - 1) / EV_CHUNK) * EV_CHUNK, cap);
        let want_len = Blob::LEN + want_ev * elem;
        ensure_funded_resize(payer, sys_prog, ai, want_len)?;
    }
    Ok(())
}
