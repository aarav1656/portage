use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount};
use anchor_spl::token_2022::spl_token_2022::extension::{
    BaseStateWithExtensions, ExtensionType, StateWithExtensions,
};
use anchor_spl::token_2022::spl_token_2022::state::Mint as MintState;
use anchor_spl::token_interface::{
    self, Mint as IMint, Token2022, TokenAccount as ITokenAccount, TransferChecked,
};

declare_id!("AWHaqsXMZGSj1KamhzmMt11zAzfAZPzeuweT6QYP9Q8V");

pub const VAULT: &[u8] = b"vault";
pub const VAULT_TOKEN: &[u8] = b"vault_token";
pub const WRAPPED: &[u8] = b"wrapped";

#[program]
pub mod portage {
    use super::*;

    pub fn init_vault(ctx: Context<InitVault>) -> Result<()> {
        // Refuse extensions that let a third party move vault funds or that need extra
        // CPI accounts. A transfer fee is the reason this program exists, so it is allowed.
        {
            let info = ctx.accounts.underlying_mint.to_account_info();
            let data = info.try_borrow_data()?;
            let state = StateWithExtensions::<MintState>::unpack(&data)?;
            for ext in state.get_extension_types()? {
                require!(
                    matches!(
                        ext,
                        ExtensionType::TransferFeeConfig
                            | ExtensionType::MetadataPointer
                            | ExtensionType::TokenMetadata
                    ),
                    PortageError::UnsupportedUnderlying
                );
            }
        }
        let v = &mut ctx.accounts.vault;
        v.underlying_mint = ctx.accounts.underlying_mint.key();
        v.wrapped_mint = ctx.accounts.wrapped_mint.key();
        v.vault_token = ctx.accounts.vault_token.key();
        v.bump = ctx.bumps.vault;
        Ok(())
    }

    pub fn wrap(ctx: Context<Wrap>, amount: u64) -> Result<()> {
        let a = ctx.accounts;
        let before = a.vault_token.amount;
        token_interface::transfer_checked(
            CpiContext::new(
                a.underlying_program.to_account_info(),
                TransferChecked {
                    from: a.user_underlying.to_account_info(),
                    mint: a.underlying_mint.to_account_info(),
                    to: a.vault_token.to_account_info(),
                    authority: a.user.to_account_info(),
                },
            ),
            amount,
            a.underlying_mint.decimals,
        )?;
        a.vault_token.reload()?;
        let received = a
            .vault_token
            .amount
            .checked_sub(before)
            .ok_or(PortageError::InvariantViolated)?;
        require!(received > 0, PortageError::NothingReceived);

        let mint_key = a.underlying_mint.key();
        let seeds: &[&[u8]] = &[VAULT, mint_key.as_ref(), &[a.vault.bump]];
        token::mint_to(
            CpiContext::new_with_signer(
                a.token_program.to_account_info(),
                MintTo {
                    mint: a.wrapped_mint.to_account_info(),
                    to: a.user_wrapped.to_account_info(),
                    authority: a.vault.to_account_info(),
                },
                &[seeds],
            ),
            received,
        )?;
        a.wrapped_mint.reload()?;
        require!(
            a.wrapped_mint.supply <= a.vault_token.amount,
            PortageError::InvariantViolated
        );
        emit!(Wrapped { user: a.user.key(), sent: amount, minted: received });
        Ok(())
    }

    pub fn unwrap(ctx: Context<Unwrap>, amount: u64) -> Result<()> {
        let a = ctx.accounts;
        require!(amount > 0, PortageError::NothingReceived);
        token::burn(
            CpiContext::new(
                a.token_program.to_account_info(),
                Burn {
                    mint: a.wrapped_mint.to_account_info(),
                    from: a.user_wrapped.to_account_info(),
                    authority: a.user.to_account_info(),
                },
            ),
            amount,
        )?;
        let mint_key = a.underlying_mint.key();
        let seeds: &[&[u8]] = &[VAULT, mint_key.as_ref(), &[a.vault.bump]];
        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                a.underlying_program.to_account_info(),
                TransferChecked {
                    from: a.vault_token.to_account_info(),
                    mint: a.underlying_mint.to_account_info(),
                    to: a.user_underlying.to_account_info(),
                    authority: a.vault.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            a.underlying_mint.decimals,
        )?;
        a.vault_token.reload()?;
        a.wrapped_mint.reload()?;
        require!(
            a.wrapped_mint.supply <= a.vault_token.amount,
            PortageError::InvariantViolated
        );
        emit!(Unwrapped { user: a.user.key(), burned: amount });
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub underlying_mint: Pubkey,
    pub wrapped_mint: Pubkey,
    pub vault_token: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitVault<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mint::token_program = underlying_program)]
    pub underlying_mint: InterfaceAccount<'info, IMint>,
    #[account(init, payer = payer, space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT, underlying_mint.key().as_ref()], bump)]
    pub vault: Account<'info, Vault>,
    #[account(init, payer = payer,
        seeds = [VAULT_TOKEN, underlying_mint.key().as_ref()], bump,
        token::mint = underlying_mint, token::authority = vault,
        token::token_program = underlying_program)]
    pub vault_token: InterfaceAccount<'info, ITokenAccount>,
    #[account(init, payer = payer,
        seeds = [WRAPPED, underlying_mint.key().as_ref()], bump,
        mint::decimals = underlying_mint.decimals, mint::authority = vault,
        mint::token_program = token_program)]
    pub wrapped_mint: Account<'info, Mint>,
    pub underlying_program: Program<'info, Token2022>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Wrap<'info> {
    pub user: Signer<'info>,
    pub underlying_mint: InterfaceAccount<'info, IMint>,
    #[account(seeds = [VAULT, underlying_mint.key().as_ref()], bump = vault.bump,
        has_one = underlying_mint, has_one = wrapped_mint, has_one = vault_token)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token: InterfaceAccount<'info, ITokenAccount>,
    #[account(mut)]
    pub wrapped_mint: Account<'info, Mint>,
    #[account(mut, token::mint = underlying_mint)]
    pub user_underlying: InterfaceAccount<'info, ITokenAccount>,
    #[account(mut, token::mint = wrapped_mint)]
    pub user_wrapped: Account<'info, TokenAccount>,
    pub underlying_program: Program<'info, Token2022>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unwrap<'info> {
    pub user: Signer<'info>,
    pub underlying_mint: InterfaceAccount<'info, IMint>,
    #[account(seeds = [VAULT, underlying_mint.key().as_ref()], bump = vault.bump,
        has_one = underlying_mint, has_one = wrapped_mint, has_one = vault_token)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub vault_token: InterfaceAccount<'info, ITokenAccount>,
    #[account(mut)]
    pub wrapped_mint: Account<'info, Mint>,
    #[account(mut, token::mint = underlying_mint)]
    pub user_underlying: InterfaceAccount<'info, ITokenAccount>,
    #[account(mut, token::mint = wrapped_mint, token::authority = user)]
    pub user_wrapped: Account<'info, TokenAccount>,
    pub underlying_program: Program<'info, Token2022>,
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct Wrapped {
    pub user: Pubkey,
    pub sent: u64,
    pub minted: u64,
}

#[event]
pub struct Unwrapped {
    pub user: Pubkey,
    pub burned: u64,
}

#[error_code]
pub enum PortageError {
    #[msg("Underlying mint has an extension the vault cannot hold safely")]
    UnsupportedUnderlying,
    #[msg("Vault received nothing")]
    NothingReceived,
    #[msg("Wrapped supply would exceed vault balance")]
    InvariantViolated,
}
