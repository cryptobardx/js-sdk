import { useEffect, useMemo, useState } from "react";
import { useMainTokenStore } from "@orderly.network/hooks";
import {
  Arbitrum,
  defaultMainnetChains,
  type API,
} from "@orderly.network/types";

const nativeTokenAddress = "0x0000000000000000000000000000000000000000";
const mainnetQuoteChainIds = [
  Arbitrum.id,
  ...defaultMainnetChains
    .map((chain) => chain.id)
    .filter((chainId) => chainId !== Arbitrum.id),
];

const splitTokenBySymbol = <T extends { token?: string }>(items: T[]) => {
  return items.reduce<Record<"usdc" | "others", T[]>>(
    (result, item) => {
      if (item.token?.toUpperCase() === "USDC") {
        result.usdc.push(item);
      } else {
        result.others.push(item);
      }
      return result;
    },
    { usdc: [], others: [] },
  );
};

export const findMainnetQuoteChainInfo = (tokenInfo: API.Token) => {
  const chainInfo = mainnetQuoteChainIds
    .map((chainId) =>
      tokenInfo.chain_details.find(
        (item) => parseInt(item.chain_id) === chainId,
      ),
    )
    .find((item): item is API.ChainDetail => Boolean(item));

  if (!chainInfo) {
    return undefined;
  }

  return {
    contract_address: chainInfo.contract_address || nativeTokenAddress,
    quoteChainId: chainInfo.chain_id,
    decimals: chainInfo.decimals,
  };
};

interface Options {
  defaultValue?: string;
}

type ConvertTokenInfo = API.Token & {
  contract_address: string;
  quoteChainId: string;
  precision: number;
  symbol: string;
};

export const getMainnetConvertTokenInfo = (
  tokenInfo: API.Token,
): ConvertTokenInfo | undefined => {
  const chainInfo = findMainnetQuoteChainInfo(tokenInfo);

  if (!chainInfo) {
    return undefined;
  }

  return {
    ...tokenInfo,
    symbol: tokenInfo.token,
    precision: tokenInfo.decimals ?? 6,
    ...chainInfo,
  };
};

export const findQuoteTargetChainInfo = (
  targetToken: ConvertTokenInfo | undefined,
  quoteChainId: string | undefined,
) => {
  const info = targetToken?.chain_details?.find(
    (item) => item.chain_id === quoteChainId,
  );

  if (!info) {
    return undefined;
  }

  return {
    ...info,
    contract_address: info.contract_address || nativeTokenAddress,
    precision: targetToken?.precision,
  };
};

export const useToken = (options: Options) => {
  const { defaultValue } = options;

  const [sourceToken, setSourceToken] = useState<ConvertTokenInfo>();
  const [targetToken, setTargetToken] = useState<ConvertTokenInfo>();
  const [sourceTokens, setSourceTokens] = useState<ConvertTokenInfo[]>([]);

  const tokensInfo = useMainTokenStore((state) => state.data);

  const newTokensInfo = useMemo(() => {
    const filteredTokensInfo = (tokensInfo ?? []).filter(
      (item) => item.on_chain_swap,
    );

    return filteredTokensInfo.reduce<ConvertTokenInfo[]>((result, item) => {
      const tokenInfo = getMainnetConvertTokenInfo(item);

      if (!tokenInfo) {
        return result;
      }

      result.push(tokenInfo);

      return result;
    }, []);
  }, [tokensInfo]);

  useEffect(() => {
    const { usdc, others } = splitTokenBySymbol(newTokensInfo);
    setSourceToken(() => {
      if (defaultValue) {
        const defaultToken = others.find(({ token }) => token === defaultValue);
        return defaultToken ? defaultToken : others[0];
      }
      return others[0];
    });
    setSourceTokens(others);
    setTargetToken(usdc[0]);
  }, [defaultValue, newTokensInfo]);

  const targetChainInfo = useMemo(() => {
    return findQuoteTargetChainInfo(targetToken, sourceToken?.quoteChainId);
  }, [sourceToken, targetToken]);

  return {
    sourceToken,
    sourceTokens,
    onSourceTokenChange: setSourceToken,
    targetToken,
    targetChainInfo,
  };
};
