use anchor_lang::prelude::*;
use anchor_lang::{AccountDeserialize, AccountSerialize, Discriminator};
use std::io::Cursor;
use crate::state::{Market, Blob, FillEvent, OpenOrdersLite, UserBalance, BLOB_MAGIC};

const BPS_DENOM: u64 = 10_000;

#[derive(Accounts)]
pub struct SettleEvents<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// CHECK: Market EventQ PDA.
    #[account(mut, seeds = [b"kerdos_eventq", market.key().as_ref()], bump, owner = crate::id())]
    pub event_queue: UncheckedAccount<'info>,
}

pub fn settle_events_handler(ctx: Context<SettleEvents>, max_events: u16) -> Result<()> {
    require_keys_eq!(ctx.accounts.market.authority, ctx.accounts.authority.key(), SettleError::Unauthorized);

    let mkt = &mut ctx.accounts.market;
    let evq_ai = ctx.accounts.event_queue.to_account_info();

    let mut bh = blob_load(&evq_ai)?;
    let used = bh.used as usize;
    if used == 0 {
        return Ok(());
    }
    let take_n = core::cmp::min(used, max_events as usize);

    for i in 0..take_n {
        let ev = read_event(&evq_ai, i)?;

        let mut maker_oo_ai = None;
        for ai in ctx.remaining_accounts.iter() {
            if ai.key() == ev.maker_oo { maker_oo_ai = Some(ai); break; }
        }
        let maker_oo_ai = maker_oo_ai.ok_or(SettleError::MissingOpenOrders)?;
        require!(*maker_oo_ai.owner == crate::id(), SettleError::MissingOpenOrders);
        let maker_oo = load_open_orders(maker_oo_ai)?;

        let mut taker_oo_ai = None;
        for ai in ctx.remaining_accounts.iter() {
            if ai.key() == ev.taker_oo { taker_oo_ai = Some(ai); break; }
        }
        let taker_oo_ai = taker_oo_ai.ok_or(SettleError::MissingOpenOrders)?;
        require!(*taker_oo_ai.owner == crate::id(), SettleError::MissingOpenOrders);
        let taker_oo = load_open_orders(taker_oo_ai)?;

        require_keys_eq!(maker_oo.market, mkt.key(), SettleError::WrongMarket);
        require_keys_eq!(taker_oo.market, mkt.key(), SettleError::WrongMarket);

        let maker_user = maker_oo.user;
        let taker_user = taker_oo.user;

        let (maker_ub_ai, mut maker_ub) = {
            let mut found = None;
            for ai in ctx.remaining_accounts.iter() {
                if *ai.owner != crate::id() || !ai.is_writable { continue; }
                if let Ok(ub) = load_user_balance(ai) {
                    if ub.market == mkt.key() && ub.user == maker_user {
                        found = Some((ai, ub));
                        break;
                    }
                }
            }
            found.ok_or(SettleError::MissingUserBalance)?
        };

        let (taker_ub_ai, mut taker_ub) = {
            let mut found = None;
            for ai in ctx.remaining_accounts.iter() {
                if *ai.owner != crate::id() || !ai.is_writable { continue; }
                if let Ok(ub) = load_user_balance(ai) {
                    if ub.market == mkt.key() && ub.user == taker_user {
                        found = Some((ai, ub));
                        break;
                    }
                }
            }
            found.ok_or(SettleError::MissingUserBalance)?
        };

        let quote_u128 = (ev.base_qty as u128)
            .checked_mul(ev.price_ticks as u128)
            .ok_or(SettleError::Overflow)?;
        let quote: u64 = quote_u128.try_into().map_err(|_| SettleError::Overflow)?;

        let fee: u64 = if mkt.fees_bps == 0 {
            0
        } else {
            ((quote as u128)
                .checked_mul(mkt.fees_bps as u128).ok_or(SettleError::Overflow)? / (BPS_DENOM as u128))
                .try_into().map_err(|_| SettleError::Overflow)?
        };

        if ev.taker_side == 0 {
            maker_ub.base_free = maker_ub.base_free.checked_sub(ev.base_qty).ok_or(SettleError::InsufficientBalance)?;
            maker_ub.quote_free = maker_ub.quote_free.checked_add(quote).ok_or(SettleError::Overflow)?;
            taker_ub.base_free = taker_ub.base_free.checked_add(ev.base_qty).ok_or(SettleError::Overflow)?;
            taker_ub.quote_free = taker_ub.quote_free.checked_sub(quote.checked_add(fee).ok_or(SettleError::Overflow)?).ok_or(SettleError::InsufficientBalance)?;
        } else {
            maker_ub.base_free = maker_ub.base_free.checked_add(ev.base_qty).ok_or(SettleError::Overflow)?;
            maker_ub.quote_free = maker_ub.quote_free.checked_sub(quote).ok_or(SettleError::InsufficientBalance)?;
            taker_ub.base_free = taker_ub.base_free.checked_sub(ev.base_qty).ok_or(SettleError::InsufficientBalance)?;
            taker_ub.quote_free = taker_ub.quote_free.checked_add(quote.checked_sub(fee).ok_or(SettleError::Underflow)?).ok_or(SettleError::Overflow)?;
        }

        store_user_balance(maker_ub_ai, &maker_ub)?;
        store_user_balance(taker_ub_ai, &taker_ub)?;

        mkt.fees_accrued = mkt.fees_accrued.checked_add(fee).ok_or(SettleError::Overflow)?;
    }

    if take_n == used {
        bh.used = 0;
        blob_store(&evq_ai, &bh)?;
    } else {
        for i in take_n..used {
            let ev = read_event(&evq_ai, i)?;
            write_event(&evq_ai, i - take_n, &ev)?;
        }
        bh.used = (used - take_n) as u32;
        blob_store(&evq_ai, &bh)?;
    }

    Ok(())
}

