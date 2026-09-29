import { getAddress, isAddress, type Address } from 'viem'
import { CHAIN_ID, CRVUSD_ADDRESS, publicClient } from './chain'

export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

export const engineAbi = [
  {
    type: 'function',
    name: 'BOBC',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'ASSET',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'PEG_ORACLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'MAX_STALENESS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'redeem',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'bobc_amount', type: 'uint256' },
      { name: 'max_iterations', type: 'uint256' },
    ],
    outputs: [{ name: 'assets_out', type: 'uint256' }],
  },
] as const

export const oracleAbi = [
  {
    type: 'function',
    name: 'latest',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'rate', type: 'uint256' },
      { name: 'updated_at', type: 'uint64' },
    ],
  },
] as const

export type Deployment = {
  engine: Address
  bobc: Address
  oracle: Address
  maxStaleness: bigint
}

export function isOracleFresh(
  rate: bigint,
  updatedAt: bigint,
  blockTimestamp: bigint,
  maxStaleness: bigint,
) {
  return (
    rate > 0n &&
    updatedAt <= blockTimestamp &&
    blockTimestamp - updatedAt <= maxStaleness
  )
}

export async function verifyDeployment(engine: Address): Promise<Deployment> {
  const code = await publicClient.getCode({ address: engine })
  if (!code || code === '0x')
    throw new Error('VaultEngine has no contract code on Arbitrum One.')
  const [bobc, asset, oracle, maxStaleness] = await Promise.all([
    publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: 'BOBC',
    }),
    publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: 'ASSET',
    }),
    publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: 'PEG_ORACLE',
    }),
    publicClient.readContract({
      address: engine,
      abi: engineAbi,
      functionName: 'MAX_STALENESS',
    }),
  ])
  if (
    !isAddress(bobc) ||
    !isAddress(oracle) ||
    bobc === '0x0000000000000000000000000000000000000000' ||
    oracle === '0x0000000000000000000000000000000000000000'
  ) {
    throw new Error(
      'VaultEngine returned an invalid BOBC token or oracle address.',
    )
  }
  if (asset.toLowerCase() !== CRVUSD_ADDRESS.toLowerCase())
    throw new Error(
      'VaultEngine does not use the expected Arbitrum crvUSD token.',
    )
  const [tokenCode, oracleCode, decimals] = await Promise.all([
    publicClient.getCode({ address: bobc }),
    publicClient.getCode({ address: oracle }),
    publicClient.readContract({
      address: bobc,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
  ])
  if (
    !tokenCode ||
    tokenCode === '0x' ||
    !oracleCode ||
    oracleCode === '0x' ||
    decimals !== 18
  ) {
    throw new Error(
      'The configured BOBC deployment is incomplete or has unexpected token decimals.',
    )
  }
  return {
    engine,
    bobc: getAddress(bobc),
    oracle: getAddress(oracle),
    maxStaleness,
  }
}

export async function readBalance(token: Address, account: Address) {
  return publicClient.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account],
  })
}

export async function readOracle(deployment: Deployment) {
  const [rate, updatedAt] = await publicClient.readContract({
    address: deployment.oracle,
    abi: oracleAbi,
    functionName: 'latest',
  })
  const block = await publicClient.getBlock()
  const fresh = isOracleFresh(
    rate,
    updatedAt,
    block.timestamp,
    deployment.maxStaleness,
  )
  return {
    rate,
    updatedAt,
    fresh,
    checkedAt: block.timestamp,
    chainId: CHAIN_ID,
  }
}
