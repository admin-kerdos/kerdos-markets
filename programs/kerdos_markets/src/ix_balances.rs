use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::state::{Market, UserBalance};

#[derive(Accounts)]
pub struct InitVaults<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub market: Account<'info, Market>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    /// CHECK: PDA used as token owner; validated by seeds
    #[account(seeds = [b"kerdos_vault_auth", market.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = payer,
        token::mint = base_mint,
        token::authority = vault_auth,
        seeds = [b"kerdos_vault_base", market.key().as_ref()],
        bump
    )]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        token::mint = quote_mint,
        token::authority = vault_auth,
        seeds = [b"kerdos_vault_quote", market.key().as_ref()],
        bump
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn init_vaults_handler(_ctx: Context<InitVaults>) -> Result<()> {
    Ok(())
}

#[derive(Accounts)]
pub struct InitUserBalance<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub user: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = payer,
        space = UserBalance::LEN,
        seeds = [b"kerdos_user", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub ub: Account<'info, UserBalance>,
    pub system_program: Program<'info, System>,
}

pub fn init_user_balance_handler(ctx: Context<InitUserBalance>) -> Result<()> {
    let ub = &mut ctx.accounts.ub;
    ub.user = ctx.accounts.user.key();
    ub.market = ctx.accounts.market.key();
    ub.base_free = 0;
    ub.quote_free = 0;
    ub.bump = ctx.bumps.ub;
    Ok(())
}

#[derive(Accounts)]
pub struct DepositBase<'info> {
    pub user: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"kerdos_user", market.key().as_ref(), user.key().as_ref()], bump = ub.bump)]
    pub ub: Account<'info, UserBalance>,
    #[account(mut)]
    pub user_base_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit_base_handler(ctx: Context<DepositBase>, amount: u64) -> Result<()> {
    require!(amount > 0, BalancesError::InvalidAmount);
    require_keys_eq!(ctx.accounts.ub.user, ctx.accounts.user.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.ub.market, ctx.accounts.market.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.user_base_ata.mint, ctx.accounts.base_vault.mint, BalancesError::InvalidMint);

    let cpi_accounts = Transfer {
        from: ctx.accounts.user_base_ata.to_account_info(),
        to: ctx.accounts.base_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi, amount)?;

    let ub = &mut ctx.accounts.ub;
    ub.base_free = ub.base_free.checked_add(amount).ok_or(BalancesError::Overflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct DepositQuote<'info> {
    pub user: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"kerdos_user", market.key().as_ref(), user.key().as_ref()], bump = ub.bump)]
    pub ub: Account<'info, UserBalance>,
    #[account(mut)]
    pub user_quote_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn deposit_quote_handler(ctx: Context<DepositQuote>, amount: u64) -> Result<()> {
    require!(amount > 0, BalancesError::InvalidAmount);
    require_keys_eq!(ctx.accounts.ub.user, ctx.accounts.user.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.ub.market, ctx.accounts.market.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.user_quote_ata.mint, ctx.accounts.quote_vault.mint, BalancesError::InvalidMint);

    let cpi_accounts = Transfer {
        from: ctx.accounts.user_quote_ata.to_account_info(),
        to: ctx.accounts.quote_vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    };
    let cpi = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi, amount)?;

    let ub = &mut ctx.accounts.ub;
    ub.quote_free = ub.quote_free.checked_add(amount).ok_or(BalancesError::Overflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawBase<'info> {
    pub user: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"kerdos_user", market.key().as_ref(), user.key().as_ref()], bump = ub.bump)]
    pub ub: Account<'info, UserBalance>,
    #[account(mut)]
    pub user_base_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    /// CHECK: PDA used as token owner; validated by seeds
    #[account(seeds = [b"kerdos_vault_auth", market.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn withdraw_base_handler(ctx: Context<WithdrawBase>, amount: u64) -> Result<()> {
    require!(amount > 0, BalancesError::InvalidAmount);
    require_keys_eq!(ctx.accounts.ub.user, ctx.accounts.user.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.ub.market, ctx.accounts.market.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.user_base_ata.mint, ctx.accounts.base_vault.mint, BalancesError::InvalidMint);
    require!(ctx.accounts.ub.base_free >= amount, BalancesError::InsufficientFunds);

    let market_key = ctx.accounts.market.key();
    let bump = ctx.bumps.vault_auth;
    let seeds: &[&[u8]] = &[b"kerdos_vault_auth", market_key.as_ref(), &[bump]];
    let signer: &[&[&[u8]]] = &[seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.base_vault.to_account_info(),
        to: ctx.accounts.user_base_ata.to_account_info(),
        authority: ctx.accounts.vault_auth.to_account_info(),
    };
    let cpi = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer);
    token::transfer(cpi, amount)?;

    let ub = &mut ctx.accounts.ub;
    ub.base_free = ub.base_free.checked_sub(amount).ok_or(BalancesError::Overflow)?;
    Ok(())
}

#[derive(Accounts)]
pub struct WithdrawQuote<'info> {
    pub user: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"kerdos_user", market.key().as_ref(), user.key().as_ref()], bump = ub.bump)]
    pub ub: Account<'info, UserBalance>,
    #[account(mut)]
    pub user_quote_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    /// CHECK: PDA used as token owner; validated by seeds
    #[account(seeds = [b"kerdos_vault_auth", market.key().as_ref()], bump)]
    pub vault_auth: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn withdraw_quote_handler(ctx: Context<WithdrawQuote>, amount: u64) -> Result<()> {
    require!(amount > 0, BalancesError::InvalidAmount);
    require_keys_eq!(ctx.accounts.ub.user, ctx.accounts.user.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.ub.market, ctx.accounts.market.key(), BalancesError::Unauthorized);
    require_keys_eq!(ctx.accounts.user_quote_ata.mint, ctx.accounts.quote_vault.mint, BalancesError::InvalidMint);
    require!(ctx.accounts.ub.quote_free >= amount, BalancesError::InsufficientFunds);

    let market_key = ctx.accounts.market.key();
    let bump = ctx.bumps.vault_auth;
    let seeds: &[&[u8]] = &[b"kerdos_vault_auth", market_key.as_ref(), &[bump]];
    let signer: &[&[&[u8]]] = &[seeds];

    let cpi_accounts = Transfer {
        from: ctx.accounts.quote_vault.to_account_info(),
        to: ctx.accounts.user_quote_ata.to_account_info(),
        authority: ctx.accounts.vault_auth.to_account_info(),
    };
    let cpi = CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer);
    token::transfer(cpi, amount)?;

    let ub = &mut ctx.accounts.ub;
    ub.quote_free = ub.quote_free.checked_sub(amount).ok_or(BalancesError::Overflow)?;
    Ok(())
}

#[error_code]
pub enum BalancesError {
    #[msg("unauthorized")]
    Unauthorized,
    #[msg("invalid amount")]
    InvalidAmount,
    #[msg("invalid mint")]
    InvalidMint,
    #[msg("insufficient funds")]
    InsufficientFunds,
    #[msg("arithmetic overflow")]
    Overflow,
}