#[error_code]
pub enum SettleError {
    Unauthorized,
    MissingOpenOrders,
    MissingUserBalance,
    WrongMarket,
    Overflow,
    Underflow,
    InsufficientBalance,
}

fn load_open_orders(ai: &AccountInfo<'_>) -> Result<OpenOrdersLite> {
    let mut data_ref = ai.try_borrow_data()?;
    let mut bytes: &[u8] = &data_ref;
    let disc = <OpenOrdersLite as Discriminator>::DISCRIMINATOR;
    require!(bytes.len() >= 8 && &bytes[..8] == disc, SettleError::MissingOpenOrders);
    let acc = OpenOrdersLite::try_deserialize(&mut bytes)?;
    Ok(acc)
}

fn load_user_balance(ai: &AccountInfo<'_>) -> Result<UserBalance> {
    let mut data_ref = ai.try_borrow_data()?;
    let mut bytes: &[u8] = &data_ref;
    let disc = <UserBalance as Discriminator>::DISCRIMINATOR;
    require!(bytes.len() >= 8 && &bytes[..8] == disc, SettleError::MissingUserBalance);
    let acc = UserBalance::try_deserialize(&mut bytes)?;
    Ok(acc)
}

fn store_user_balance(ai: &AccountInfo<'_>, ub: &UserBalance) -> Result<()> {
    let mut data_ref = ai.try_borrow_mut_data()?;
    let data_slice: &mut [u8] = &mut *data_ref;
    let mut cur = Cursor::new(data_slice);
    ub.try_serialize(&mut cur)?;
    Ok(())
}

fn event_off(idx: usize) -> usize { Blob::LEN + idx * FillEvent::LEN }

fn read_event(ai: &AccountInfo<'_>, idx: usize) -> Result<FillEvent> {
    let data = ai.try_borrow_data()?;
    let off = event_off(idx);
    let mut rd: &[u8] = &data[off..off + FillEvent::LEN];
    FillEvent::deserialize(&mut rd).map_err(Into::into)
}

fn write_event(ai: &AccountInfo<'_>, idx: usize, ev: &FillEvent) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let off = event_off(idx);
    let mut cur = std::io::Cursor::new(&mut data[off..off + FillEvent::LEN]);
    ev.serialize(&mut cur).map_err(Into::into)
}

fn blob_load(ai: &AccountInfo<'_>) -> Result<Blob> {
    let data = ai.try_borrow_data()?;
    let mut rd: &[u8] = &data;
    let b = Blob::deserialize(&mut rd)?;
    require!(b.magic == BLOB_MAGIC, SettleError::Overflow);
    Ok(b)
}

fn blob_store(ai: &AccountInfo<'_>, b: &Blob) -> Result<()> {
    let mut data = ai.try_borrow_mut_data()?;
    let mut cur = std::io::Cursor::new(&mut data[..]);
    b.serialize(&mut cur)?;
    Ok(())
}
