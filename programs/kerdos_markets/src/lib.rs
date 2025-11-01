use anchor_lang::prelude::*;

pub mod domain;
pub mod state;
pub mod engine;
pub mod ix_init;
pub mod ix_orders;
pub mod ix_balances;
pub mod ix_settle;
pub mod slab;

pub use crate::domain::{InitParams, GrowParams};
pub use crate::ix_orders::PlaceOrderParams;
use ix_init::*;
use ix_orders::*;
use ix_balances::*;
use ix_settle::*;

declare_id!("DjcqZWPwPaB6EwnMXNdcgxkFk26ub6t6FXdSDE7aK3Sb");

#[program]
pub mod kerdos_markets {
    use super::*;

    pub fn init_market(ctx: Context<InitMarket>, params: InitParams) -> Result<()> {
        init_market_handler(ctx, params)
    }

    pub fn grow_blob(ctx: Context<GrowBlob>, params: GrowParams) -> Result<()> {
        grow_blob_handler(ctx, params)
    }

    pub fn place_order(ctx: Context<PlaceOrder>, params: PlaceOrderParams) -> Result<()> {
        place_order_handler(ctx, params)
    }

    pub fn cancel_order(ctx: Context<CancelOrder>) -> Result<()> {
        cancel_order_handler(ctx)
    }

    pub fn clear_eventq(ctx: Context<ClearEventQ>) -> Result<()> {
        clear_eventq_handler(ctx)
    }

    pub fn close_oo(ctx: Context<CloseOo>) -> Result<()> {
        close_oo_handler(ctx)
    }

    pub fn init_vaults(ctx: Context<InitVaults>) -> Result<()> {
        init_vaults_handler(ctx)
    }

    pub fn init_user_balance(ctx: Context<InitUserBalance>) -> Result<()> {
        init_user_balance_handler(ctx)
    }

    pub fn deposit_base(ctx: Context<DepositBase>, amount: u64) -> Result<()> {
        deposit_base_handler(ctx, amount)
    }

    pub fn deposit_quote(ctx: Context<DepositQuote>, amount: u64) -> Result<()> {
        deposit_quote_handler(ctx, amount)
    }

    pub fn withdraw_base(ctx: Context<WithdrawBase>, amount: u64) -> Result<()> {
        withdraw_base_handler(ctx, amount)
    }

    pub fn withdraw_quote(ctx: Context<WithdrawQuote>, amount: u64) -> Result<()> {
        withdraw_quote_handler(ctx, amount)
    }

    pub fn settle_events(ctx: Context<SettleEvents>, max_events: u16) -> Result<()> {
        settle_events_handler(ctx, max_events)
    }
}
