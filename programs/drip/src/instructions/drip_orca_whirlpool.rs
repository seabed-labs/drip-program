use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DripOrcaWhirlpoolParams {
    // TODO(matcha)
}

#[derive(Accounts)]
#[instruction(params: DripOrcaWhirlpoolParams)]
pub struct DripOrcaWhirlpool {
    // TODO(matcha)
}

pub fn handler(_ctx: Context<DripOrcaWhirlpool>, _params: DripOrcaWhirlpoolParams) -> Result<()> {
    // TODO(matcha)
    Ok(())
}
